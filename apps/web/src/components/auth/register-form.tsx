"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNextPath, useRegister } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { AuthCard, FormAlert } from "./auth-card";

// Mirrors the API's RegisterRequestValidator so most mistakes are caught before a round trip.
// The API stays the authority: its errors are mapped back onto these fields.
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

const schema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80, "Use at most 80 characters."),
  email: z.email("Enter a valid email address.").max(256),
  password: passwordSchema,
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const register = useRegister();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await register.mutateAsync(values);
      router.replace(next);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["displayName", "email", "password"]));
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start organizing projects, tasks and tickets."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField id="displayName" label="Name" error={errors.displayName?.message}>
          <Input autoComplete="name" autoFocus {...form.register("displayName")} />
        </FormField>
        <FormField id="email" label="Work email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </FormField>
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          hint="At least 10 characters. A short phrase is easier to remember and harder to guess."
        >
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
