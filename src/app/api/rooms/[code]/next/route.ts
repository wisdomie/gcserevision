import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { FromIndexSchema } from "@/lib/game/room";
import { nextInRoom } from "@/lib/game/room-server";

/** Any player can move on after the reveal. Idempotent. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/next">) {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const { fromIndex } = await readJson(request, FromIndexSchema);
    return Response.json(await nextInRoom(userId, code, fromIndex));
  } catch (error) {
    return errorResponse(error);
  }
}
