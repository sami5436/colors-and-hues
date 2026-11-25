"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  CELL_COUNT,
  cleanClue,
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_PLAYERS,
  normalizeCode,
  ROUND_OPTIONS,
  AWAY_AFTER_MS,
} from "@/lib/game";
import { withTx } from "@/lib/server/db";
import {
  advanceIfAllIn,
  lockRoom,
  reveal,
  skipPhase,
  startMix,
  startNextRound,
  type LockedRoom,
} from "@/lib/server/engine";
import { clearPlayerCookie, getPlayer, hashToken, newToken, setPlayerCookie } from "@/lib/server/session";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type FormState = { error?: string } | undefined;

const nameSchema = z.string().trim().min(1, "Pick a name").max(16, "Keep names to 16 characters");
const codeSchema = z.string().transform(normalizeCode).pipe(z.string().length(CODE_LENGTH, "Room codes are 4 letters"));
const modeSchema = z.enum(["clue", "recall"]);

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

// ---------- Create / join ----------

export async function createRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const mode = modeSchema.catch("clue").parse(form.get("mode"));

  const token = newToken();
  let code = "";
  let playerId = "";
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    const candidate = randomCode();
    try {
      playerId = await withTx(async (client) => {
        await client.query("INSERT INTO rooms (code, mode) VALUES ($1, $2)", [candidate, mode]);
        const { rows } = await client.query<{ id: string }>(
          "INSERT INTO players (room_code, name, token_hash, seat) VALUES ($1, $2, $3, 0) RETURNING id::text AS id",
          [candidate, name.data, hashToken(token)],
        );
        await client.query("UPDATE rooms SET host_id = $2 WHERE code = $1", [candidate, rows[0].id]);
        return rows[0].id;
      });
      code = candidate;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error; // retry only on a code collision
    }
  }
  if (!code) return { error: "Couldn't find a free room code. Try again." };

  await setPlayerCookie(code, playerId, token);
  redirect(`/r/${code}`);
}

export async function joinRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const code = codeSchema.safeParse(form.get("code"));
  if (!code.success) return { error: code.error.issues[0].message };
  const name = nameSchema.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const existing = await getPlayer(code.data);
  if (existing) redirect(`/r/${code.data}`);

  const token = newToken();
  const result = await withTx(async (client) => {
    const room = await lockRoom(client, code.data);
    if (!room) return { error: `No room called ${code.data}. Check the code.` };
    const { rows } = await client.query<{ count: number; next_seat: number; taken: boolean }>(
      `SELECT count(*)::int AS count, COALESCE(max(seat) + 1, 0)::int AS next_seat,
              bool_or(lower(name) = lower($2)) AS taken
       FROM players WHERE room_code = $1`,
      [code.data, name.data],
    );
    if (rows[0].count >= MAX_PLAYERS) return { error: "That room is full." };
    if (rows[0].taken) return { error: "Someone in that room already has that name." };
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO players (room_code, name, token_hash, seat) VALUES ($1, $2, $3, $4) RETURNING id::text AS id",
      [code.data, name.data, hashToken(token), rows[0].next_seat],
    );
    if (!room.host_id) {
      await client.query("UPDATE rooms SET host_id = $2 WHERE code = $1", [code.data, inserted.rows[0].id]);
    }
    return { id: inserted.rows[0].id };
  });

  if ("error" in result) return { error: result.error };
  await setPlayerCookie(code.data, result.id, token);
  redirect(`/r/${code.data}`);
}

// ---------- In-room actions ----------

type Ctx = { client: Parameters<Parameters<typeof withTx>[0]>[0]; room: LockedRoom; playerId: string };

/** Verifies the cookie player, locks the room row and runs fn in one transaction. */
async function inRoom(rawCode: string, fn: (ctx: Ctx) => Promise<string | void>): Promise<ActionResult> {
  const code = normalizeCode(String(rawCode));
  const player = await getPlayer(code);
  if (!player) return { ok: false, error: "You're not in this room anymore." };
  try {
    const error = await withTx(async (client) => {
      const room = await lockRoom(client, code);
      if (!room) return "This room no longer exists.";
      return fn({ client, room, playerId: player.id });
    });
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    console.error("[action]", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function updateSettings(code: string, settings: { mode?: string; rounds?: number }) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.host_id !== playerId) return "Only the host can change settings.";
    if (room.phase !== "lobby") return "Settings are locked once the game starts.";
    const mode = modeSchema.safeParse(settings.mode);
    const rounds = ROUND_OPTIONS.includes(settings.rounds as never) ? settings.rounds : undefined;
    await client.query(
      "UPDATE rooms SET mode = COALESCE($2, mode), total_rounds = COALESCE($3, total_rounds), updated_at = now() WHERE code = $1",
      [room.code, mode.success ? mode.data : null, rounds ?? null],
    );
  });
}

export async function startGame(code: string) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.host_id !== playerId) return "Only the host can start.";
    if (room.phase !== "lobby" && room.phase !== "final") return "The game is already running.";
    const { rows } = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM players WHERE room_code = $1",
      [room.code],
    );
    if (room.mode === "clue" && rows[0].count < 2) return "Clue mode needs at least 2 players.";
    await client.query("UPDATE players SET score = 0 WHERE room_code = $1", [room.code]);
    await client.query("DELETE FROM guesses WHERE room_code = $1", [room.code]);
    await startNextRound(client, { ...room, round_no: 0 });
  });
}

export async function backToLobby(code: string) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.host_id !== playerId) return "Only the host can do that.";
    await client.query(
      `UPDATE rooms SET phase = 'lobby', round_no = 0, giver_id = NULL, clue1 = NULL, clue2 = NULL,
         target_cell = NULL, target_h = NULL, target_s = NULL, target_l = NULL, giver_points = NULL,
         phase_ends_at = NULL, updated_at = now() WHERE code = $1`,
      [room.code],
    );
    await client.query("UPDATE players SET score = 0 WHERE room_code = $1", [room.code]);
    await client.query("DELETE FROM guesses WHERE room_code = $1", [room.code]);
  });
}

export async function submitClue(code: string, raw: string) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.giver_id !== playerId) return "You're not the clue giver this round.";
    if (room.phase !== "clue1" && room.phase !== "clue2") return "It's not time for a clue.";
    const first = room.phase === "clue1";
    const clue = cleanClue(String(raw), first ? 1 : 2);
    if (!clue) return first ? "Your first clue is a single word." : "Your second clue is one or two words.";
    await client.query(
      `UPDATE rooms SET ${first ? "clue1" : "clue2"} = $2, phase = $3, updated_at = now() WHERE code = $1`,
      [room.code, clue, first ? "guess1" : "guess2"],
    );
  });
}

export async function placeMarker(code: string, cell: number) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.mode !== "clue" || (room.phase !== "guess1" && room.phase !== "guess2")) return "Not time to guess.";
    if (room.giver_id === playerId) return "The clue giver doesn't guess.";
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return "That's not on the board.";
    const slot = room.phase === "guess2" ? 2 : 1;
    const taken = await client.query("SELECT 1 FROM guesses WHERE room_code = $1 AND round_no = $2 AND cell = $3", [
      room.code,
      room.round_no,
      cell,
    ]);
    if (taken.rowCount) return "Someone already claimed that square.";
    const inserted = await client.query(
      `INSERT INTO guesses (room_code, round_no, player_id, slot, cell) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [room.code, room.round_no, playerId, slot, cell],
    );
    if (!inserted.rowCount) return "You already placed this marker.";
    await advanceIfAllIn(client, room);
  });
}

export async function submitMix(code: string, hsl: { h: number; s: number; l: number }) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.mode !== "recall" || room.phase !== "mix") return "Mixing is closed.";
    const parsed = z
      .object({
        h: z.number().int().min(0).max(359),
        s: z.number().int().min(0).max(100),
        l: z.number().int().min(0).max(100),
      })
      .safeParse(hsl);
    if (!parsed.success) return "That color doesn't look right.";
    await client.query(
      `INSERT INTO guesses (room_code, round_no, player_id, slot, h, s, l) VALUES ($1, $2, $3, 1, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [room.code, room.round_no, playerId, parsed.data.h, parsed.data.s, parsed.data.l],
    );
    await advanceIfAllIn(client, room);
  });
}

/** Any client may call this when a timer runs out. It only acts if the deadline has really passed. */
export async function timerElapsed(code: string, phase: string, roundNo: number) {
  return inRoom(code, async ({ client, room }) => {
    if (room.phase !== phase || room.round_no !== roundNo) return;
    if (!room.phase_ends_at || room.phase_ends_at.getTime() > Date.now()) return;
    if (room.phase === "memorize") await startMix(client, room.code);
    else if (room.phase === "mix") await reveal(client, room);
  });
}

export async function skipAhead(code: string, phase: string) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.host_id !== playerId) return "Only the host can skip ahead.";
    if (room.phase !== phase) return;
    await skipPhase(client, room);
  });
}

export async function nextRound(code: string, roundNo: number) {
  return inRoom(code, async ({ client, room, playerId }) => {
    if (room.host_id !== playerId) return "Only the host can start the next round.";
    if (room.phase !== "reveal" || room.round_no !== roundNo) return;
    await startNextRound(client, room);
  });
}

export async function takeOverHost(code: string) {
  return inRoom(code, async ({ client, room, playerId }) => {
    const { rows } = await client.query<{ last_seen: Date }>("SELECT last_seen FROM players WHERE id = $1", [
      room.host_id,
    ]);
    const hostAway = !rows[0] || Date.now() - rows[0].last_seen.getTime() > AWAY_AFTER_MS;
    if (!hostAway) return "The host is still here.";
    await client.query("UPDATE rooms SET host_id = $2, updated_at = now() WHERE code = $1", [room.code, playerId]);
  });
}

export async function leaveRoom(code: string) {
  const normalized = normalizeCode(code);
  const result = await inRoom(normalized, async ({ client, room, playerId }) => {
    await client.query("DELETE FROM players WHERE id = $1", [playerId]);
    const { rows } = await client.query<{ id: string }>(
      "SELECT id::text AS id FROM players WHERE room_code = $1 ORDER BY seat",
      [room.code],
    );
    if (rows.length === 0) {
      await client.query("DELETE FROM rooms WHERE code = $1", [room.code]);
      return;
    }
    if (room.host_id === playerId) {
      await client.query("UPDATE rooms SET host_id = $2 WHERE code = $1", [room.code, rows[0].id]);
    }
    const midRound = ["clue1", "guess1", "clue2", "guess2"].includes(room.phase);
    if (room.giver_id === playerId && midRound) {
      await reveal(client, { ...room, giver_id: null });
    } else if (["guess1", "guess2", "mix"].includes(room.phase)) {
      await advanceIfAllIn(client, room);
    }
  });
  await clearPlayerCookie(normalized);
  if (!result.ok) return result;
  redirect("/");
}
