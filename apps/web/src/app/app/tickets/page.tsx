import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketsView } from "@/components/tickets/tickets-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Tickets" };

// Filters live in the query string (request-time data), so the view sits behind Suspense.
export default function TicketsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <TicketsView />
    </Suspense>
  );
}
