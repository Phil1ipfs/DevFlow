import { ChartColumn, FolderKanban, LayoutDashboard, LifeBuoy, ListChecks, type LucideIcon, Settings } from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only "/app" itself should be active on "/app"; sections match their sub-paths too. */
  exact?: boolean;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/my-tasks", label: "My tasks", icon: ListChecks },
  { href: "/app/tickets", label: "Tickets", icon: LifeBuoy },
  { href: "/app/reports", label: "Reports", icon: ChartColumn },
];

export const APP_SETTINGS_NAV: AppNavItem = { href: "/app/settings", label: "Settings", icon: Settings };

export function isNavItemActive(item: AppNavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findNavItem(pathname: string) {
  return [...APP_NAV, APP_SETTINGS_NAV].find((item) => isNavItemActive(item, pathname));
}
