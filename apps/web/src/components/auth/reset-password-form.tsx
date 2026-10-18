"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResetPassword } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { AuthCard, FormAlert } from "./auth-card";
import { passwordSchema } from "./register-form";

const schema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirmPassword: "" } });
  const { errors, isSubmitting } = form.formState;

  if (!email || !token) {
    return (
      <AuthCard title="Link incomplete" footer={<Link href="/forgot-password" className="font-medium text-primary hover:underline">Request a new link</Link>}>
        <p className="text-sm text-muted-foreground">
          This password reset link is missing information. Open the link from your email again, or request a new one.
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="space-y-4 text-center text-sm" role="status">
          <CircleCheck className="mx-auto size-8 text-success" aria-hidden />
          <p>Your password has been changed. Sign in with your new password.</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await reset.mutateAsync({ email, token, newPassword: values.newPassword });
      setDone(true);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["newPassword"]));
    }
  }

  return (
    <AuthCard title="Choose a new password" description={<>For <span className="font-medium text-foreground">{email}</span></>}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField id="newPassword" label="New password" error={errors.newPassword?.message} hint="At least 10 characters.">
          <Input type="password" autoComplete="new-password" autoFocus {...form.register("newPassword")} />
        </FormField>
        <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </AuthCard>
  );
}
