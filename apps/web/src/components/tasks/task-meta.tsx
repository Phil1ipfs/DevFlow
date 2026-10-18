import { CalendarDays, Circle, CircleCheck, CircleDashed, CircleDot, CircleEllipsis } from "lucide-react";
import { initials } from "@/components/app-shell/user-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserSummary } from "@/lib/api/organizations";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/api/tasks";
import { dueState, formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<TaskStatus, { icon: typeof Circle; className: string }> = {
  Backlog: { icon: CircleDashed, className: "text-muted-foreground" },
  Todo: { icon: Circle, className: "text-muted-foreground" },
  InProgress: { icon: CircleDot, className: "text-chart-3" },
  InReview: { icon: CircleEllipsis, className: "text-chart-4" },
  Done: { icon: CircleCheck, className: "text-success" },
};

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_ICON[status];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", tone, className)} />;
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_BARS: Record<Priority, number> = { None: 0, Low: 1, Medium: 2, High: 3, Urgent: 3 };

/** Signal-strength style priority glyph; "Urgent" is a filled red block. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "Urgent") {
    return (
      <span
        role="img"
        aria-label="Urgent priority"
        className={cn("grid size-3.5 shrink-0 place-items-center rounded-[3px] bg-destructive text-[9px] font-bold leading-none text-white", className)}
      >
        !
      </span>
    );
  }
  const filled = PRIORITY_BARS[priority];
  return (
    <span role="img" aria-label={PRIORITY_LABEL[priority]} className={cn("flex h-3.5 w-3.5 shrink-0 items-end gap-px text-muted-foreground", className)}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn("w-[3px] rounded-[1px] bg-current", (priority === "None" || bar > filled) && "opacity-25")}
          style={{ height: `${bar * 4 + 1}px` }}
        />
      ))}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PriorityIcon priority={priority} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function AssigneeAvatar({ user, className }: { user: UserSummary | null; className?: string }) {
  if (!user) {
    return (
      <span
        aria-label="Unassigned"
        className={cn("grid size-5 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground", className)}
      />
    );
  }
  return (
    <Avatar className={cn("size-5", className)} title={user.displayName} aria-label={`Assigned to ${user.displayName}`}>
      <AvatarFallback className="bg-secondary text-[9px] font-semibold">{initials(user.displayName)}</AvatarFallback>
    </Avatar>
  );
}

export function DueDateLabel({ date, done, className }: { date: string | null; done: boolean; className?: string }) {
  const state = dueState(date, done);
  if (!date || !state) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        state === "overdue" ? "font-medium text-destructive" : state === "soon" ? "text-warning" : "text-muted-foreground",
        className,
      )}
      title={state === "overdue" ? "Overdue" : undefined}
    >
      <CalendarDays className="size-3" aria-hidden />
      {formatDueDate(date)}
      {state === "overdue" && <span className="sr-only">(overdue)</span>}
    </span>
  );
}
