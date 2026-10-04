import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** A shared room link: signing in first should come back to it. */
const ROOM_PAGE = /^\/rooms\/[A-Za-z0-9-]{1,20}$/;

export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (!signedIn && ROOM_PAGE.test(pathname) && pathname !== "/rooms/new") {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
