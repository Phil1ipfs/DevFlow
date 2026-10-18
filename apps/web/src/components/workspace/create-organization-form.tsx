"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrganization, type Organization } from "@/lib/api/organizations";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const schema = z.object({ name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use at most 80 characters.") });
type Values = z.infer<typeof schema>;

export function CreateOrganizationForm({
  onCreated,
  submitLabel = "Create workspace",
}: {
  onCreated: (organization: Organization) => void;
  submitLabel?: string;
}) {
  const create = useCreateOrganization();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      onCreated(await create.mutateAsync(values));
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name"]));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <FormField
        id="organizationName"
        label="Workspace name"
        error={errors.name?.message}
        hint="Usually your company or team name. You can change it later."
      >
        <Input autoFocus placeholder="Acme Engineering" {...form.register("name")} />
      </FormField>
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}
