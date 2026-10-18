import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SampleColumn, SamplePriority, SampleTask } from "@/lib/sample-data";

const LABEL_TONE: Record<SampleTask["labelTone"], string> = {
  "chart-1": "bg-chart-1/12 text-chart-1",
  "chart-2": "bg-chart-2/12 text-chart-2",
  "chart-3": "bg-chart-3/15 text-[color-mix(in_oklch,var(--chart-3),var(--foreground)_35%)]",
  "chart-4": "bg-chart-4/12 text-chart-4",
  "chart-5": "bg-chart-5/12 text-chart-5",
};

const COLUMN_DOT: Record<SampleColumn["tone"], string> = {
  muted: "border-muted-foreground/60",
  "chart-1": "border-chart-1",
  "chart-2": "border-chart-2 bg-chart-2",
  "chart-3": "border-chart-3",
};

const PRIORITY_BARS: Record<SamplePriority, number> = { low: 1, medium: 2, high: 3, urgent: 3 };

function PriorityIcon({ priority }: { priority: SamplePriority }) {
  const filled = PRIORITY_BARS[priority];
  return (
    <span
      role="img"
      aria-label={`${priority} priority`}
      className={cn("flex h-3 items-end gap-px", priority === "urgent" ? "text-destructive" : "text-muted-foreground")}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn("w-[3px] rounded-[1px] bg-current", bar > filled && "opacity-25")}
          style={{ height: `${bar * 4}px` }}
        />
      ))}
    </span>
  );
}

function TaskCard({ task, compact }: { task: SampleTask; compact?: boolean }) {
  return (
    <li className="rounded-lg border bg-card p-2.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-muted-foreground">{task.key}</span>
        <PriorityIcon priority={task.priority} />
      </div>
      <p className={cn("mt-1.5 leading-snug font-medium", compact ? "text-xs" : "text-[13px]")}>{task.title}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", LABEL_TONE[task.labelTone])}>
          {task.label}
        </span>
        {task.comments ? (
          <span className="flex items-center gap-0.5 text-[10.5px] text-muted-foreground">
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">Comments:</span>
            {task.comments}
          </span>
        ) : null}
        <span
          aria-label={`Assignee ${task.assignee}`}
          className="ml-auto grid size-5 place-items-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground"
        >
          {task.assignee}
        </span>
      </div>
    </li>
  );
}

type BoardPreviewProps = {
  columns: SampleColumn[];
  /** Smaller type for tight spaces such as the landing page hero. */
  compact?: boolean;
  className?: string;
};

/** Read-only Kanban layout. The interactive, drag-and-drop board arrives with task management. */
export function BoardPreview({ columns, compact, className }: BoardPreviewProps) {
  return (
    <div className={cn("grid gap-3", className)}>
      {columns.map((column) => (
        <section key={column.id} aria-label={column.title} className="min-w-0 rounded-xl bg-muted/50 p-2">
          <header className="flex items-center gap-2 px-1 pt-0.5 pb-2">
            <span aria-hidden className={cn("size-2.5 rounded-full border-[1.5px]", COLUMN_DOT[column.tone])} />
            <h3 className="text-xs font-medium">{column.title}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">{column.tasks.length}</span>
          </header>
          <ul className="space-y-2">
            {column.tasks.map((task) => (
              <TaskCard key={task.key} task={task} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
