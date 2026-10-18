"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/api/tasks";
import { PriorityLabel, StatusLabel } from "./task-meta";

type FieldProps<T> = {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function StatusSelect({ id, value, onChange, className, disabled, ...aria }: FieldProps<TaskStatus>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TaskStatus)} disabled={disabled}>
      <SelectTrigger id={id} className={className ?? "w-full"} {...aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <StatusLabel status={status} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({ id, value, onChange, className, disabled, ...aria }: FieldProps<Priority>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Priority)} disabled={disabled}>
      <SelectTrigger id={id} className={className ?? "w-full"} {...aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority} value={priority}>
            <PriorityLabel priority={priority} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
