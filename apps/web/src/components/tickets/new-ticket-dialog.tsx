"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/auth/auth-card";
import { FormField } from "@/components/forms/form-field";
import { PrioritySelect } from "@/components/tasks/task-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, useCreateTicket } from "@/lib/api/tickets";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { zodResolver } from "@/lib/forms/zod-resolver";

const schema = z.object({
  subject: z.string().trim().min(1, "Summarize the problem in a few words.").max(200, "Use at most 200 characters."),
  description: z.string().trim().min(1, "Describe what's happening.").max(10_000),
  category: z.enum(["Access", "Hardware", "Software", "Network", "Other"]),
  priority: z.enum(["None", "Low", "Medium", "High", "Urgent"]),
});
type Values = z.infer<typeof schema>;

export function NewTicketDialog({ organizationId, open, onOpenChange }: { organizationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const create = useCreateTicket(organizationId);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", description: "", category: "Other", priority: "Medium" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const ticket = await create.mutateAsync(values);
      toast.success(`Ticket #${ticket.number} submitted`, { description: "The IT team has it in their queue." });
      form.reset();
      onOpenChange(false);
      router.push(`/app/tickets/${ticket.id}`);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["subject", "description", "category", "priority"]));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Get IT help</DialogTitle>
          <DialogDescription>Tell the IT team what&apos;s wrong. You&apos;ll be notified when they reply.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormAlert message={formError} />
          <FormField id="ticketSubject" label="Subject" error={errors.subject?.message}>
            <Input autoFocus placeholder="e.g. Can't connect to the VPN" {...form.register("subject")} />
          </FormField>
          <FormField
            id="ticketDescription"
            label="Description"
            error={errors.description?.message}
            hint="What did you try, what did you expect, and any error messages."
          >
            <Textarea rows={5} {...form.register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="ticketCategory" label="Category">
              {(control) => (
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {TICKET_CATEGORY_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField id="ticketPriority" label="Urgency" hint="Urgent = you or your team can't work.">
              {(control) => (
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => <PrioritySelect {...control} value={field.value} onChange={field.onChange} />}
                />
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
