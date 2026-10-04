import { z } from "zod";
import { ApiError, errorResponse, requireUserId } from "@/lib/api/handler";
import { getSoloState } from "@/lib/game/solo-server";

export async function GET(_request: Request, ctx: RouteContext<"/api/solo/[sessionId]">) {
  try {
    const userId = await requireUserId();
    const { sessionId } = await ctx.params;
    if (!z.uuid().safeParse(sessionId).success)
      throw new ApiError(404, "We couldn't find that practice session.");
    return Response.json(await getSoloState(userId, sessionId));
  } catch (error) {
    return errorResponse(error);
  }
}
