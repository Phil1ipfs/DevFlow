import Link from "next/link";
import { cn } from "@/lib/utils";

/** DevFlow mark: three staggered work items flowing left to right. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="24" height="24" rx="6.5" className="fill-primary" />
      <g className="stroke-primary-foreground" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6.5 8h6" />
        <path d="M9 12h8.5" opacity="0.85" />
        <path d="M11.5 16h4" opacity="0.7" />
      </g>
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <LogoMark />
      DevFlow
    </Link>
  );
}
