import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/api/redirect";
import { createClient } from "@/lib/supabase/server";

/** Completes an email sign-in link (PKCE code exchange), then continues to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/play";
  const safeNext = safeRedirectPath(next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
