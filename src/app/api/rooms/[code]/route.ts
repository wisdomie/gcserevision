import { errorResponse, requireUserId } from "@/lib/api/handler";
import { getRoomState } from "@/lib/game/room-server";

export async function GET(_request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    return Response.json(await getRoomState(userId, code));
  } catch (error) {
    return errorResponse(error);
  }
}
