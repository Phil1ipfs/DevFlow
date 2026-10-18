"use client";

import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberSelect } from "@/components/workspace/member-select";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES, type TaskSort } from "@/lib/api/tasks";
import { PriorityIcon, StatusIcon } from "./task-meta";

const ALL = "__all__";

/** Search box that updates the URL 300 ms after typing stops. */
export function SearchInput({ value, onChange, placeholder = "Search tasks or WEB-12…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        aria-label="Search tasks"
        placeholder={placeholder}
        value={draft}
        className="pr-8 pl-8"
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(next), 300);
        }}
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            clearTimeout(timer.current);
            setDraft("");
            onChange("");
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function PriorityFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label="Filter by priority" className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Any priority</SelectItem>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="inline-flex items-center gap-1.5">
              <PriorityIcon priority={p} />
              {PRIORITY_LABEL[p]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Any status</SelectItem>
        <SelectItem value="open">Not done</SelectItem>
        {TASK_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status={s} />
              {STATUS_LABEL[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SORT_LABEL: Record<TaskSort, string> = {
  Newest: "Newest first",
  Oldest: "Oldest first",
  RecentlyUpdated: "Recently updated",
  Priority: "Priority",
  DueDate: "Due date",
};

export function SortSelect({ value, onChange }: { value: TaskSort; onChange: (value: TaskSort) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskSort)}>
      <SelectTrigger aria-label="Sort tasks" className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(SORT_LABEL) as TaskSort[]).map((sort) => (
          <SelectItem key={sort} value={sort}>
            {SORT_LABEL[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AssigneeFilter({ organizationId, value, onChange }: { organizationId: string; value: string; onChange: (value: string) => void }) {
  return (
    <MemberSelect
      aria-label="Filter by assignee"
      organizationId={organizationId}
      value={value}
      onChange={onChange}
      noneLabel="Anyone"
      placeholder="Anyone"
      className="w-full sm:w-44"
    />
  );
}

export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <X data-icon="inline-start" />
      Clear filters
    </Button>
  );
}

/** Maps the status filter value ("open", a status, or "") to API statuses. */
export function statusFilterToStatuses(value: string) {
  if (!value) return undefined;
  if (value === "open") return TASK_STATUSES.filter((s) => s !== "Done");
  return TASK_STATUSES.includes(value as never) ? [value as (typeof TASK_STATUSES)[number]] : undefined;
}
