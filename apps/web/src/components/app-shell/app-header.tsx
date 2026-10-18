"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useOrganization } from "@/components/workspace/organization-provider";
import { findNavItem } from "./nav-config";
import { UserMenu } from "./user-menu";

function Title({ pathname }: { pathname: string }) {
  const { active } = useOrganization();
  const current = findNavItem(pathname);
  return (
    <p className="min-w-0 truncate text-sm">
      {active && <span className="hidden text-muted-foreground sm:inline">{active.name} / </span>}
      <span className="font-medium">{current?.label ?? "DevFlow"}</span>
    </p>
  );
}

function ActiveTitle() {
  return <Title pathname={usePathname()} />;
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      {/* Same reason as the sidebar: the pathname may only be known at request time. */}
      <Suspense fallback={<Title pathname="" />}>
        <ActiveTitle />
      </Suspense>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
