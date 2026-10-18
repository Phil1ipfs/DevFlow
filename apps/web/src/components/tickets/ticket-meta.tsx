import { CircleCheck, CircleDot, CircleDashed, CircleX, Hourglass, type LucideIcon } from "lucide-react";
import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<TicketStatus, { icon: LucideIcon; className: string }> = {
  Open: { icon: CircleDashed, className: "text-chart-1" },
  InProgress: { icon: CircleDot, className: "text-chart-3" },
  WaitingOnRequester: { icon: Hourglass, className: "text-chart-4" },
  Resolved: { icon: CircleCheck, className: "text-success" },
  Closed: { icon: CircleX, className: "text-muted-foreground" },
};

/** Status always shows an icon plus a text label, never colour alone. */
export function TicketStatusLabel({ status, className }: { status: TicketStatus; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <Icon aria-hidden className={cn("size-3.5 shrink-0", tone)} />
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}
