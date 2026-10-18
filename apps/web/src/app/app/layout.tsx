import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AuthGate } from "@/components/app-shell/auth-gate";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OrganizationProvider } from "@/components/workspace/organization-provider";

export const metadata: Metadata = {
  title: {
    default: "Overview",
    template: "%s · DevFlow",
  },
  robots: { index: false },
};

// Shared shell for every /app route: the sidebar and header stay mounted while only the
// page content (children) changes during navigation.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <OrganizationProvider>
      <RealtimeProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
              <AuthGate>{children}</AuthGate>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </RealtimeProvider>
    </OrganizationProvider>
  );
}
