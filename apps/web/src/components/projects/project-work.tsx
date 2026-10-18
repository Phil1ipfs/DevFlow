"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/lib/query";
import { Archive, Columns3, List, Plus, SquareKanban } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import {
  AssigneeFilter,
  ClearFilters,
  PriorityFilter,
  SearchInput,
  SortSelect,
  StatusFilter,
  statusFilterToStatuses,
} from "@/components/tasks/task-filters";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/api/projects";
import { tasksQuery, type Priority, type TaskFilters, type TaskSort, type TaskStatus } from "@/lib/api/tasks";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";

/** The project's tasks: Kanban board or filterable list, plus the task detail panel. */
export function ProjectWork({ project }: { project: Project }) {
  const { params, set } = useUrlState();
  const view = params.get("view") === "list" ? "list" : "board";
  const search = params.get("q") ?? "";
  const assignee = params.get("assignee") ?? "";
  const priority = params.get("priority") ?? "";
  const status = params.get("status") ?? "";
  const sort = (params.get("sort") as TaskSort) || "Newest";
  const archived = params.get("archived") === "1";
  const page = Number(params.get("page") ?? "1") || 1;
  const openTaskId = params.get("task");
  const readOnly = Boolean(project.archivedAt);

  const [creating, setCreating] = useState<TaskStatus | null>(null);

  const shared: TaskFilters = useMemo(
    () => ({
      search: search || undefined,
      assigneeId: assignee || undefined,
      priority: priority ? [priority as Priority] : undefined,
    }),
    [search, assignee, priority],
  );
  const listFilters: TaskFilters = { ...shared, status: statusFilterToStatuses(status), sort, archived, page, pageSize: 25 };
  const list = useQuery({ ...tasksQuery(project.id, listFilters), enabled: view === "list" });

  const filtersActive = Boolean(search || assignee || priority || status || archived);
  const openTask = (id: string) => set({ task: id }, { push: true });
  const clearFilters = () => set({ q: null, assignee: null, priority: null, status: null, archived: null, page: null });

  return (
    <section aria-label="Tasks" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="View" className="inline-flex rounded-lg border p-0.5">
          {(
            [
              ["board", "Board", Columns3],
              ["list", "List", List],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => set({ view: value === "board" ? null : value, page: null })}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === value ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <SearchInput key={search} value={search} onChange={(q) => set({ q, page: null })} />
        <AssigneeFilter organizationId={project.organizationId} value={assignee} onChange={(a) => set({ assignee: a, page: null })} />
        <PriorityFilter value={priority} onChange={(p) => set({ priority: p, page: null })} />
        {view === "list" && (
          <>
            <StatusFilter value={status} onChange={(s) => set({ status: s, page: null })} />
            <SortSelect value={sort} onChange={(s) => set({ sort: s === "Newest" ? null : s, page: null })} />
            <Button
              variant={archived ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={archived}
              onClick={() => set({ archived: archived ? null : "1", page: null })}
            >
              <Archive data-icon="inline-start" />
              Archived
            </Button>
          </>
        )}
        <ClearFilters active={filtersActive} onClear={clearFilters} />
        {!readOnly && (
          <Button className="ml-auto" onClick={() => setCreating("Todo")}>
            <Plus data-icon="inline-start" />
            New task
          </Button>
        )}
      </div>

      {readOnly && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This project is archived, so its tasks are read-only. An admin can restore it from Project settings.
        </p>
      )}

      {view === "board" ? (
        <KanbanBoard projectId={project.id} filters={shared} readOnly={readOnly} onOpenTask={openTask} onAddTask={setCreating} />
      ) : (
        <TaskTable
          data={list.data}
          isPending={list.isPending}
          onOpen={(task) => openTask(task.id)}
          onPageChange={(p) => set({ page: p === 1 ? null : String(p) })}
          empty={
            <EmptyState
              icon={SquareKanban}
              title={filtersActive ? "No tasks match these filters" : "No tasks yet"}
              description={filtersActive ? "Try a different search or clear the filters." : "Create the first task for this project."}
              actions={
                filtersActive ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  !readOnly && (
                    <Button onClick={() => setCreating("Todo")}>
                      <Plus data-icon="inline-start" />
                      New task
                    </Button>
                  )
                )
              }
            />
          }
        />
      )}

      <CreateTaskDialog
        project={project}
        open={creating !== null}
        initialStatus={creating ?? "Todo"}
        onOpenChange={(open) => !open && setCreating(null)}
      />
      <TaskSheet taskId={openTaskId} readOnly={readOnly} onClose={() => set({ task: null })} />
    </section>
  );
}
