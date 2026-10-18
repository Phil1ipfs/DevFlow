"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth/auth-api";

/**
 * Watches the session for the /app shell. proxy.ts already redirects visitors with no cookie;
 * this handles an expired or revoked cookie by sending the user to /login.
 *
 * It does not hide the page while the session loads. Pages hold no data of their own: every
 * piece of data comes from the API, which enforces authentication on each request. Rendering the
 * page structure immediately keeps it in the prerendered shell, so navigation stays instant.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { signedOut, isError, error, refetch } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    // Read the path inside the effect (browser only) rather than via usePathname(), which would
    // make every /app page with a dynamic param wait for request-time data.
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [signedOut, router]);

  return (
    <>
      {isError && !signedOut && (
        <div role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">We couldn&apos;t load your account.</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <button type="button" onClick={() => refetch()} className="mt-2 font-medium text-primary hover:underline">
            Try again
          </button>
        </div>
      )}
      {children}
    </>
  );
}
