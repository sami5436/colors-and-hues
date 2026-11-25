import "server-only";

import { createRealtime, rawSql } from "@neon/realtime/server";

import type { RoomRow } from "../room-types";
import { getPool } from "./db";

let realtime: ReturnType<typeof createRealtime> | undefined;

function getRealtime() {
  if (!realtime) {
    const secret = process.env.NEON_REALTIME_SECRET;
    const url = process.env.DATABASE_URL;
    if (!secret || !url) throw new Error("NEON_REALTIME_SECRET and DATABASE_URL must be set");
    realtime = createRealtime({
      secret,
      db: new URL(url).pathname.slice(1),
      debugMode: process.env.NODE_ENV === "development",
    });
  }
  return realtime;
}

export function realtimeUrl() {
  const url = process.env.NEON_REALTIME_URL;
  if (!url) throw new Error("NEON_REALTIME_URL is not set");
  return url.replace(/^http/, "ws");
}

// The single live query behind a room. Secrets are masked by phase inside the SQL,
// so the target never reaches guessers before the reveal.
const ROOM_SQL = `
SELECT
  r.code, r.mode, r.phase, r.round_no, r.total_rounds,
  r.host_id::text AS host_id, r.giver_id::text AS giver_id,
  r.clue1, r.clue2, r.giver_points, r.phase_ends_at,
  CASE WHEN r.phase IN ('reveal', 'final') THEN r.target_cell END AS target_cell,
  CASE WHEN r.phase IN ('reveal', 'final', 'memorize') THEN r.target_h END AS target_h,
  CASE WHEN r.phase IN ('reveal', 'final', 'memorize') THEN r.target_s END AS target_s,
  CASE WHEN r.phase IN ('reveal', 'final', 'memorize') THEN r.target_l END AS target_l,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'seat', p.seat, 'score', p.score, 'last_seen', p.last_seen
    ) ORDER BY p.seat)
    FROM players p WHERE p.room_code = r.code
  ), '[]'::jsonb) AS players,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'player_id', g.player_id,
      'slot', g.slot,
      'cell', CASE WHEN r.mode = 'clue' OR r.phase IN ('reveal', 'final') THEN g.cell END,
      'h', CASE WHEN r.phase IN ('reveal', 'final') THEN g.h END,
      's', CASE WHEN r.phase IN ('reveal', 'final') THEN g.s END,
      'l', CASE WHEN r.phase IN ('reveal', 'final') THEN g.l END,
      'points', g.points
    ) ORDER BY g.player_id, g.slot)
    FROM guesses g WHERE g.room_code = r.code AND g.round_no = r.round_no
  ), '[]'::jsonb) AS guesses
FROM rooms r
WHERE r.code = $1`;

const roomQuery = (code: string) => rawSql<RoomRow>(ROOM_SQL, [code]);

export const sealRoom = (code: string) => getRealtime().seal({ query: roomQuery(code) });

export async function loadRoom(code: string) {
  const [result, sealedQuery] = await Promise.all([getPool().query<RoomRow>(ROOM_SQL, [code]), sealRoom(code)]);
  return { row: result.rows[0] ?? null, sealedQuery };
}
