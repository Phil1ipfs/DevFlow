"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath, useCurrentUser, useLogin } from "@/lib/auth/auth-api";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { AuthCard, FormAlert } from "./auth-card";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { user } = useCurrentUser();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });
  const { errors, isSubmitting } = form.formState;

  // Already signed in (valid session): skip the form.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.replace(next);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["email", "password"]));
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your DevFlow workspace."
      footer={
        <>
          New to DevFlow?{" "}
          <Link href={`/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </FormField>
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAside={
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          }
        >
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </FormField>
        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox id="rememberMe" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            )}
          />
          <Label htmlFor="rememberMe" className="font-normal text-muted-foreground">
            Keep me signed in
          </Label>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
