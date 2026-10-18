"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@/lib/query";
import { api, isApiError, resetCsrfToken } from "@/lib/api/client";

export type CurrentUser = { id: string; email: string; displayName: string };

export const currentUserQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: ({ signal }) => api<CurrentUser>("/api/v1/auth/me", { signal }),
  retry: (failureCount, error) => !isApiError(error, 401) && failureCount < 2,
  staleTime: 5 * 60_000,
});

/** The signed-in user, or `null` when nobody is signed in. */
export function useCurrentUser() {
  const query = useQuery(currentUserQuery);
  const signedOut = isApiError(query.error, 401);
  return { ...query, user: signedOut ? null : query.data, signedOut };
}

function useSessionChange() {
  const queryClient = useQueryClient();
  return (user: CurrentUser | null) => {
    resetCsrfToken();
    // Nothing cached for one user may be shown to the next.
    queryClient.clear();
    if (user) queryClient.setQueryData(currentUserQuery.queryKey, user);
  };
}

export function useLogin() {
  const onSessionChange = useSessionChange();
  return useMutation({
    mutationFn: (input: { email: string; password: string; rememberMe: boolean }) =>
      api<CurrentUser>("/api/v1/auth/login", { method: "POST", body: input }),
    onSuccess: onSessionChange,
  });
}

export function useRegister() {
  const onSessionChange = useSessionChange();
  return useMutation({
    mutationFn: (input: { displayName: string; email: string; password: string }) =>
      api<CurrentUser>("/api/v1/auth/register", { method: "POST", body: input }),
    onSuccess: onSessionChange,
  });
}

export function useLogout() {
  const onSessionChange = useSessionChange();
  return useMutation({
    mutationFn: () => api("/api/v1/auth/logout", { method: "POST" }),
    onSettled: () => onSessionChange(null),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => api("/api/v1/auth/forgot-password", { method: "POST", body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { email: string; token: string; newPassword: string }) =>
      api("/api/v1/auth/reset-password", { method: "POST", body: input }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string }) => api<CurrentUser>("/api/v1/auth/me", { method: "PATCH", body: input }),
    onSuccess: (user) => queryClient.setQueryData(currentUserQuery.queryKey, user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api("/api/v1/auth/change-password", { method: "POST", body: input }),
  });
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/app") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
