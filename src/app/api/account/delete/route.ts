import { z } from "zod";
import { errorResponse, readJson, requireUserId } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DeleteSchema = z.object({ confirm: z.literal("DELETE") });

/**
 * Deletes the signed-in user's account. Removing the auth user cascades to
 * their profile, sessions, answers, stats and room memberships (PLAN.md 11).
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    await readJson(request, DeleteSchema);

    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    if (error) throw error;

    // Clear the session cookies on this device
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
