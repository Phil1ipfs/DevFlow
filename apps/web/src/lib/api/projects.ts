"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, query } from "./client";
import type { UserSummary } from "./organizations";

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  description: string | null;
  lead: UserSummary | null;
  openTaskCount: number;
  createdAt: string;
  archivedAt: string | null;
};

export const projectKeys = {
  list: (organizationId: string, includeArchived = false) =>
    ["organizations", organizationId, "projects", { includeArchived }] as const,
  allLists: (organizationId: string) => ["organizations", organizationId, "projects"] as const,
  detail: (projectId: string) => ["projects", projectId] as const,
};

export const projectsQuery = (organizationId: string, includeArchived = false) =>
  queryOptions({
    queryKey: projectKeys.list(organizationId, includeArchived),
    queryFn: ({ signal }) =>
      api<Project[]>(`/api/v1/organizations/${organizationId}/projects${query({ includeArchived: includeArchived || undefined })}`, {
        signal,
      }),
  });

export const projectQuery = (projectId: string) =>
  queryOptions({
    queryKey: projectKeys.detail(projectId),
    queryFn: ({ signal }) => api<Project>(`/api/v1/projects/${projectId}`, { signal }),
  });

/** Suggests a project key from its name: "Customer Portal" → "CP", "Website" → "WEB". */
export function suggestProjectKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const raw = words.length === 1 ? words[0].slice(0, 3) : words.map((word) => word[0]).join("").slice(0, 5);
  const key = raw.replace(/^[0-9]+/, "");
  return key.length >= 2 ? key : (key + "PRJ").slice(0, 3);
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return (project: Project) => {
    queryClient.setQueryData(projectKeys.detail(project.id), project);
    queryClient.invalidateQueries({ queryKey: projectKeys.allLists(project.organizationId) });
  };
}

export function useCreateProject(organizationId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: { name: string; key: string; description?: string; leadId?: string | null }) =>
      api<Project>(`/api/v1/organizations/${organizationId}/projects`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string; leadId?: string | null; clearLead?: boolean }) =>
      api<Project>(`/api/v1/projects/${projectId}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useSetProjectArchived(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (archived: boolean) =>
      api<Project>(`/api/v1/projects/${projectId}/${archived ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: invalidate,
  });
}
