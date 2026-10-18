import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  children?: ReactNode;
};

export function SectionHeading({ id, eyebrow, title, description, align = "left", children }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && <p className="text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
      {children}
    </div>
  );
}
