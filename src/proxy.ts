import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "qulearn_session";

/**
 * Optimistic check only: requests without a session cookie go straight to the
 * login page. The real verification happens in the layouts, pages and services
 * (see src/server/auth), never here.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, Next.js internals and static files.
  matcher: ["/((?!login|sw.js|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)$).*)"],
};
