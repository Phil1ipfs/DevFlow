"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { passwordSchema } from "@/components/auth/register-form";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword, useCurrentUser, useUpdateProfile } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80, "Use at most 80 characters."),
});

export function ProfileForm() {
  const { user } = useCurrentUser();
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { displayName: user?.displayName ?? "" },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      toast.success("Profile updated");
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["displayName"]));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-md gap-4">
      <FormAlert message={formError} />
      <FormField id="displayName" label="Name" error={errors.displayName?.message}>
        <Input autoComplete="name" {...form.register("displayName")} />
      </FormField>
      <FormField id="profileEmail" label="Email" hint="Changing your email address is not supported yet.">
        <Input value={user?.email ?? ""} readOnly disabled />
      </FormField>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

const passwordFormSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export function ChangePasswordForm() {
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof passwordFormSchema>) {
    setFormError(null);
    try {
      await change.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      form.reset();
      toast.success("Password changed");
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["currentPassword", "newPassword"]));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-md gap-4">
      <FormAlert message={formError} />
      <FormField id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" {...form.register("currentPassword")} />
      </FormField>
      <FormField id="newPassword" label="New password" error={errors.newPassword?.message} hint="At least 10 characters.">
        <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </FormField>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
