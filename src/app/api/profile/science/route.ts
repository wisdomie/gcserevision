import { ApiError, errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { ScienceInputSchema } from "@/lib/profile/science";
import { createClient } from "@/lib/supabase/server";

/** Set the signed-in user's science board, tier and course. Runs as the user, so RLS applies. */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = await readJson(request, ScienceInputSchema);
    const supabase = await createClient();
    const { data: board, error: boardError } = await supabase
      .from("exam_boards")
      .select("id")
      .eq("slug", input.board)
      .single();
    if (boardError || !board) throw new ApiError(400, "Unknown exam board.");

    const { data, error } = await supabase
      .from("profiles")
      .update({
        science_board_id: board.id,
        science_tier: input.tier,
        science_course: input.course,
      })
      .eq("id", userId)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new ApiError(409, "Finish setting up your profile first.");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
