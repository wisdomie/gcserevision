import { errorResponse, requireUserId } from "@/lib/api/handler";
import { startDaily } from "@/lib/game/daily-server";

export async function POST() {
  try {
    const userId = await requireUserId();
    return Response.json(await startDaily(userId), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
