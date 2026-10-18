"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, query } from "./client";
import type { UserSummary } from "./organizations";
import type { Paged } from "./tasks";

// ---- Notifications ----

export type Notification = {
  id: string;
  organizationId: string;
  type: string;
  title: string;
  body: string | null;
  link: string;
  actor: UserSummary | null;
  createdAt: string;
  readAt: string | null;
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  unread: ["notifications", "unread"] as const,
};

export const notificationsQuery = queryOptions({
  queryKey: notificationKeys.list,
  queryFn: ({ signal }) => api<Paged<Notification>>("/api/v1/notifications?pageSize=20", { signal }),
});

export const unreadCountQuery = queryOptions({
  queryKey: notificationKeys.unread,
  queryFn: ({ signal }) => api<{ count: number }>("/api/v1/notifications/unread-count", { signal }),
  // Real-time pushes keep this fresh; the interval is a fallback if the connection drops.
  refetchInterval: 60_000,
});

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/v1/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

// ---- Reports ----

export type CountByKey = { key: string; count: number };
export type DailyPoint = { date: string; created: number; completed: number };

export type OverviewReport = {
  days: number;
  generatedAt: string;
  tasks: {
    open: number;
    overdue: number;
    completedInPeriod: number;
    averageCycleHours: number | null;
    byStatus: CountByKey[];
    byPriority: CountByKey[];
    daily: DailyPoint[];
  };
  tickets: {
    open: number;
    resolvedInPeriod: number;
    averageFirstResponseHours: number | null;
    averageResolutionHours: number | null;
    byStatus: CountByKey[];
    byCategory: CountByKey[];
    daily: DailyPoint[];
  };
  workload: { user: UserSummary; openTasks: number; openTickets: number }[];
};

export const reportQuery = (organizationId: string, days: number) =>
  queryOptions({
    queryKey: ["organizations", organizationId, "reports", days],
    queryFn: ({ signal }) => api<OverviewReport>(`/api/v1/organizations/${organizationId}/reports/overview?days=${days}`, { signal }),
    placeholderData: (previous) => previous,
  });

// ---- Audit log ----

export type AuditEntry = {
  id: string;
  action: string;
  summary: string;
  actor: UserSummary | null;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, string>;
  ipAddress: string | null;
  createdAt: string;
};

export const auditLogQuery = (organizationId: string, action: string, page: number) =>
  queryOptions({
    queryKey: ["organizations", organizationId, "audit", action, page],
    queryFn: ({ signal }) =>
      api<Paged<AuditEntry>>(`/api/v1/organizations/${organizationId}/audit-logs${query({ action, page, pageSize: 25 })}`, { signal }),
    placeholderData: (previous) => previous,
  });
