import { errorResponse, requireUserId } from "@/lib/api/handler";
import { startRoom } from "@/lib/game/room-server";

export async function POST(_request: Request, ctx: RouteContext<"/api/rooms/[code]/start">) {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    return Response.json(await startRoom(userId, code));
  } catch (error) {
    return errorResponse(error);
  }
}
