"use client";

import { useSyncExternalStore } from "react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";

const subscribeNever = () => () => {};

/**
 * False while React is hydrating server-rendered HTML, true afterwards (and always true for
 * components mounted by client-side navigation). useSyncExternalStore uses the server snapshot
 * during hydration, which is what makes this reliable.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * Drop-in replacement for TanStack Query's useQuery, used for every query in the app.
 *
 * Why: the server prerenders /app pages without any user data, so every query renders its
 * loading state in the HTML. React hydrates each Suspense boundary separately; if a request
 * (say, /auth/me) completes between two of those steps, a boundary hydrated afterwards would
 * read the filled cache and render different text than the server did, a hydration mismatch.
 * During hydration this hook therefore reports the same "pending, no data" state the server
 * rendered; one render later it returns the real result. On client-side navigation nothing is
 * hydrating, so cached data shows immediately.
 */
export const useQuery = ((options: Parameters<typeof useTanstackQuery>[0]) => {
  const hydrated = useHydrated();
  const result = useTanstackQuery(options);
  if (hydrated) return result;
  return {
    ...result,
    data: undefined,
    error: null,
    status: "pending",
    isPending: true,
    isLoading: true,
    isSuccess: false,
    isError: false,
    isPlaceholderData: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
  };
}) as typeof useTanstackQuery;
