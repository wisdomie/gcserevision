import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { SoloAnswerSchema } from "@/lib/game/solo";
import { submitSoloAnswer } from "@/lib/game/solo-server";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = await readJson(request, SoloAnswerSchema);
    return Response.json(await submitSoloAnswer(userId, input));
  } catch (error) {
    return errorResponse(error);
  }
}
