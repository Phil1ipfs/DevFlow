import type { Metadata } from "next";
import { Suspense } from "react";
import { MyTasksView } from "@/components/tasks/my-tasks-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "My tasks" };

// The view reads filters from the query string (useSearchParams), which is request-time data.
export default function MyTasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <MyTasksView />
    </Suspense>
  );
}
