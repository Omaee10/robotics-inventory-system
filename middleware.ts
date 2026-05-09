import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Many people try /app in the browser because the Next.js source directory is
 * named `app/`. That URL has no route and would 404 — send them to the real paths.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  if (path === "/app" || path === "/app/") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/app/")) {
    url.pathname = path.slice(4) || "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
