import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** Supabase client for Client Components. Uses the anon key and the user's session cookie. */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
