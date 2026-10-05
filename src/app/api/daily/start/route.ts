import { errorResponse, requireUserId } from "@/lib/api/handler";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { startDaily } from "@/lib/game/daily-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("startSession", userId, request);
    return Response.json(await startDaily(userId), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
