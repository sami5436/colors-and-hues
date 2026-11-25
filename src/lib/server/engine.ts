import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";

import {
  AWAY_AFTER_MS,
  CELL_COUNT,
  cluePoints,
  MEMORIZE_MS,
  MIX_MS,
  recallPoints,
  type Mode,
  type Phase,
} from "../game";

export type LockedRoom = {
  code: string;
  mode: Mode;
  phase: Phase;
  round_no: number;
  total_rounds: number;
  host_id: string | null;
  giver_id: string | null;
  target_cell: number | null;
  target_h: number | null;
  target_s: number | null;
  target_l: number | null;
  phase_ends_at: Date | null;
};

export async function lockRoom(client: PoolClient, code: string) {
  const { rows } = await client.query<LockedRoom>(
    `SELECT code, mode, phase, round_no, total_rounds, host_id::text AS host_id, giver_id::text AS giver_id,
            target_cell, target_h, target_s, target_l, phase_ends_at
     FROM rooms WHERE code = $1 FOR UPDATE`,
    [code],
  );
  return rows[0] ?? null;
}

async function seatedPlayers(client: PoolClient, code: string) {
  const { rows } = await client.query<{ id: string; last_seen: Date }>(
    "SELECT id::text AS id, last_seen FROM players WHERE room_code = $1 ORDER BY seat",
    [code],
  );
  return rows;
}

const isActive = (lastSeen: Date) => Date.now() - lastSeen.getTime() < AWAY_AFTER_MS;

/** Begin the next round, or finish the game when all rounds are played. */
export async function startNextRound(client: PoolClient, room: LockedRoom) {
  const roundNo = room.round_no + 1;
  if (roundNo > room.total_rounds) {
    await client.query("UPDATE rooms SET phase = 'final', phase_ends_at = NULL, updated_at = now() WHERE code = $1", [
      room.code,
    ]);
    return;
  }

  if (room.mode === "clue") {
    const players = await seatedPlayers(client, room.code);
    const active = players.filter((p) => isActive(p.last_seen));
    const pool = active.length >= 2 ? active : players;
    const giver = pool[(roundNo - 1) % pool.length];
    await client.query(
      `UPDATE rooms SET phase = 'clue1', round_no = $2, giver_id = $3, target_cell = $4,
         target_h = NULL, target_s = NULL, target_l = NULL,
         clue1 = NULL, clue2 = NULL, giver_points = NULL, phase_ends_at = NULL, updated_at = now()
       WHERE code = $1`,
      [room.code, roundNo, giver.id, randomInt(CELL_COUNT)],
    );
  } else {
    await client.query(
      `UPDATE rooms SET phase = 'memorize', round_no = $2, giver_id = NULL, target_cell = NULL,
         target_h = $3, target_s = $4, target_l = $5,
         clue1 = NULL, clue2 = NULL, giver_points = NULL,
         phase_ends_at = now() + make_interval(secs => $6), updated_at = now()
       WHERE code = $1`,
      [room.code, roundNo, randomInt(360), 30 + randomInt(61), 28 + randomInt(48), MEMORIZE_MS / 1000],
    );
  }
}

export async function setPhase(client: PoolClient, code: string, phase: Phase, endsInMs?: number) {
  await client.query(
    `UPDATE rooms SET phase = $2,
       phase_ends_at = CASE WHEN $3::int IS NULL THEN NULL ELSE now() + make_interval(secs => $3::int / 1000.0) END,
       updated_at = now()
     WHERE code = $1`,
    [code, phase, endsInMs ?? null],
  );
}

export const startMix = (client: PoolClient, code: string) => setPhase(client, code, "mix", MIX_MS);

/** Score the round and move to the reveal. */
export async function reveal(client: PoolClient, room: LockedRoom) {
  const { rows: guesses } = await client.query<{
    player_id: string;
    slot: number;
    cell: number | null;
    h: number | null;
    s: number | null;
    l: number | null;
  }>(
    `SELECT player_id::text AS player_id, slot, cell, h, s, l FROM guesses
     WHERE room_code = $1 AND round_no = $2`,
    [room.code, room.round_no],
  );

  const best = new Map<string, number>();
  for (const g of guesses) {
    let points = 0;
    if (room.mode === "clue" && g.cell !== null && room.target_cell !== null) {
      points = cluePoints(g.cell, room.target_cell);
    } else if (
      room.mode === "recall" &&
      g.h !== null &&
      g.s !== null &&
      g.l !== null &&
      room.target_h !== null &&
      room.target_s !== null &&
      room.target_l !== null
    ) {
      points = recallPoints([g.h, g.s, g.l], [room.target_h, room.target_s, room.target_l]);
    }
    best.set(g.player_id, Math.max(best.get(g.player_id) ?? 0, points));
    await client.query(
      "UPDATE guesses SET points = $5 WHERE room_code = $1 AND round_no = $2 AND player_id = $3 AND slot = $4",
      [room.code, room.round_no, g.player_id, g.slot, points],
    );
  }

  for (const [playerId, points] of best) {
    if (points > 0) {
      await client.query("UPDATE players SET score = score + $2 WHERE id = $1", [playerId, points]);
    }
  }

  // The clue giver earns the average of what the guessers scored.
  let giverPoints: number | null = null;
  if (room.mode === "clue" && room.giver_id && best.size > 0) {
    const values = [...best.values()];
    giverPoints = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    if (giverPoints > 0) {
      await client.query("UPDATE players SET score = score + $2 WHERE id = $1", [room.giver_id, giverPoints]);
    }
  }

  await client.query(
    "UPDATE rooms SET phase = 'reveal', giver_points = $2, phase_ends_at = NULL, updated_at = now() WHERE code = $1",
    [room.code, giverPoints],
  );
}

/** After a guess lands, move on once every active guesser has placed for this slot. */
export async function advanceIfAllIn(client: PoolClient, room: LockedRoom) {
  const slot = room.phase === "guess2" ? 2 : 1;
  const players = await seatedPlayers(client, room.code);
  const guessers = players.filter((p) => p.id !== room.giver_id);
  const { rows } = await client.query<{ player_id: string }>(
    "SELECT player_id::text AS player_id FROM guesses WHERE room_code = $1 AND round_no = $2 AND slot = $3",
    [room.code, room.round_no, slot],
  );
  const placed = new Set(rows.map((r) => r.player_id));
  const waiting = guessers.filter((p) => !placed.has(p.id) && isActive(p.last_seen));
  if (waiting.length > 0) return;

  if (room.phase === "guess1") await setPhase(client, room.code, "clue2");
  else await reveal(client, room);
}

/** Host override for a stuck phase (an away player, a giver who walked off). */
export async function skipPhase(client: PoolClient, room: LockedRoom) {
  switch (room.phase) {
    case "clue1":
    case "guess2":
    case "mix":
      return reveal(client, room);
    case "guess1":
      return setPhase(client, room.code, "clue2");
    case "clue2":
      return setPhase(client, room.code, "guess2");
    case "memorize":
      return startMix(client, room.code);
    default:
      return;
  }
}
