"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type BarDatum = { key: string; label: string; value: number };

/**
 * Horizontal bars for comparing magnitudes across a few categories. Single hue (one series,
 * so no legend), bars capped at 12px thick with a 4px rounded data end, every value labelled at
 * the bar tip, and a hover/focus highlight that also shows the share of the total.
 */
export function BarList({ data, description, color = "var(--viz-1)" }: { data: BarDatum[]; description: string; color?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ul aria-label={description} className="space-y-2.5">
      {data.map((d) => {
        const share = total ? Math.round((d.value / total) * 100) : 0;
        const isActive = active === d.key;
        return (
          <li
            key={d.key}
            tabIndex={0}
            aria-label={`${d.label}: ${d.value} (${share}% of total)`}
            onPointerEnter={() => setActive(d.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(d.key)}
            onBlur={() => setActive(null)}
            className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[9rem_1fr]"
          >
            <span className={cn("truncate text-muted-foreground", isActive && "text-foreground")}>{d.label}</span>
            <span className="flex items-center gap-2">
              <span className="relative h-3 flex-1">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity"
                  style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: active && !isActive ? 0.45 : 1, minWidth: d.value ? 2 : 0 }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-foreground tabular-nums">
                {d.value}
                {isActive && <span className="text-muted-foreground"> · {share}%</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
