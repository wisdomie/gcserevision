import { errorResponse, requireUserId } from "@/lib/api/handler";
import { getDailyOverview } from "@/lib/game/daily-server";

export async function GET() {
  try {
    const userId = await requireUserId();
    return Response.json(await getDailyOverview(userId));
  } catch (error) {
    return errorResponse(error);
  }
}
