"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@/lib/query";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { useOrganization } from "@/components/workspace/organization-provider";
import { projectsQuery } from "@/lib/api/projects";
import { myTasksQuery, type TaskSort } from "@/lib/api/tasks";
import { useUrlState } from "@/lib/use-url-state";
import { ClearFilters, PriorityFilter, SearchInput, SortSelect, StatusFilter, statusFilterToStatuses } from "./task-filters";
import { TaskTable } from "./task-table";

export function MyTasksView() {
  const router = useRouter();
  const { active } = useOrganization();
  const { params, set } = useUrlState();
  const search = params.get("q") ?? "";
  // Default to unfinished work; "all" shows everything.
  const status = params.get("status") ?? "open";
  const priority = params.get("priority") ?? "";
  const sort = (params.get("sort") as TaskSort) || "DueDate";
  const page = Number(params.get("page") ?? "1") || 1;

  const filters = {
    search: search || undefined,
    status: status === "all" ? undefined : statusFilterToStatuses(status),
    priority: priority ? [priority as never] : undefined,
    sort,
    page,
    pageSize: 25,
  };
  const tasks = useQuery({ ...myTasksQuery(active?.id ?? "", filters), enabled: Boolean(active) });
  const projects = useQuery({ ...projectsQuery(active?.id ?? ""), enabled: Boolean(active) });
  const projectNames = useMemo(
    () => Object.fromEntries((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  );
  const filtersActive = Boolean(search || priority || status !== "open");

  return (
    <div className="space-y-6">
      <PageHeader title="My tasks" description={active ? `Everything assigned to you in ${active.name}.` : " "} />
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput key={search} value={search} onChange={(q) => set({ q, page: null })} />
        <StatusFilter value={status === "all" ? "" : status} onChange={(s) => set({ status: s || "all", page: null })} />
        <PriorityFilter value={priority} onChange={(p) => set({ priority: p, page: null })} />
        <SortSelect value={sort} onChange={(s) => set({ sort: s === "DueDate" ? null : s, page: null })} />
        <ClearFilters active={filtersActive} onClear={() => set({ q: null, status: null, priority: null, page: null })} />
      </div>
      <TaskTable
        data={tasks.data}
        isPending={!active || tasks.isPending}
        projectNames={projectNames}
        onOpen={(task) => router.push(`/app/projects/${task.projectId}?task=${task.id}`)}
        onPageChange={(p) => set({ page: p === 1 ? null : String(p) })}
        empty={
          <EmptyState
            icon={ListChecks}
            title={filtersActive ? "No tasks match these filters" : "Nothing assigned to you"}
            description={
              filtersActive
                ? "Try a different search or show all statuses."
                : "When someone assigns you a task, it shows up here. You can also assign tasks to yourself from any board."
            }
          />
        }
      />
    </div>
  );
}
