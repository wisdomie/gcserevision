import { z } from "zod";
import { ApiError, errorResponse, requireUserId } from "@/lib/api/handler";
import { getReveal } from "@/lib/game/room-server";

/** Answers and solutions, only for questions that have closed. `?idx=` picks the question. */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[code]/reveal">) {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const idx = z.coerce
      .number()
      .int()
      .min(0)
      .max(100)
      .safeParse(new URL(request.url).searchParams.get("idx"));
    if (!idx.success) throw new ApiError(400, "Invalid request");
    return Response.json(await getReveal(userId, code, idx.data));
  } catch (error) {
    return errorResponse(error);
  }
}
