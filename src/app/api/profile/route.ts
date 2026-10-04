import { ApiError, errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { ProfileInputSchema } from "@/lib/profile/schema";
import { checkUsername } from "@/lib/profile/username";
import { createClient } from "@/lib/supabase/server";

/** Create or update the signed-in user's own profile. Runs as the user, so RLS applies. */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = await readJson(request, ProfileInputSchema);
    const usernameCheck = checkUsername(input.username);
    if (!usernameCheck.ok) throw new ApiError(400, usernameCheck.reason);

    const supabase = await createClient();
    const { data: board, error: boardError } = await supabase
      .from("exam_boards")
      .select("id")
      .eq("slug", input.board)
      .single();
    if (boardError || !board) throw new ApiError(400, "Unknown exam board.");

    const fields = {
      username: input.username,
      avatar: input.avatar,
      exam_board_id: board.id,
      tier: input.tier,
    };
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw readError;

    const { error } = existing
      ? await supabase.from("profiles").update(fields).eq("id", userId)
      : await supabase.from("profiles").insert({ id: userId, ...fields });
    if (error) {
      if (error.code === "23505")
        throw new ApiError(409, "That username is taken. Try another one.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
