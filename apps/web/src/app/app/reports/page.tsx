import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "@/components/reports/reports-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ReportsView />
    </Suspense>
  );
}
