import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

const TABS = [
  { href: "/app/settings", label: "Account" },
  { href: "/app/settings/workspace", label: "Workspace" },
  { href: "/app/settings/members", label: "Members" },
  { href: "/app/settings/audit", label: "Audit log" },
];

export default function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Your account, and the workspace you're in." />
      <SettingsNav tabs={TABS} />
      {children}
    </div>
  );
}
