import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { SoloStartSchema } from "@/lib/game/solo";
import { startSoloSession } from "@/lib/game/solo-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("startSession", userId, request);
    const input = await readJson(request, SoloStartSchema);
    return Response.json(await startSoloSession(userId, input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
