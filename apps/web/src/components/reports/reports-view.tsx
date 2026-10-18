"use client";

import { useQuery } from "@/lib/query";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { initials } from "@/components/app-shell/user-menu";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard, StatTile } from "@/components/charts/chart-card";
import { LineChart } from "@/components/charts/line-chart";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { reportQuery, type DailyPoint } from "@/lib/api/insights";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/api/tasks";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, type TicketCategory, type TicketStatus } from "@/lib/api/tickets";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;

function hours(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 48) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} days`;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendCard({ title, description, daily, createdLabel, completedLabel }: {
  title: string;
  description: string;
  daily: DailyPoint[];
  createdLabel: string;
  completedLabel: string;
}) {
  const labels = daily.map((p) => shortDate(p.date));
  return (
    <ChartCard
      title={title}
      description={description}
      chart={
        <LineChart
          labels={labels}
          description={`${title}: ${createdLabel.toLowerCase()} and ${completedLabel.toLowerCase()} per day`}
          series={[
            { key: "created", label: createdLabel, color: "var(--viz-1)", values: daily.map((p) => p.created) },
            { key: "completed", label: completedLabel, color: "var(--viz-2)", values: daily.map((p) => p.completed) },
          ]}
        />
      }
      table={{ columns: ["Day", createdLabel, completedLabel], rows: daily.map((p, i) => [labels[i], p.created, p.completed]) }}
    />
  );
}

export function ReportsView() {
  const { active } = useOrganization();
  const { params, set } = useUrlState();
  const days = PERIODS.includes(Number(params.get("days")) as never) ? Number(params.get("days")) : 30;
  const { data, isPending, isPlaceholderData, error } = useQuery({ ...reportQuery(active?.id ?? "", days), enabled: Boolean(active) });

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          {active ? `Delivery and helpdesk activity in ${active.name}.` : " "}
          {data && <> Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, refreshed every minute.</>}
        </p>
      </div>
      {/* Date range first, in one row above everything it scopes. */}
      <div role="radiogroup" aria-label="Period" className="inline-flex rounded-lg border p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={days === p}
            onClick={() => set({ days: p === 30 ? null : String(p) })}
            className={cn(
              "h-7 rounded-md px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              days === p ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Last {p} days
          </button>
        ))}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={BarChart3} title="Couldn't load reports" description={error.message} />
      </div>
    );
  }

  if (!active || (isPending && !data) || !data) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading reports">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const { tasks, tickets } = data;

  return (
    // While another period loads, keep the current charts on screen at reduced opacity.
    <div className={cn("space-y-8 transition-opacity", isPlaceholderData && "opacity-60")} aria-busy={isPlaceholderData}>
      {header}

      <section aria-labelledby="tasks-heading" className="space-y-4">
        <h2 id="tasks-heading" className="text-lg font-semibold tracking-tight">
          Tasks
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open tasks" value={tasks.open.toLocaleString()} />
          <StatTile label="Overdue" value={tasks.overdue.toLocaleString()} note={tasks.overdue ? "Past their due date" : "Nothing overdue"} tone={tasks.overdue ? "warning" : undefined} />
          <StatTile label={`Completed, last ${days} days`} value={tasks.completedInPeriod.toLocaleString()} />
          <StatTile label="Average cycle time" value={hours(tasks.averageCycleHours)} note="From creation to done" />
        </div>
        <TrendCard title="Created vs completed" description="Tasks per day" daily={tasks.daily} createdLabel="Created" completedLabel="Completed" />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Tasks by status"
            description="All active tasks"
            chart={<BarList description="Tasks by status" data={tasks.byStatus.map((s) => ({ key: s.key, label: STATUS_LABEL[s.key as TaskStatus], value: s.count }))} />}
            table={{ columns: ["Status", "Tasks"], rows: tasks.byStatus.map((s) => [STATUS_LABEL[s.key as TaskStatus], s.count]) }}
          />
          <ChartCard
            title="Open tasks by priority"
            description="Not yet done"
            chart={<BarList description="Open tasks by priority" data={tasks.byPriority.map((p) => ({ key: p.key, label: PRIORITY_LABEL[p.key as Priority], value: p.count }))} />}
            table={{ columns: ["Priority", "Open tasks"], rows: tasks.byPriority.map((p) => [PRIORITY_LABEL[p.key as Priority], p.count]) }}
          />
        </div>
      </section>

      <section aria-labelledby="tickets-heading" className="space-y-4">
        <h2 id="tickets-heading" className="text-lg font-semibold tracking-tight">
          Helpdesk
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open tickets" value={tickets.open.toLocaleString()} />
          <StatTile label={`Resolved, last ${days} days`} value={tickets.resolvedInPeriod.toLocaleString()} />
          <StatTile label="Average first response" value={hours(tickets.averageFirstResponseHours)} note="Until an agent replied" />
          <StatTile label="Average resolution time" value={hours(tickets.averageResolutionHours)} note="From opened to resolved" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <TrendCard title="Opened vs resolved" description="Tickets per day" daily={tickets.daily} createdLabel="Opened" completedLabel="Resolved" />
          <ChartCard
            title="Open tickets by category"
            chart={
              <BarList
                description="Open tickets by category"
                data={tickets.byCategory.map((c) => ({ key: c.key, label: TICKET_CATEGORY_LABEL[c.key as TicketCategory], value: c.count }))}
              />
            }
            table={{ columns: ["Category", "Open tickets"], rows: tickets.byCategory.map((c) => [TICKET_CATEGORY_LABEL[c.key as TicketCategory], c.count]) }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Status totals:{" "}
          {tickets.byStatus.map((s, i) => (
            <span key={s.key}>
              {i > 0 && " · "}
              {TICKET_STATUS_LABEL[s.key as TicketStatus]} {s.count}
            </span>
          ))}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Workload</CardTitle>
          <CardDescription>Open tasks and tickets assigned to each member.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Workload per member</caption>
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium sm:px-6">Member</th>
                <th scope="col" className="w-28 px-4 py-2 text-right font-medium">Open tasks</th>
                <th scope="col" className="w-28 px-4 py-2 text-right font-medium sm:pr-6">Open tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.workload.map((row) => (
                <tr key={row.user.id}>
                  <td className="px-4 py-2.5 sm:px-6">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-secondary text-[9px]">{initials(row.user.displayName)}</AvatarFallback>
                      </Avatar>
                      {row.user.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.openTasks}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums sm:pr-6">{row.openTickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
