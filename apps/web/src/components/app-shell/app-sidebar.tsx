"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@/lib/query";
import { Activity, ArrowLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useOrganization } from "@/components/workspace/organization-provider";
import { projectsQuery } from "@/lib/api/projects";
import { APP_NAV, APP_SETTINGS_NAV, type AppNavItem, isNavItemActive } from "./nav-config";
import { WorkspaceSwitcher } from "./workspace-switcher";

function NavLink({ item, pathname, onNavigate }: { item: AppNavItem; pathname: string; onNavigate: () => void }) {
  const active = isNavItemActive(item, pathname);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const SIDEBAR_PROJECT_LIMIT = 8;

function ProjectLinks({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { active } = useOrganization();
  const { data: projects, isPending } = useQuery({ ...projectsQuery(active?.id ?? ""), enabled: Boolean(active) });

  if (!active || isPending) {
    return (
      <>
        <SidebarMenuSkeleton showIcon width="75%" />
        <SidebarMenuSkeleton showIcon width="55%" />
      </>
    );
  }
  if (!projects?.length) {
    return <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">No projects yet</p>;
  }

  return projects.slice(0, SIDEBAR_PROJECT_LIMIT).map((project) => {
    const href = `/app/projects/${project.id}`;
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <SidebarMenuItem key={project.id}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={project.name} size="sm">
          <Link href={href} aria-current={isActive ? "page" : undefined} onClick={onNavigate}>
            <span
              aria-hidden
              className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-sidebar-accent font-mono text-[8px] font-semibold"
            >
              {project.key.slice(0, 2)}
            </span>
            <span>{project.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

type NavProps = { pathname: string; onNavigate: () => void };

/** All sidebar navigation. Pure: the active item comes from the pathname prop. */
function SidebarNavigation({ pathname, onNavigate }: NavProps) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {APP_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Projects</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ProjectLinks pathname={pathname} onNavigate={onNavigate} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="mt-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <NavLink item={APP_SETTINGS_NAV} pathname={pathname} onNavigate={onNavigate} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function ActiveSidebarNavigation({ onNavigate }: Pick<NavProps, "onNavigate">) {
  return <SidebarNavigation pathname={usePathname()} onNavigate={onNavigate} />;
}

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet; close it after choosing a destination.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {/* On pages with a dynamic param (e.g. /app/projects/[id]) the pathname is only known at
            request time. The fallback renders the same navigation without an active item, so the
            sidebar stays in the prerendered shell and the highlight appears on load. */}
        <Suspense fallback={<SidebarNavigation pathname="" onNavigate={closeOnMobile} />}>
          <ActiveSidebarNavigation onNavigate={closeOnMobile} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="System status" size="sm">
              <Link href="/status">
                <Activity />
                <span>System status</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to website" size="sm">
              <Link href="/">
                <ArrowLeft />
                <span>Back to website</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
