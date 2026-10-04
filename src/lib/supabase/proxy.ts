import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session on each request and writes any updated
 * auth cookies onto the response. Called from `src/proxy.ts`. Also says
 * whether the request is signed in.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; signedIn: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without configuration (e.g. a preview build with no env) there is no
  // session to refresh, so let the request through.
  if (!url || !anonKey) return { response: NextResponse.next({ request }), signedIn: false };

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between creating the client and this call: it validates
  // the JWT and triggers the token refresh.
  const { data } = await supabase.auth.getClaims();

  return { response, signedIn: typeof data?.claims?.sub === "string" };
}
