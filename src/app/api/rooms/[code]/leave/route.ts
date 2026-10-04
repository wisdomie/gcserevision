import { errorResponse, requireUserId } from "@/lib/api/handler";
import { leaveRoom } from "@/lib/game/room-server";

export async function POST(_request: Request, ctx: RouteContext<"/api/rooms/[code]/leave">) {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    return Response.json(await leaveRoom(userId, code));
  } catch (error) {
    return errorResponse(error);
  }
}
