import { NextResponse, type NextRequest } from "next/server";

/** Name of the ASP.NET Core auth cookie (see SecurityServiceCollectionExtensions.AuthCookieName). */
const AUTH_COOKIE = "devflow.auth";

/**
 * Optimistic route protection: visitors without a session cookie are sent to /login before any
 * /app page renders. It cannot tell whether a cookie is still valid. The API checks that on
 * every request, and the app shell redirects to /login if the API answers 401.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/onboarding"],
};
