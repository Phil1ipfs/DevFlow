"use client";

import { useQuery } from "@/lib/query";
import { ChevronLeft, ChevronRight, ScrollText, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { auditLogQuery } from "@/lib/api/insights";
import { timeAgo } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "", label: "All activity" },
  { value: "member.", label: "Members & roles" },
  { value: "invitation.", label: "Invitations" },
  { value: "project.", label: "Projects" },
  { value: "organization.", label: "Workspace" },
];
const ALL = "__all__";

export function AuditLogPanel() {
  const { active, isAdmin } = useOrganization();
  const { params, set } = useUrlState();
  const action = params.get("action") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const { data, isPending, isPlaceholderData } = useQuery({
    ...auditLogQuery(active?.id ?? "", action, page),
    enabled: Boolean(active) && isAdmin,
  });

  if (active && !isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admins only"
        description="The audit log shows who changed what in this workspace. Ask an admin if you need to review it."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Audit log</CardTitle>
          <CardDescription>A permanent record of administrative actions in this workspace.</CardDescription>
        </div>
        <Select value={action || ALL} onValueChange={(v) => set({ action: v === ALL ? null : v, page: null })}>
          <SelectTrigger aria-label="Filter audit log" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.label} value={c.value || ALL}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-0">
        {!active || (isPending && !data) ? (
          <div className="space-y-2 px-6" role="status" aria-label="Loading audit log">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : !data?.items.length ? (
          <div className="px-6">
            <EmptyState icon={ScrollText} title="Nothing recorded yet" description="Actions such as role changes and invitations will appear here." />
          </div>
        ) : (
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            <ol className="divide-y border-y">
              {data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 sm:px-6">
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{entry.actor?.displayName ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">·</span> {entry.summary}
                  </p>
                  <span className="font-mono text-[11px] text-muted-foreground">{entry.action}</span>
                  <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()} className="w-24 text-right text-xs text-muted-foreground">
                    {timeAgo(entry.createdAt)}
                  </time>
                  {entry.ipAddress && <span className="w-full text-xs text-muted-foreground">from {entry.ipAddress}</span>}
                </li>
              ))}
            </ol>
            <nav aria-label="Pagination" className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground sm:px-6">
              <span>{data.totalCount} entries</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 === 1 ? null : String(data.page - 1) })}>
                  <ChevronLeft data-icon="inline-start" />
                  Newer
                </Button>
                <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => set({ page: String(data.page + 1) })}>
                  Older
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </nav>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
