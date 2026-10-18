"use client";

import { useCallback, useId, useState } from "react";
import { cn } from "@/lib/utils";

export type LineSeries = { key: string; label: string; color: string; values: number[] };

type LineChartProps = {
  /** One label per x position (e.g. "Oct 3"). */
  labels: string[];
  series: LineSeries[];
  height?: number;
  /** Accessible summary of what the chart shows. */
  description: string;
};

const PADDING = { top: 12, right: 96, bottom: 24, left: 32 };

/** Rounds the axis maximum up to a clean number and returns ~4 evenly spaced ticks. */
function niceTicks(max: number) {
  // Small counts: one tick per whole number (at least 0-2 so a flat line isn't pinned to the top).
  if (max <= 5) return Array.from({ length: Math.max(Math.ceil(max), 2) + 1 }, (_, i) => i);
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/** Measures an element's width; re-renders when it changes. */
function useWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Multi-series line chart (SVG). Follows the house chart spec: 2px lines, 8px end markers with a
 * 2px surface ring, hairline gridlines, direct end labels plus a legend, and a crosshair tooltip
 * that also works from the keyboard (focus the chart, then use the arrow keys).
 */
export function LineChart({ labels, series, height = 220, description }: LineChartProps) {
  const [containerRef, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const x = (i: number) => PADDING.left + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * plotWidth);
  const y = (v: number) => PADDING.top + plotHeight - (v / top) * plotHeight;
  const last = labels.length - 1;
  const xTickIndexes = labels.length > 2 ? [0, Math.floor(last / 2), last] : labels.map((_, i) => i);

  function indexAt(clientX: number, rect: DOMRect) {
    const relative = clientX - rect.left - PADDING.left;
    return Math.max(0, Math.min(last, Math.round((relative / Math.max(plotWidth, 1)) * last)));
  }

  // No activity at all: say so plainly rather than drawing flat lines along the axis.
  if (series.every((s) => s.values.every((v) => v === 0))) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed text-sm text-muted-foreground" style={{ height }}>
        No activity in this period.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend: always present for two or more series; line keys mirror the marks. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={containerRef} className="relative">
        {width > 0 && (
          <svg
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            width={width}
            height={height}
            className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? -1) + 1));
              else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last + 1) - 1));
              else if (e.key === "Escape") setHover(null);
            }}
          >
            <title id={titleId}>{description}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PADDING.left} x2={width - PADDING.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
                <text x={PADDING.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {xTickIndexes.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
                className="fill-muted-foreground text-[10px]"
              >
                {labels[i]}
              </text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PADDING.top} y2={PADDING.top + plotHeight} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={1} />}
            {series.map((s) => (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                />
                {/* End marker: 8px dot with a 2px ring in the card surface colour. */}
                <circle cx={x(last)} cy={y(s.values[last] ?? 0)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
                {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />}
              </g>
            ))}
            {/* Direct end labels in text ink (never the series colour); nudged apart if they would collide. */}
            {(() => {
              const placed: number[] = [];
              return series.map((s) => {
                let ly = y(s.values[last] ?? 0);
                for (const other of placed) if (Math.abs(other - ly) < 12) ly = other + (ly >= other ? 12 : -12);
                placed.push(ly);
                return (
                  <text key={s.key} x={x(last) + 8} y={ly} dy="0.32em" className="fill-foreground text-[11px] font-medium tabular-nums">
                    {s.values[last] ?? 0}
                    <tspan className="fill-muted-foreground font-normal"> {s.label.toLowerCase()}</tspan>
                  </text>
                );
              });
            })()}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div
            role="status"
            className={cn(
              "pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md",
              x(hover) > width / 2 ? "-translate-x-full" : "",
            )}
            style={{ left: x(hover) + (x(hover) > width / 2 ? -8 : 8) }}
          >
            <p className="mb-1 font-medium text-foreground">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold text-foreground tabular-nums">{s.values[hover] ?? 0}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
