"use client";

import { useState } from "react";
import { useQuery } from "@/lib/query";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/components/app-shell/user-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MemberSelect } from "@/components/workspace/member-select";
import { useOrganization } from "@/components/workspace/organization-provider";
import { isApiError } from "@/lib/api/client";
import {
  activityQuery,
  commentsQuery,
  PRIORITY_LABEL,
  STATUS_LABEL,
  taskQuery,
  useAddComment,
  useDeleteComment,
  useEditComment,
  useSetTaskArchived,
  useUpdateTask,
  type Priority,
  type TaskActivity,
  type TaskComment,
  type TaskDetail,
  type TaskStatus,
  type TaskUpdate,
} from "@/lib/api/tasks";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { formatDate, formatDueDate, timeAgo } from "@/lib/format";
import { PrioritySelect, StatusSelect } from "./task-fields";

function describeActivity(entry: TaskActivity): string {
  const d = entry.data;
  const status = (value: string) => STATUS_LABEL[value as TaskStatus] ?? value;
  switch (entry.type) {
    case "created":
      return "created the task";
    case "status_changed":
      return `moved it from ${status(d.from)} to ${status(d.to)}`;
    case "priority_changed":
      return `changed priority from ${PRIORITY_LABEL[d.from as Priority] ?? d.from} to ${PRIORITY_LABEL[d.to as Priority] ?? d.to}`;
    case "assigned":
      return `assigned it to ${d.assigneeName}`;
    case "unassigned":
      return "removed the assignee";
    case "title_changed":
      return `renamed it from “${d.from}”`;
    case "description_changed":
      return "updated the description";
    case "due_date_changed":
      return d.to ? `set the due date to ${formatDueDate(d.to)}` : "removed the due date";
    case "commented":
      return "commented";
    case "archived":
      return "archived the task";
    case "restored":
      return "restored the task";
    default:
      return entry.type.replaceAll("_", " ");
  }
}

function CommentItem({ comment, taskId, canModerate }: { comment: TaskComment; taskId: string; canModerate: boolean }) {
  const { user } = useCurrentUser();
  const edit = useEditComment(taskId);
  const remove = useDeleteComment(taskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const mine = user?.id === comment.author.id;

  return (
    <li className="flex gap-3">
      <Avatar className="size-7">
        <AvatarFallback className="bg-secondary text-[10px]">{initials(comment.author.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-medium text-foreground">{comment.author.displayName}</span>
          <time dateTime={comment.createdAt} className="text-muted-foreground" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt)}
          </time>
          {comment.editedAt && <span className="text-muted-foreground">(edited)</span>}
          <span className="ml-auto flex gap-0.5">
            {mine && !editing && (
              <Button variant="ghost" size="icon-xs" aria-label="Edit comment" onClick={() => setEditing(true)}>
                <Pencil />
              </Button>
            )}
            {(mine || canModerate) && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete comment"
                disabled={remove.isPending}
                onClick={async () => {
                  await remove.mutateAsync(comment.id);
                  toast.success("Comment deleted");
                }}
              >
                <Trash2 />
              </Button>
            )}
          </span>
        </div>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea aria-label="Edit comment" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!draft.trim() || edit.isPending}
                onClick={async () => {
                  await edit.mutateAsync({ commentId: comment.id, body: draft });
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
        )}
      </div>
    </li>
  );
}

function Conversation({ task, readOnly, canModerate }: { task: TaskDetail; readOnly: boolean; canModerate: boolean }) {
  const comments = useQuery(commentsQuery(task.id));
  const activity = useQuery(activityQuery(task.id));
  const add = useAddComment(task.id);
  const [draft, setDraft] = useState("");

  async function submit() {
    if (!draft.trim()) return;
    try {
      await add.mutateAsync(draft);
      setDraft("");
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Couldn't post the comment.");
    }
  }

  return (
    <Tabs defaultValue="comments">
      <TabsList>
        <TabsTrigger value="comments">Comments{comments.data ? ` (${comments.data.length})` : ""}</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="comments" className="space-y-4 pt-3">
        {comments.isPending ? (
          <Skeleton className="h-16" />
        ) : comments.data?.length ? (
          <ul className="space-y-4">
            {comments.data.map((comment) => (
              <CommentItem key={comment.id} comment={comment} taskId={task.id} canModerate={canModerate} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
        )}
        {!readOnly && (
          <div className="space-y-2">
            <Label htmlFor="newComment" className="sr-only">
              Add a comment
            </Label>
            <Textarea
              id="newComment"
              rows={3}
              placeholder="Add a comment… (Ctrl+Enter to post)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
              }}
            />
            <Button size="sm" onClick={submit} disabled={!draft.trim() || add.isPending}>
              {add.isPending ? "Posting…" : "Comment"}
            </Button>
          </div>
        )}
      </TabsContent>
      <TabsContent value="activity" className="pt-3">
        {activity.isPending ? (
          <Skeleton className="h-16" />
        ) : (
          <ol className="space-y-3 border-l pl-4">
            {activity.data?.map((entry) => (
              <li key={entry.id} className="relative text-sm">
                <span aria-hidden className="absolute top-1.5 -left-[21px] size-2 rounded-full border-2 border-background bg-muted-foreground/60" />
                <span className="font-medium">{entry.actor.displayName}</span>{" "}
                <span className="text-muted-foreground">{describeActivity(entry)}</span>{" "}
                <time dateTime={entry.createdAt} className="text-xs text-muted-foreground" title={new Date(entry.createdAt).toLocaleString()}>
                  · {timeAgo(entry.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EditableTitle({ task, disabled, onSave }: { task: TaskDetail; disabled: boolean; onSave: (title: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? task.title;
  const commit = () => {
    if (draft !== null && draft.trim() && draft.trim() !== task.title) onSave(draft.trim());
    setDraft(null);
  };
  return (
    <Input
      aria-label="Title"
      value={value}
      disabled={disabled}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-auto border-transparent px-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
    />
  );
}

function TaskBody({ task, readOnly }: { task: TaskDetail; readOnly: boolean }) {
  const update = useUpdateTask(task.id);
  const archive = useSetTaskArchived(task.id);
  const { organizations } = useOrganization();
  const role = organizations?.find((o) => o.id === task.organizationId)?.role;
  const [description, setDescription] = useState<string | null>(null);
  const disabled = readOnly || Boolean(task.archivedAt);

  async function save(change: TaskUpdate, message?: string) {
    try {
      await update.mutateAsync(change);
      if (message) toast.success(message);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Couldn't save the change.");
    }
  }

  return (
    <div className="space-y-6 px-4 pb-8 sm:px-6">
      <EditableTitle task={task} disabled={disabled} onSave={(title) => save({ title })} />

      <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <StatusSelect aria-label="Status" value={task.status} disabled={disabled} onChange={(status) => save({ status })} className="w-full sm:w-56" />
        </dd>
        <dt className="text-muted-foreground">Priority</dt>
        <dd>
          <PrioritySelect aria-label="Priority" value={task.priority} disabled={disabled} onChange={(priority) => save({ priority })} className="w-full sm:w-56" />
        </dd>
        <dt className="text-muted-foreground">Assignee</dt>
        <dd>
          <MemberSelect
            aria-label="Assignee"
            organizationId={task.organizationId}
            value={task.assignee?.id ?? ""}
            noneLabel="Unassigned"
            className="w-full sm:w-56"
            disabled={disabled}
            onChange={(userId) => save(userId ? { assigneeId: userId } : { clearAssignee: true })}
          />
        </dd>
        <dt className="text-muted-foreground">
          <label htmlFor="taskDue">Due date</label>
        </dt>
        <dd>
          <Input
            id="taskDue"
            type="date"
            className="w-full sm:w-56"
            disabled={disabled}
            value={task.dueDate ?? ""}
            onChange={(e) => save(e.target.value ? { dueDate: e.target.value } : { clearDueDate: true })}
          />
        </dd>
        <dt className="text-muted-foreground">Reporter</dt>
        <dd>{task.reporter.displayName}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatDate(task.createdAt)}</dd>
      </dl>

      <div className="space-y-2">
        <Label htmlFor="taskDescriptionEdit">Description</Label>
        <Textarea
          id="taskDescriptionEdit"
          rows={5}
          disabled={disabled}
          placeholder={disabled ? "No description." : "Add a description…"}
          value={description ?? task.description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
        {description !== null && description !== (task.description ?? "") && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={update.isPending}
              onClick={async () => {
                await save({ description }, "Description saved");
                setDescription(null);
              }}
            >
              Save description
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDescription(null)}>
              Discard
            </Button>
          </div>
        )}
      </div>

      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          disabled={archive.isPending}
          onClick={async () => {
            await archive.mutateAsync(!task.archivedAt);
            toast.success(task.archivedAt ? `${task.key} restored` : `${task.key} archived`);
          }}
        >
          {task.archivedAt ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
          {task.archivedAt ? "Restore task" : "Archive task"}
        </Button>
      )}

      <Conversation task={task} readOnly={readOnly} canModerate={role === "Admin" || role === "Owner"} />
    </div>
  );
}

/** Slide-over panel with everything about one task. Open state lives in the URL (?task=id). */
export function TaskSheet({ taskId, readOnly, onClose }: { taskId: string | null; readOnly: boolean; onClose: () => void }) {
  const { data: task, error } = useQuery({ ...taskQuery(taskId ?? ""), enabled: Boolean(taskId) });

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            {task ? task.key : "Task"}
            {task?.archivedAt && <Badge variant="outline">Archived</Badge>}
          </SheetTitle>
          <SheetDescription className="sr-only">{task ? `Details for ${task.key}` : "Loading task details"}</SheetDescription>
        </SheetHeader>
        {error ? (
          <p role="alert" className="px-6 text-sm text-muted-foreground">
            {isApiError(error, 404) ? "This task doesn't exist or you no longer have access to it." : error.message}
          </p>
        ) : !task ? (
          <div className="space-y-3 px-6" role="status" aria-label="Loading task">
            <Skeleton className="h-8" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <TaskBody key={task.id} task={task} readOnly={readOnly} />
        )}
      </SheetContent>
    </Sheet>
  );
}
