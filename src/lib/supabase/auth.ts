import "server-only";
import { createClient } from "./server";

/** The signed-in user's id (verified JWT `sub`), or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

export interface AuthInfo {
  userId: string;
  /** Quick-play account with no email yet. */
  isAnonymous: boolean;
  email: string | null;
}

/** The signed-in user's id, whether they are anonymous, and their email, or null. */
export async function getAuth(): Promise<AuthInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (typeof claims?.sub !== "string") return null;
  return {
    userId: claims.sub,
    isAnonymous: claims.is_anonymous === true,
    email: typeof claims.email === "string" && claims.email ? claims.email : null,
  };
}
