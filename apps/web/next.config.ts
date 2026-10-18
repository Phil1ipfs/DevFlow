import type { NextConfig } from "next";

// Server-only: where the ASP.NET Core API listens. Not prefixed with NEXT_PUBLIC_,
// so it is never shipped to the browser. Rewrites are resolved at `next build`,
// so production builds (including Docker images) must have it set at build time.
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:5270";
const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy without nonces. Nonces would force every page to render dynamically,
 * which rules out DevFlow's prerendered static shells (see the Next.js CSP guide), so scripts
 * allow 'unsafe-inline' for Next's inline bootstrap and the theme script. Everything else is
 * locked down: same-origin only, no plugins, no framing, no foreign form targets.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // 'self' covers the same-origin API and the SignalR WebSocket.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle for the Docker image (node .next/standalone/server.js).
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  // The browser only ever talks to this Next.js origin; /api/* is proxied to ASP.NET Core.
  // Same-origin requests mean no CORS setup, and auth cookies stay first-party.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      // SignalR (real-time notifications) also goes through the same origin, so the session
      // cookie is sent automatically. SignalR falls back to SSE/long polling if WebSockets
      // cannot pass through the proxy.
      {
        source: "/hubs/:path*",
        destination: `${apiBaseUrl}/hubs/:path*`,
      },
    ];
  },
};

export default nextConfig;
