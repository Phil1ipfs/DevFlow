"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Paged, TaskSummary } from "@/lib/api/tasks";
import { timeAgo } from "@/lib/format";
import { AssigneeAvatar, DueDateLabel, PriorityIcon, StatusLabel } from "./task-meta";

export function TaskTable({
  data,
  isPending,
  onOpen,
  onPageChange,
  empty,
  projectNames,
}: {
  data: Paged<TaskSummary> | undefined;
  isPending: boolean;
  onOpen: (task: TaskSummary) => void;
  onPageChange: (page: number) => void;
  empty: ReactNode;
  /** When listing tasks from several projects (My tasks), show which project each belongs to. */
  projectNames?: Record<string, string>;
}) {
  if (isPending && !data) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading tasks">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!data || data.items.length === 0) return <>{empty}</>;

  const from = (data.page - 1) * data.pageSize + 1;
  const to = from + data.items.length - 1;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Tasks</caption>
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-24 px-3 py-2 font-medium">Key</th>
              <th scope="col" className="px-3 py-2 font-medium">Title</th>
              <th scope="col" className="hidden w-36 px-3 py-2 font-medium md:table-cell">Status</th>
              <th scope="col" className="hidden w-28 px-3 py-2 font-medium lg:table-cell">Due</th>
              <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">Updated</th>
              <th scope="col" className="w-12 px-3 py-2 font-medium">
                <span className="sr-only">Assignee</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((task) => (
              <tr key={task.id} className="group cursor-pointer hover:bg-muted/40" onClick={() => onOpen(task)}>
                <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">{task.key}</td>
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <PriorityIcon priority={task.priority} />
                    {/* A real button keeps rows reachable and operable by keyboard. */}
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-medium outline-none group-hover:text-primary focus-visible:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(task);
                      }}
                    >
                      {task.title}
                    </button>
                    {task.commentCount > 0 && (
                      <span className="hidden items-center gap-0.5 text-xs text-muted-foreground sm:inline-flex">
                        <MessageSquare className="size-3" aria-hidden />
                        {task.commentCount}
                      </span>
                    )}
                    {task.archivedAt && <span className="rounded border px-1.5 text-[10px] text-muted-foreground">Archived</span>}
                  </div>
                  {projectNames?.[task.projectId] && (
                    <p className="mt-0.5 pl-5.5 text-xs text-muted-foreground">{projectNames[task.projectId]}</p>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 whitespace-nowrap md:table-cell">
                  <StatusLabel status={task.status} />
                </td>
                <td className="hidden px-3 py-2.5 whitespace-nowrap lg:table-cell">
                  <DueDateLabel date={task.dueDate} done={task.status === "Done"} />
                </td>
                <td className="hidden px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground lg:table-cell">{timeAgo(task.updatedAt)}</td>
                <td className="px-3 py-2.5">
                  <AssigneeAvatar user={task.assignee} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pagination" className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {from}–{to} of {data.totalCount}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="px-2 tabular-nums">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => onPageChange(data.page + 1)}>
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
