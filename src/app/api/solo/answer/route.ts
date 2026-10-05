import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { SoloAnswerSchema } from "@/lib/game/solo";
import { submitSoloAnswer } from "@/lib/game/solo-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("answer", userId, request);
    const input = await readJson(request, SoloAnswerSchema);
    return Response.json(await submitSoloAnswer(userId, input));
  } catch (error) {
    return errorResponse(error);
  }
}
