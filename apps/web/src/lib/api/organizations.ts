"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type OrganizationRole = "Member" | "Admin" | "Owner";

export const ROLE_RANK: Record<OrganizationRole, number> = { Member: 0, Admin: 1, Owner: 2 };

export function hasRole(role: OrganizationRole | undefined, minimum: OrganizationRole) {
  return role !== undefined && ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export type UserSummary = { id: string; displayName: string; email: string };

export type Organization = { id: string; name: string; role: OrganizationRole; memberCount: number; createdAt: string };

export type Member = { userId: string; displayName: string; email: string; role: OrganizationRole; joinedAt: string };

export type Invitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  invitedBy: UserSummary;
  createdAt: string;
  expiresAt: string;
};

export type InvitationPreview = {
  organizationName: string;
  invitedByName: string;
  email: string;
  role: OrganizationRole;
  status: "Pending" | "Accepted" | "Revoked" | "Expired";
  expiresAt: string;
};

export const organizationKeys = {
  all: ["organizations"] as const,
  members: (organizationId: string) => ["organizations", organizationId, "members"] as const,
  invitations: (organizationId: string) => ["organizations", organizationId, "invitations"] as const,
};

export const organizationsQuery = queryOptions({
  queryKey: organizationKeys.all,
  queryFn: ({ signal }) => api<Organization[]>("/api/v1/organizations", { signal }),
});

export const membersQuery = (organizationId: string) =>
  queryOptions({
    queryKey: organizationKeys.members(organizationId),
    queryFn: ({ signal }) => api<Member[]>(`/api/v1/organizations/${organizationId}/members`, { signal }),
  });

export const invitationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: organizationKeys.invitations(organizationId),
    queryFn: ({ signal }) => api<Invitation[]>(`/api/v1/organizations/${organizationId}/invitations`, { signal }),
  });

export const invitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ["invitation", token],
    queryFn: ({ signal }) => api<InvitationPreview>(`/api/v1/invitations/${encodeURIComponent(token)}`, { signal }),
  });

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api<Organization>("/api/v1/organizations", { method: "POST", body: input }),
    onSuccess: (organization) => {
      // Put it in the cache right away: the app shell must not render the old (possibly empty)
      // list while the refetch is in flight.
      queryClient.setQueryData<Organization[]>(organizationKeys.all, (current) => [...(current ?? []), organization]);
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useRenameOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api<Organization>(`/api/v1/organizations/${organizationId}`, { method: "PATCH", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useChangeMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationRole }) =>
      api<Member>(`/api/v1/organizations/${organizationId}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/api/v1/organizations/${organizationId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useInvite(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: OrganizationRole }) =>
      api<Invitation>(`/api/v1/organizations/${organizationId}/invitations`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(organizationId) }),
  });
}

export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api(`/api/v1/organizations/${organizationId}/invitations/${invitationId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(organizationId) }),
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ organizationId: string; organizationName: string }>(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}
