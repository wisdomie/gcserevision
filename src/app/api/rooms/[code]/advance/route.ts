import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { FromIndexSchema } from "@/lib/game/room";
import { advanceRoom } from "@/lib/game/room-server";

/** Any player can close a question, so a host who leaves can't stall the game. Idempotent. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/advance">) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("roomNudge", userId, request);
    const { code } = await ctx.params;
    const { fromIndex } = await readJson(request, FromIndexSchema);
    return Response.json(await advanceRoom(userId, code, fromIndex));
  } catch (error) {
    return errorResponse(error);
  }
}
