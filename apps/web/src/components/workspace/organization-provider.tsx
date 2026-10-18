"use client";

import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useHydrated, useQuery } from "@/lib/query";
import { hasRole, organizationsQuery, type Organization } from "@/lib/api/organizations";
import { useLocalStorage } from "@/lib/use-local-storage";

const ACTIVE_ORG_KEY = "devflow-active-organization";

type OrganizationContextValue = {
  organizations: Organization[] | undefined;
  /** The workspace the user is working in, or null while loading / when they have none. */
  active: Organization | null;
  isLoading: boolean;
  isAdmin: boolean;
  setActive: (organizationId: string) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * Tracks which organization the user is working in. The choice is remembered per browser;
 * the API still checks membership on every request, so this is a convenience, not security.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: organizations, isPending, isFetching } = useQuery(organizationsQuery);
  const [storedId, setStoredId] = useLocalStorage(ACTIVE_ORG_KEY);

  const active = useMemo(
    () => organizations?.find((o) => o.id === storedId) ?? organizations?.[0] ?? null,
    [organizations, storedId],
  );

  // New users (or users removed from every workspace) start by creating one. Only act on a
  // settled answer: a cached empty list may be mid-refetch right after joining or creating one.
  useEffect(() => {
    if (organizations?.length === 0 && !isFetching) router.replace("/onboarding");
  }, [organizations, isFetching, router]);

  const setActive = useCallback((organizationId: string) => setStoredId(organizationId), [setStoredId]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      active,
      isLoading: isPending,
      isAdmin: hasRole(active?.role, "Admin"),
      setActive,
    }),
    [organizations, active, isPending, setActive],
  );

  return <OrganizationContext value={value}>{children}</OrganizationContext>;
}

/** What every consumer sees while it is still hydrating: the same "loading" state the server rendered. */
const HYDRATING: OrganizationContextValue = {
  organizations: undefined,
  active: null,
  isLoading: true,
  isAdmin: false,
  setActive: () => {},
};

export function useOrganization() {
  const context = use(OrganizationContext);
  // The provider near the root hydrates early and then re-renders with real data. A Suspense
  // boundary that hydrates later would receive that data through context and render different
  // text than the server did (a hydration mismatch). So consumers report "loading" until they
  // themselves have hydrated, exactly like the useQuery wrapper does for direct queries.
  const hydrated = useHydrated();
  if (!context) throw new Error("useOrganization must be used inside OrganizationProvider");
  return hydrated ? context : HYDRATING;
}

/** Remembers the active workspace before navigating, so pages open in the right context. */
export function useSwitchOrganization() {
  const [, setStoredId] = useLocalStorage(ACTIVE_ORG_KEY);
  return setStoredId;
}
