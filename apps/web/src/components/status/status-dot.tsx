import { cn } from "@/lib/utils";
import type { ComponentState } from "./health-state";

const STATE_DOT: Record<ComponentState, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/40",
  checking: "bg-muted-foreground/40 animate-pulse",
};

/** Decorative colour dot; always pair it with a text label for screen readers. */
export function StatusDot({ state, className }: { state: ComponentState; className?: string }) {
  return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", STATE_DOT[state], className)} />;
}
