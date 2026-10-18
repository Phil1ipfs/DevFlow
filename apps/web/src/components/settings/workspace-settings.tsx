"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { isApiError } from "@/lib/api/client";
import { useRemoveMember, useRenameOrganization, type Organization } from "@/lib/api/organizations";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const schema = z.object({ name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use at most 80 characters.") });

function RenameForm({ organization, canEdit }: { organization: Organization; canEdit: boolean }) {
  const rename = useRenameOrganization(organization.id);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: { name: organization.name } });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError(null);
    try {
      await rename.mutateAsync(values);
      toast.success("Workspace renamed");
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name"]));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-md gap-4">
      <FormAlert message={formError} />
      <FormField id="workspaceName" label="Name" error={errors.name?.message} hint={canEdit ? undefined : "Only admins can rename the workspace."}>
        <Input disabled={!canEdit} {...form.register("name")} />
      </FormField>
      {canEdit && (
        <div>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function WorkspaceSettings() {
  const { active, isAdmin, organizations, setActive } = useOrganization();
  const { user } = useCurrentUser();
  const router = useRouter();
  const remove = useRemoveMember(active?.id ?? "");
  const [leaveError, setLeaveError] = useState<string | null>(null);

  if (!active || !user) return <Skeleton className="h-64 rounded-xl" />;

  async function leave() {
    setLeaveError(null);
    try {
      await remove.mutateAsync(user!.id);
      const next = organizations?.find((o) => o.id !== active!.id);
      if (next) setActive(next.id);
      toast.success(`You left ${active!.name}`);
      router.replace(next ? "/app" : "/onboarding");
    } catch (error) {
      setLeaveError(isApiError(error) ? error.message : "Could not leave the workspace.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Created {new Date(active.createdAt).toLocaleDateString()} · {active.memberCount}{" "}
            {active.memberCount === 1 ? "member" : "members"} · your role: {active.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RenameForm organization={active} canEdit={isAdmin} />
        </CardContent>
      </Card>

      <Card className="ring-destructive/25">
        <CardHeader>
          <CardTitle>Leave workspace</CardTitle>
          <CardDescription>
            You will lose access to its projects, tasks and tickets. A workspace must always keep at least one owner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormAlert message={leaveError} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Leave {active.name}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {active.name}?</AlertDialogTitle>
                <AlertDialogDescription>An admin will need to invite you again for you to rejoin.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={leave}>
                  Leave workspace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
