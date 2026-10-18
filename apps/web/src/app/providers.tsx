"use client";

import type { ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isApiError } from "@/lib/api/client";

let browserQueryClient: QueryClient | undefined;

/** Inside the app, a 401 means the session expired or was revoked: go sign in again. */
function redirectToLoginOn401(error: unknown) {
  if (typeof window === "undefined" || !isApiError(error, 401)) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith("/app")) {
    // Deliberately a full page load rather than router.push: it discards every piece of
    // in-memory state from the expired session. (This runs outside React, so no router anyway.)
    const login = new URL("/login", window.location.origin);
    login.searchParams.set("next", pathname + search);
    window.location.assign(login.href);
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: redirectToLoginOn401 }),
    mutationCache: new MutationCache({ onError: redirectToLoginOn401 }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (4xx) will not fix themselves on retry.
        retry: (failureCount, error) =>
          !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  });
}

function getQueryClient() {
  // Keep server renders isolated and preserve the browser cache across renders.
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <TooltipProvider delayDuration={200}>
        {/* Before {children}: the toaster is fixed-position so DOM order does not matter, and
            in dev mode Next appends its own script after the page content, which otherwise
            trips hydration on whatever element follows {children}. */}
        <Toaster position="bottom-right" richColors closeButton />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
