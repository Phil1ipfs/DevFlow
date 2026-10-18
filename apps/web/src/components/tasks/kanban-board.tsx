"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@/lib/query";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import { boardQuery, STATUS_LABEL, TASK_STATUSES, useMoveTask, type Board, type TaskFilters, type TaskStatus, type TaskSummary } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { AssigneeAvatar, DueDateLabel, PriorityIcon, StatusIcon } from "./task-meta";

type Columns = Record<TaskStatus, TaskSummary[]>;

function toColumns(board: Board | undefined): Columns {
  const columns = Object.fromEntries(TASK_STATUSES.map((status) => [status, [] as TaskSummary[]])) as Columns;
  board?.columns.forEach((column) => (columns[column.status] = column.tasks));
  return columns;
}

const isStatus = (id: UniqueIdentifier): id is TaskStatus => TASK_STATUSES.includes(id as TaskStatus);

function TaskCard({ task, overlay = false }: { task: TaskSummary; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-3 text-left shadow-xs transition-[border-color,box-shadow]",
        overlay ? "rotate-[1.5deg] cursor-grabbing border-primary/40 shadow-lg" : "hover:border-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{task.key}</span>
        <PriorityIcon priority={task.priority} className="ml-auto" />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium break-words">{task.title}</p>
      <div className="mt-3 flex items-center gap-2.5">
        <DueDateLabel date={task.dueDate} done={task.status === "Done"} />
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">Comments:</span>
            {task.commentCount}
          </span>
        )}
        <AssigneeAvatar user={task.assignee} className="ml-auto" />
      </div>
    </div>
  );
}

function SortableCard({ task, onOpen, disabled }: { task: TaskSummary; onOpen: (id: string) => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      aria-label={`${task.key}: ${task.title}. ${STATUS_LABEL[task.status]}. Press Enter to open, Space to move.`}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(task.id);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
    >
      <TaskCard task={task} />
    </li>
  );
}

function BoardColumn({
  status,
  tasks,
  onOpen,
  onAdd,
  readOnly,
}: {
  status: TaskStatus;
  tasks: TaskSummary[];
  onOpen: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  readOnly: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section aria-label={`${STATUS_LABEL[status]} column`} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/50">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StatusIcon status={status} />
        <h3 className="text-sm font-medium">{STATUS_LABEL[status]}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        {!readOnly && (
          <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Add task to ${STATUS_LABEL[status]}`} onClick={() => onAdd(status)}>
            <Plus />
          </Button>
        )}
      </header>
      <SortableContext id={status} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition-colors", isOver && "bg-primary/5")}
        >
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onOpen={onOpen} disabled={readOnly} />
          ))}
          {tasks.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {readOnly ? "No tasks" : "Drop tasks here"}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export function KanbanBoard({
  projectId,
  filters,
  readOnly,
  onOpenTask,
  onAddTask,
}: {
  projectId: string;
  filters: TaskFilters;
  readOnly: boolean;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const queryClient = useQueryClient();
  const board = boardQuery(projectId, filters);
  const { data, isPending, isError, error, refetch } = useQuery(board);
  const move = useMoveTask(projectId);
  // While dragging, the board renders this local copy so cards can move between columns freely;
  // otherwise it renders straight from the query cache.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useMemo(() => dragColumns ?? toColumns(data), [dragColumns, data]);

  const sensors = useSensors(
    // A 6px threshold lets a plain click open the card instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const allTasks = useMemo(() => Object.values(columns).flat(), [columns]);
  const taskLabel = (id: UniqueIdentifier) => allTasks.find((t) => t.id === id)?.key ?? "task";
  const findColumn = (id: UniqueIdentifier, from: Columns = columns): TaskStatus | null =>
    isStatus(id) ? id : (TASK_STATUSES.find((status) => from[status].some((t) => t.id === id)) ?? null);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${taskLabel(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${taskLabel(active.id)} is over ${STATUS_LABEL[findColumn(over.id) ?? "Todo"]}.` : `${taskLabel(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over ? `${taskLabel(active.id)} dropped in ${STATUS_LABEL[findColumn(over.id) ?? "Todo"]}.` : `${taskLabel(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${taskLabel(active.id)} was cancelled.`,
  };

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragColumns(toColumns(data));
  }

  // Moving across columns happens live while dragging, so the target column opens a gap.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragColumns) return;
    const from = findColumn(active.id, dragColumns);
    const to = findColumn(over.id, dragColumns);
    if (!from || !to || from === to) return;

    setDragColumns((current) => {
      if (!current) return current;
      const task = current[from].find((t) => t.id === active.id)!;
      const target = current[to];
      const overIndex = isStatus(over.id) ? target.length : target.findIndex((t) => t.id === over.id);
      const index = overIndex < 0 ? target.length : overIndex;
      return {
        ...current,
        [from]: current[from].filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...task, status: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || !dragColumns || !data) {
      setDragColumns(null);
      return;
    }

    const status = findColumn(active.id, dragColumns)!;
    let list = dragColumns[status];
    if (!isStatus(over.id) && findColumn(over.id, dragColumns) === status) {
      list = arrayMove(list, list.findIndex((t) => t.id === active.id), list.findIndex((t) => t.id === over.id));
    }
    const index = list.findIndex((t) => t.id === active.id);
    const before = list[index - 1]?.id ?? null;
    const after = list[index + 1]?.id ?? null;

    const original = toColumns(data);
    const originalStatus = findColumn(active.id, original)!;
    const originalList = original[originalStatus];
    const originalIndex = originalList.findIndex((t) => t.id === active.id);
    const unchanged =
      originalStatus === status &&
      (originalList[originalIndex - 1]?.id ?? null) === before &&
      (originalList[originalIndex + 1]?.id ?? null) === after;

    setDragColumns(null);
    if (unchanged) return;

    // Optimistic update: show the result immediately; the server confirms (or we refetch).
    const final: Columns = { ...dragColumns, [status]: list };
    queryClient.setQueryData<Board>(board.queryKey, {
      projectId,
      columns: TASK_STATUSES.map((s) => ({ status: s, tasks: final[s] })),
    });
    move.mutate(
      { taskId: String(active.id), status, beforeTaskId: before, afterTaskId: after },
      { onError: (err) => toast.error(isApiError(err) ? err.message : "Couldn't move the task. The board was refreshed.") },
    );
  }

  if (isPending) {
    return (
      <div className="flex gap-3 overflow-hidden" role="status" aria-label="Loading board">
        {TASK_STATUSES.map((status) => (
          <Skeleton key={status} className="h-80 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        {error.message}{" "}
        <button className="font-medium text-primary hover:underline" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragColumns(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move a task, press Space. Use the arrow keys to move it between positions and columns, Space to drop it, or Escape to cancel. Press Enter to open it.",
        },
      }}
    >
      {/* "relative" matters: it makes this scroll container the containing block for absolutely
          positioned descendants (e.g. sr-only labels), so they are clipped here instead of
          widening the whole page on small screens. */}
      <div className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {TASK_STATUSES.map((status) => (
          <BoardColumn key={status} status={status} tasks={columns[status]} onOpen={onOpenTask} onAdd={onAddTask} readOnly={readOnly} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
