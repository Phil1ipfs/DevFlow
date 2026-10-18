"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MemberSelect } from "@/components/workspace/member-select";
import { suggestProjectKey, useCreateProject, useSetProjectArchived, useUpdateProject, type Project } from "@/lib/api/projects";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const baseSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(80, "Use at most 80 characters."),
  description: z.string().max(2000, "Use at most 2,000 characters."),
  leadId: z.string(),
});

const createSchema = baseSchema.extend({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 uppercase letters or digits, starting with a letter."),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof baseSchema>;

export function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateProject(organizationId);
  const [formError, setFormError] = useState<string | null>(null);
  const [keyEdited, setKeyEdited] = useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", key: "", description: "", leadId: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const key = useWatch({ control: form.control, name: "key" }) || "KEY";

  async function onSubmit(values: CreateValues) {
    setFormError(null);
    try {
      const project = await create.mutateAsync({
        name: values.name,
        key: values.key,
        description: values.description || undefined,
        leadId: values.leadId || null,
      });
      toast.success(`Created ${project.key} · ${project.name}`);
      onOpenChange(false);
      form.reset();
      setKeyEdited(false);
      router.push(`/app/projects/${project.id}`);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name", "key", "description", "leadId"]));
    }
  }

  const nameField = form.register("name", {
    onChange: (event) => {
      if (!keyEdited) form.setValue("key", suggestProjectKey(event.target.value));
    },
  });
  const keyField = form.register("key", {
    onChange: (event) => {
      setKeyEdited(true);
      form.setValue("key", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects group related tasks. Every member of the workspace can see them.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormAlert message={formError} />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <FormField id="projectName" label="Name" error={errors.name?.message}>
              <Input autoFocus placeholder="Customer portal" {...nameField} />
            </FormField>
            <FormField id="projectKey" label="Key" error={errors.key?.message}>
              <Input className="font-mono uppercase" maxLength={10} placeholder="CP" {...keyField} />
            </FormField>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Tasks will be numbered {key}-1, {key}-2, … The key can&apos;t be changed later.
          </p>
          <FormField id="projectDescription" label="Description" error={errors.description?.message}>
            <Textarea rows={3} placeholder="What is this project about?" {...form.register("description")} />
          </FormField>
          <FormField id="projectLead" label="Lead" error={errors.leadId?.message}>
            {(control) => (
              <Controller
                control={form.control}
                name="leadId"
                render={({ field }) => <MemberSelect {...control} organizationId={organizationId} value={field.value} onChange={field.onChange} />}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateProject(project.id);
  const setArchived = useSetProjectArchived(project.id);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<EditValues>({
    resolver: zodResolver(baseSchema),
    values: { name: project.name, description: project.description ?? "", leadId: project.lead?.id ?? "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EditValues) {
    setFormError(null);
    try {
      await update.mutateAsync({
        name: values.name,
        description: values.description,
        leadId: values.leadId || null,
        clearLead: !values.leadId,
      });
      toast.success("Project updated");
      onOpenChange(false);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name", "description", "leadId"]));
    }
  }

  async function toggleArchived() {
    const archiving = !project.archivedAt;
    await setArchived.mutateAsync(archiving);
    toast.success(archiving ? `${project.key} archived` : `${project.key} restored`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{project.key}</span> · created {new Date(project.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormAlert message={formError} />
          <FormField id="editProjectName" label="Name" error={errors.name?.message}>
            <Input {...form.register("name")} />
          </FormField>
          <FormField id="editProjectDescription" label="Description" error={errors.description?.message}>
            <Textarea rows={3} {...form.register("description")} />
          </FormField>
          <FormField id="editProjectLead" label="Lead" error={errors.leadId?.message}>
            {(control) => (
              <Controller
                control={form.control}
                name="leadId"
                render={({ field }) => (
                  <MemberSelect {...control} organizationId={project.organizationId} value={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </FormField>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant={project.archivedAt ? "outline" : "destructive"} onClick={toggleArchived} disabled={setArchived.isPending}>
              {project.archivedAt ? "Restore project" : "Archive project"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
