import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketDetailView } from "@/components/tickets/ticket-detail-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/app/tickets/[ticketId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      {params.then(({ ticketId }) => (
        <TicketDetailView ticketId={ticketId} />
      ))}
    </Suspense>
  );
}
