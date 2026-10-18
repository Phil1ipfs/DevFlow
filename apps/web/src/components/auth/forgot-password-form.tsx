"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { AuthCard, FormAlert } from "./auth-card";

const schema = z.object({ email: z.email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await forgot.mutateAsync(values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["email"]));
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
        <div className="space-y-3 text-center text-sm" role="status">
          <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
          <p>
            If an account exists for <span className="font-medium">{sentTo}</span>, we sent a link to reset its password.
            The link is valid for one hour.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Development: emails are not delivered. Open the{" "}
              <a href={`/api/v1/dev/emails?to=${encodeURIComponent(sentTo)}`} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                dev mailbox
              </a>{" "}
              to find the link.
            </p>
          )}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
