"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MemberSelect } from "@/components/workspace/member-select";
import type { Project } from "@/lib/api/projects";
import { useCreateTask, type Priority, type TaskDetail, type TaskStatus } from "@/lib/api/tasks";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { PrioritySelect, StatusSelect } from "./task-fields";

const schema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Use at most 200 characters."),
  description: z.string().max(10_000),
  status: z.enum(["Backlog", "Todo", "InProgress", "InReview", "Done"]),
  priority: z.enum(["None", "Low", "Medium", "High", "Urgent"]),
  assigneeId: z.string(),
  dueDate: z.string(),
});
type Values = z.infer<typeof schema>;

type CreateTaskDialogProps = {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: TaskStatus;
  onCreated?: (task: TaskDetail) => void;
};

export function CreateTaskDialog({ project, open, onOpenChange, initialStatus = "Todo", onCreated }: CreateTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            In <span className="font-medium text-foreground">{project.name}</span>. It will be numbered {project.key}-…
          </DialogDescription>
        </DialogHeader>
        {/* Rendered inside the dialog content, so the form mounts fresh (with clean defaults)
            every time the dialog opens instead of syncing state from props. */}
        <CreateTaskForm project={project} initialStatus={initialStatus} onCreated={onCreated} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskForm({
  project,
  initialStatus,
  onCreated,
  onClose,
}: {
  project: Project;
  initialStatus: TaskStatus;
  onCreated?: (task: TaskDetail) => void;
  onClose: () => void;
}) {
  const create = useCreateTask(project.id);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", status: initialStatus, priority: "None" as Priority, assigneeId: "", dueDate: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values, keepOpen: boolean) {
    setFormError(null);
    try {
      const task = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate || null,
      });
      toast.success(`Created ${task.key}`, { description: task.title });
      onCreated?.(task);
      if (keepOpen) {
        form.reset({ ...values, title: "", description: "" });
        form.setFocus("title");
      } else {
        onClose();
      }
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["title", "description", "assigneeId", "dueDate"]));
    }
  }

  return (
    <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <FormField id="taskTitle" label="Title" error={errors.title?.message}>
        <Input autoFocus placeholder="What needs to be done?" {...form.register("title")} />
      </FormField>
      <FormField id="taskDescription" label="Description" error={errors.description?.message}>
        <Textarea rows={4} placeholder="Add details, acceptance criteria or links (optional)" {...form.register("description")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="taskStatus" label="Status">
          {(control) => (
            <Controller control={form.control} name="status" render={({ field }) => <StatusSelect {...control} value={field.value} onChange={field.onChange} />} />
          )}
        </FormField>
        <FormField id="taskPriority" label="Priority">
          {(control) => (
            <Controller control={form.control} name="priority" render={({ field }) => <PrioritySelect {...control} value={field.value} onChange={field.onChange} />} />
          )}
        </FormField>
        <FormField id="taskAssignee" label="Assignee" error={errors.assigneeId?.message}>
          {(control) => (
            <Controller
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <MemberSelect {...control} organizationId={project.organizationId} value={field.value} onChange={field.onChange} noneLabel="Unassigned" />
              )}
            />
          )}
        </FormField>
        <FormField id="taskDueDate" label="Due date" error={errors.dueDate?.message}>
          <Input type="date" {...form.register("dueDate")} />
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={form.handleSubmit((values) => onSubmit(values, true))}
        >
          Create and add another
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create task"}
        </Button>
      </DialogFooter>
    </form>
  );
}
