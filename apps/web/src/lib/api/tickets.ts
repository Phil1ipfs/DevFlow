"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, query } from "./client";
import type { UserSummary } from "./organizations";
import type { Paged, Priority } from "./tasks";

export type TicketStatus = "Open" | "InProgress" | "WaitingOnRequester" | "Resolved" | "Closed";
export type TicketCategory = "Access" | "Hardware" | "Software" | "Network" | "Other";
export type TicketScope = "All" | "Requested" | "Assigned";

export const TICKET_STATUSES: TicketStatus[] = ["Open", "InProgress", "WaitingOnRequester", "Resolved", "Closed"];
export const TICKET_CATEGORIES: TicketCategory[] = ["Access", "Hardware", "Software", "Network", "Other"];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  Open: "Open",
  InProgress: "In progress",
  WaitingOnRequester: "Waiting on requester",
  Resolved: "Resolved",
  Closed: "Closed",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  Access: "Access & accounts",
  Hardware: "Hardware",
  Software: "Software",
  Network: "Network",
  Other: "Other",
};

export type TicketSummary = {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  category: TicketCategory;
  requester: UserSummary;
  assignee: UserSummary | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TicketPermissions = { canTriage: boolean; canEditDetails: boolean; canChangeStatus: boolean; canAddInternalNotes: boolean };

export type TicketDetail = Omit<TicketSummary, "commentCount"> & {
  organizationId: string;
  description: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  permissions: TicketPermissions;
};

export type TicketComment = { id: string; author: UserSummary; body: string; isInternal: boolean; createdAt: string };

export type TicketFilters = {
  scope?: TicketScope;
  status?: TicketStatus[];
  priority?: Priority;
  category?: TicketCategory;
  unassigned?: boolean;
  search?: string;
  page?: number;
};

function toQuery(filters: TicketFilters) {
  const base = query({
    scope: filters.scope && filters.scope !== "All" ? filters.scope : undefined,
    priority: filters.priority,
    category: filters.category,
    unassigned: filters.unassigned || undefined,
    search: filters.search,
    page: filters.page,
    pageSize: 25,
  });
  const statuses = (filters.status ?? []).map((s) => `status=${s}`).join("&");
  if (!statuses) return base;
  return base ? `${base}&${statuses}` : `?${statuses}`;
}

export const ticketKeys = {
  all: (organizationId: string) => ["organizations", organizationId, "tickets"] as const,
  list: (organizationId: string, filters: TicketFilters) => ["organizations", organizationId, "tickets", filters] as const,
  detail: (ticketId: string) => ["tickets", ticketId] as const,
  comments: (ticketId: string) => ["tickets", ticketId, "comments"] as const,
};

export const ticketsQuery = (organizationId: string, filters: TicketFilters) =>
  queryOptions({
    queryKey: ticketKeys.list(organizationId, filters),
    queryFn: ({ signal }) => api<Paged<TicketSummary>>(`/api/v1/organizations/${organizationId}/tickets${toQuery(filters)}`, { signal }),
    placeholderData: (previous) => previous,
  });

export const ticketQuery = (ticketId: string) =>
  queryOptions({ queryKey: ticketKeys.detail(ticketId), queryFn: ({ signal }) => api<TicketDetail>(`/api/v1/tickets/${ticketId}`, { signal }) });

export const ticketCommentsQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ticketKeys.comments(ticketId),
    queryFn: ({ signal }) => api<TicketComment[]>(`/api/v1/tickets/${ticketId}/comments`, { signal }),
  });

export function useCreateTicket(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject: string; description: string; priority: Priority; category: TicketCategory }) =>
      api<TicketDetail>(`/api/v1/organizations/${organizationId}/tickets`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all(organizationId) }),
  });
}

export type TicketUpdate = {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: Priority;
  category?: TicketCategory;
  assigneeId?: string;
  clearAssignee?: boolean;
};

export function useUpdateTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketUpdate) => api<TicketDetail>(`/api/v1/tickets/${ticketId}`, { method: "PATCH", body: input }),
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketKeys.detail(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: ticketKeys.all(ticket.organizationId) });
    },
  });
}

export function useAddTicketComment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; isInternal: boolean }) =>
      api<TicketComment>(`/api/v1/tickets/${ticketId}/comments`, { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.comments(ticketId) });
      // Replying can change status (waiting -> in progress) and first-response time.
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
    },
  });
}
