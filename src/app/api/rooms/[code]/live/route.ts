import { normalizeCode } from "@/lib/game";
import { sealRoom } from "@/lib/server/realtime";
import { getPlayer } from "@/lib/server/session";

const noStore = { "Cache-Control": "private, no-store" };

// Renews the sealed room query. Members only: the sealed query is a bearer token for the room.
export async function POST(_request: Request, ctx: RouteContext<"/api/rooms/[code]/live">) {
  const code = normalizeCode((await ctx.params).code);
  const player = await getPlayer(code);
  if (!player) return Response.json({ error: "NOT_IN_ROOM" }, { status: 401, headers: noStore });
  return Response.json(await sealRoom(code), { headers: noStore });
}
