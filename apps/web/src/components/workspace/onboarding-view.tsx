"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { CreateOrganizationForm } from "./create-organization-form";
import { useSwitchOrganization } from "./organization-provider";

export function OnboardingView() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const setActive = useSwitchOrganization();

  return (
    <AuthCard
      title={user ? `Welcome, ${user.displayName.split(" ")[0]}` : "Welcome to DevFlow"}
      description="Create a workspace for your team. Projects, tasks and tickets all live inside it."
      footer="Joining an existing team? Ask an admin to invite your email address."
    >
      <CreateOrganizationForm
        onCreated={(organization) => {
          setActive(organization.id);
          router.replace("/app");
        }}
      />
    </AuthCard>
  );
}
