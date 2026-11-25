import { normalizeCode } from "@/lib/game";
import { getPool } from "@/lib/server/db";
import { getPlayer } from "@/lib/server/session";

const noStore = { "Cache-Control": "private, no-store" };

// The clue giver's view of the target. Nobody else gets it before the reveal.
export async function GET(_request: Request, ctx: RouteContext<"/api/rooms/[code]/secret">) {
  const code = normalizeCode((await ctx.params).code);
  const player = await getPlayer(code);
  if (!player) return Response.json({ error: "NOT_IN_ROOM" }, { status: 401, headers: noStore });
  const { rows } = await getPool().query<{ target_cell: number; round_no: number }>(
    `SELECT target_cell, round_no FROM rooms
     WHERE code = $1 AND giver_id = $2 AND phase IN ('clue1', 'guess1', 'clue2', 'guess2')`,
    [code, player.id],
  );
  if (!rows[0]) return Response.json({ error: "NOT_GIVER" }, { status: 403, headers: noStore });
  return Response.json(rows[0], { headers: noStore });
}
