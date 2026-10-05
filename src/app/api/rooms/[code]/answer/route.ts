import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { RoomAnswerSchema } from "@/lib/game/room";
import { submitRoomAnswer } from "@/lib/game/room-server";

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/answer">) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("answer", userId, request);
    const { code } = await ctx.params;
    const input = await readJson(request, RoomAnswerSchema);
    return Response.json(await submitRoomAnswer(userId, code, input));
  } catch (error) {
    return errorResponse(error);
  }
}
