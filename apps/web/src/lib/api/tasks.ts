"use client";

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, query } from "./client";
import type { UserSummary } from "./organizations";
import { projectKeys } from "./projects";

export type TaskStatus = "Backlog" | "Todo" | "InProgress" | "InReview" | "Done";
export type Priority = "None" | "Low" | "Medium" | "High" | "Urgent";
export type TaskSort = "Newest" | "Oldest" | "RecentlyUpdated" | "Priority" | "DueDate";

export const TASK_STATUSES: TaskStatus[] = ["Backlog", "Todo", "InProgress", "InReview", "Done"];
export const PRIORITIES: Priority[] = ["Urgent", "High", "Medium", "Low", "None"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  Backlog: "Backlog",
  Todo: "To do",
  InProgress: "In progress",
  InReview: "In review",
  Done: "Done",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  None: "No priority",
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Urgent",
};

export type TaskSummary = {
  id: string;
  projectId: string;
  key: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee: UserSummary | null;
  dueDate: string | null;
  position: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TaskDetail = Omit<TaskSummary, "position" | "commentCount"> & {
  organizationId: string;
  projectName: string;
  description: string | null;
  reporter: UserSummary;
  completedAt: string | null;
};

export type Board = { projectId: string; columns: { status: TaskStatus; tasks: TaskSummary[] }[] };

export type Paged<T> = { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number };

export type TaskComment = { id: string; taskId: string; author: UserSummary; body: string; createdAt: string; editedAt: string | null };

export type TaskActivity = { id: string; actor: UserSummary; type: string; data: Record<string, string>; createdAt: string };

export type TaskFilters = {
  status?: TaskStatus[];
  priority?: Priority[];
  assigneeId?: string;
  unassigned?: boolean;
  search?: string;
  archived?: boolean;
  sort?: TaskSort;
  page?: number;
  pageSize?: number;
};

function toQueryString(filters: TaskFilters) {
  const base = query({
    assigneeId: filters.assigneeId,
    unassigned: filters.unassigned || undefined,
    search: filters.search,
    archived: filters.archived || undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  });
  // Arrays repeat the key (?status=Todo&status=Done), which ASP.NET Core binds to an array.
  const repeated = [
    ...(filters.status ?? []).map((s) => `status=${s}`),
    ...(filters.priority ?? []).map((p) => `priority=${p}`),
  ].join("&");
  if (!repeated) return base;
  return base ? `${base}&${repeated}` : `?${repeated}`;
}

export const taskKeys = {
  project: (projectId: string) => ["projects", projectId, "tasks"] as const,
  board: (projectId: string, filters: TaskFilters) => ["projects", projectId, "tasks", "board", filters] as const,
  list: (projectId: string, filters: TaskFilters) => ["projects", projectId, "tasks", "list", filters] as const,
  mine: (organizationId: string, filters: TaskFilters) => ["organizations", organizationId, "my-tasks", filters] as const,
  allMine: (organizationId: string) => ["organizations", organizationId, "my-tasks"] as const,
  detail: (taskId: string) => ["tasks", taskId] as const,
  comments: (taskId: string) => ["tasks", taskId, "comments"] as const,
  activity: (taskId: string) => ["tasks", taskId, "activity"] as const,
};

export const boardQuery = (projectId: string, filters: TaskFilters) =>
  queryOptions({
    queryKey: taskKeys.board(projectId, filters),
    queryFn: ({ signal }) => api<Board>(`/api/v1/projects/${projectId}/board${toQueryString(filters)}`, { signal }),
  });

export const tasksQuery = (projectId: string, filters: TaskFilters) =>
  queryOptions({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: ({ signal }) => api<Paged<TaskSummary>>(`/api/v1/projects/${projectId}/tasks${toQueryString(filters)}`, { signal }),
    placeholderData: (previous) => previous,
  });

export const myTasksQuery = (organizationId: string, filters: TaskFilters) =>
  queryOptions({
    queryKey: taskKeys.mine(organizationId, filters),
    queryFn: ({ signal }) =>
      api<Paged<TaskSummary>>(`/api/v1/organizations/${organizationId}/my-tasks${toQueryString(filters)}`, { signal }),
    placeholderData: (previous) => previous,
  });

export const taskQuery = (taskId: string) =>
  queryOptions({ queryKey: taskKeys.detail(taskId), queryFn: ({ signal }) => api<TaskDetail>(`/api/v1/tasks/${taskId}`, { signal }) });

export const commentsQuery = (taskId: string) =>
  queryOptions({
    queryKey: taskKeys.comments(taskId),
    queryFn: ({ signal }) => api<TaskComment[]>(`/api/v1/tasks/${taskId}/comments`, { signal }),
  });

export const activityQuery = (taskId: string) =>
  queryOptions({
    queryKey: taskKeys.activity(taskId),
    queryFn: ({ signal }) => api<TaskActivity[]>(`/api/v1/tasks/${taskId}/activity`, { signal }),
  });

/** After any task change: refresh boards, lists, my-tasks and project counts. */
function useInvalidateTaskViews() {
  const queryClient = useQueryClient();
  return (task: { id: string; projectId: string; organizationId?: string }) => {
    queryClient.invalidateQueries({ queryKey: taskKeys.project(task.projectId) });
    queryClient.invalidateQueries({ queryKey: taskKeys.activity(task.id) });
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(task.projectId) });
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[2] === "my-tasks" || q.queryKey[2] === "projects" });
  };
}

export function useCreateTask(projectId: string) {
  const invalidate = useInvalidateTaskViews();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => api<TaskDetail>(`/api/v1/projects/${projectId}/tasks`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export type TaskUpdate = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  clearAssignee?: boolean;
  dueDate?: string;
  clearDueDate?: boolean;
};

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskViews();
  return useMutation({
    mutationFn: (input: TaskUpdate) => api<TaskDetail>(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: input }),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      invalidate(task);
    },
  });
}

export function useSetTaskArchived(taskId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskViews();
  return useMutation({
    mutationFn: (archived: boolean) => api<TaskDetail>(`/api/v1/tasks/${taskId}/${archived ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      invalidate(task);
    },
  });
}

export type MoveInput = { taskId: string; status: TaskStatus; beforeTaskId: string | null; afterTaskId: string | null };

/**
 * Board drag-and-drop. The board component applies the move to the cache optimistically before
 * calling this; on failure the board is refetched so it snaps back to the server's truth.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...body }: MoveInput) => api<TaskSummary>(`/api/v1/tasks/${taskId}/move`, { method: "POST", body }),
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(input.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(input.taskId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<TaskComment>(`/api/v1/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(taskId) });
    },
  });
}

export function useEditComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      api<TaskComment>(`/api/v1/task-comments/${commentId}`, { method: "PATCH", body: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api(`/api/v1/task-comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) }),
  });
}
