import "server-only";
import { createClient } from "./server";

/** The signed-in user's id (verified JWT `sub`), or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
