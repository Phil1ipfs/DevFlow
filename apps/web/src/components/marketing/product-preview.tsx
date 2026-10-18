import { FolderKanban, LayoutDashboard, LifeBuoy, ListChecks, Search, SlidersHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { BoardPreview } from "@/components/board/board-preview";
import { SAMPLE_BOARD } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: FolderKanban, label: "Projects", active: true },
  { icon: ListChecks, label: "My tasks" },
  { icon: LifeBuoy, label: "Tickets" },
];

/**
 * Static illustration of the DevFlow workspace, drawn with real components rather than a
 * screenshot so it follows the theme. Hidden from assistive tech, and captioned as illustrative.
 */
export function ProductPreview() {
  return (
    <figure className="relative mx-auto max-w-5xl">
      <div
        aria-hidden
        className="absolute -inset-x-6 -top-6 bottom-0 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/15 to-transparent blur-2xl"
      />
      <div
        aria-hidden
        inert
        className="overflow-hidden rounded-xl border bg-background shadow-2xl ring-1 shadow-black/10 ring-black/5 select-none dark:shadow-black/50 dark:ring-white/5"
      >
        <div className="flex">
          <aside className="hidden w-48 shrink-0 border-r bg-sidebar p-3 md:block">
            <div className="flex items-center gap-2 px-1.5 pb-4">
              <LogoMark className="size-5" />
              <span className="text-xs font-semibold">Platform team</span>
            </div>
            <ul className="space-y-0.5">
              {NAV.map(({ icon: Icon, label, active }) => (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80",
                    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <p className="truncate text-xs">
                <span className="text-muted-foreground">Projects / </span>
                <span className="font-medium">Web platform</span>
              </p>
              <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
                <span className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] sm:flex">
                  <Search className="size-3" /> Filter tasks
                </span>
                <span className="grid size-6 place-items-center rounded-md border">
                  <SlidersHorizontal className="size-3" />
                </span>
              </div>
            </div>
            {/* Phones show two rows of columns, so cap the height and fade the overflow. */}
            <div className="max-h-[340px] overflow-hidden p-3 [mask-image:linear-gradient(to_bottom,black_80%,transparent)] sm:p-4 lg:[mask-image:none]">
              <BoardPreview columns={SAMPLE_BOARD} compact className="grid-cols-2 lg:grid-cols-4" />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">
        Illustrative preview with sample data.
      </figcaption>
    </figure>
  );
}
