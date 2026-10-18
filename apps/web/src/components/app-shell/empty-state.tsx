import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** Roadmap phase that delivers this feature, e.g. "Phase 3". */
  phase?: string;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, phase, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center sm:py-20",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl border bg-card text-muted-foreground shadow-xs">
        <Icon className="size-5" aria-hidden />
      </span>
      {phase && (
        <Badge variant="secondary" className="mt-5">
          Arrives in {phase}
        </Badge>
      )}
      <h2 className="mt-3 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
