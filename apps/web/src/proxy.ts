import { NextResponse, type NextRequest } from "next/server";

/** Name of the ASP.NET Core auth cookie (see SecurityServiceCollectionExtensions.AuthCookieName). */
const AUTH_COOKIE = "devflow.auth";

/**
 * Server-only (never NEXT_PUBLIC_). When set, /api and /hubs are proxied from here instead of
 * by next.config.ts rewrites, so each request can carry the secret and the visitor's IP. The API
 * (ProxyGateMiddleware, Proxy:SharedSecret) rejects anything without the secret. Used on hosts
 * whose proxy addresses are not fixed, like Vercel; local and Docker setups leave it unset.
 */
const proxySecret = process.env.PROXY_SHARED_SECRET;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/") || pathname.startsWith("/hubs/")) {
    // Without a secret, next.config.ts rewrites forward the request as before.
    if (!proxySecret) return NextResponse.next();

    const headers = new Headers(request.headers);
    headers.set("X-DevFlow-Proxy-Secret", proxySecret);
    // The platform's edge sets these from the real connection, overwriting anything a client sent.
    const clientIp = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (clientIp) headers.set("X-DevFlow-Client-IP", clientIp);
    else headers.delete("X-DevFlow-Client-IP");

    const target = new URL(pathname + search, process.env.API_BASE_URL);
    return NextResponse.rewrite(target, { request: { headers } });
  }

  // Optimistic route protection: visitors without a session cookie are sent to /login before any
  // /app page renders. It cannot tell whether a cookie is still valid. The API checks that on
  // every request, and the app shell redirects to /login if the API answers 401.
  if (request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/onboarding", "/api/:path*", "/hubs/:path*"],
};
