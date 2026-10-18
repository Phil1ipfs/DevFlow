"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateOrganizationForm } from "./create-organization-form";
import { useOrganization } from "./organization-provider";

export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { setActive } = useOrganization();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>A separate space with its own projects, members and tickets.</DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm
          onCreated={(organization) => {
            setActive(organization.id);
            onOpenChange(false);
            toast.success(`Created ${organization.name}`);
            router.push("/app");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
