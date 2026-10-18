"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrganizationDialog } from "@/components/workspace/create-organization-dialog";
import { useOrganization } from "@/components/workspace/organization-provider";
import { initials } from "./user-menu";

function WorkspaceAvatar({ name, className = "size-8 text-xs" }: { name: string; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function WorkspaceSwitcher() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { organizations, active, setActive } = useOrganization();
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  if (!active) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 flex-1 group-data-[collapsible=icon]:hidden" />
      </div>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Switch workspace">
              <WorkspaceAvatar name={active.name} />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{active.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {active.role} · {active.memberCount} {active.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            {organizations?.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onSelect={() => {
                  if (organization.id === active.id) return;
                  setActive(organization.id);
                  setOpenMobile(false);
                  router.push("/app");
                }}
              >
                <WorkspaceAvatar name={organization.name} className="size-5 rounded text-[9px]" />
                <span className="truncate">{organization.name}</span>
                {organization.id === active.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCreating(true)}>
              <Plus />
              Create workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
