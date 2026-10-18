import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogPanel } from "@/components/settings/audit-log-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <AuditLogPanel />
    </Suspense>
  );
}
