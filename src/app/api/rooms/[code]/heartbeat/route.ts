import { normalizeCode } from "@/lib/game";
import { getPool } from "@/lib/server/db";
import { getPlayer } from "@/lib/server/session";

// Keeps last_seen fresh so away players don't stall a round.
export async function POST(_request: Request, ctx: RouteContext<"/api/rooms/[code]/heartbeat">) {
  const code = normalizeCode((await ctx.params).code);
  const player = await getPlayer(code);
  if (!player) return Response.json({ error: "NOT_IN_ROOM" }, { status: 401 });
  await getPool().query("UPDATE players SET last_seen = now() WHERE id = $1", [player.id]);
  return Response.json({ ok: true, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
