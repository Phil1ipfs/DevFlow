"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@/lib/query";
import { ChevronLeft, ChevronRight, LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { ClearFilters, PriorityFilter, SearchInput } from "@/components/tasks/task-filters";
import { AssigneeAvatar, PriorityIcon } from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import type { Priority } from "@/lib/api/tasks";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  ticketsQuery,
  type TicketCategory,
  type TicketScope,
  type TicketStatus,
} from "@/lib/api/tickets";
import { timeAgo } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { NewTicketDialog } from "./new-ticket-dialog";
import { TicketStatusLabel } from "./ticket-meta";

const ACTIVE: TicketStatus[] = ["Open", "InProgress", "WaitingOnRequester"];
const ANY = "__any__";

export function TicketsView() {
  const router = useRouter();
  const { active, isAdmin } = useOrganization();
  const { params, set } = useUrlState();
  const [creating, setCreating] = useState(false);

  // Agents start on the whole queue; members on the tickets they raised.
  const scope = (params.get("scope") as TicketScope) || (isAdmin ? "All" : "Requested");
  const status = params.get("status") ?? "active";
  const priority = params.get("priority") ?? "";
  const category = params.get("category") ?? "";
  const search = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;

  const filters = {
    scope,
    status: status === "active" ? ACTIVE : status === "all" ? undefined : [status as TicketStatus],
    priority: (priority || undefined) as Priority | undefined,
    category: (category || undefined) as TicketCategory | undefined,
    search: search || undefined,
    page,
  };
  const { data, isPending, isPlaceholderData } = useQuery({ ...ticketsQuery(active?.id ?? "", filters), enabled: Boolean(active) });
  const filtersActive = Boolean(priority || category || search || status !== "active");

  const scopes: { value: TicketScope; label: string }[] = isAdmin
    ? [
        { value: "All", label: "Queue" },
        { value: "Assigned", label: "Assigned to me" },
        { value: "Requested", label: "My requests" },
      ]
    : [
        { value: "Requested", label: "My requests" },
        { value: "Assigned", label: "Assigned to me" },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        description={isAdmin ? "The IT helpdesk queue, most urgent first." : "Ask the IT team for help and follow your requests."}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            New ticket
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Ticket views" className="inline-flex rounded-lg border p-0.5">
          {scopes.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={scope === s.value}
              onClick={() => set({ scope: s.value, page: null })}
              className={cn(
                "h-7 rounded-md px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                scope === s.value ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <SearchInput key={search} value={search} placeholder="Search subject or #number…" onChange={(q) => set({ q, page: null })} />
        <Select value={status} onValueChange={(v) => set({ status: v === "active" ? null : v, page: null })}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (not resolved)</SelectItem>
            <SelectItem value="all">Any status</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TICKET_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PriorityFilter value={priority} onChange={(p) => set({ priority: p, page: null })} />
        <Select value={category || ANY} onValueChange={(v) => set({ category: v === ANY ? null : v, page: null })}>
          <SelectTrigger aria-label="Filter by category" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any category</SelectItem>
            {TICKET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TICKET_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ClearFilters active={filtersActive} onClear={() => set({ status: null, priority: null, category: null, q: null, page: null })} />
      </div>

      {!active || (isPending && !data) ? (
        <div className="space-y-2" role="status" aria-label="Loading tickets">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={filtersActive ? "No tickets match these filters" : scope === "All" ? "The queue is empty" : "No tickets here yet"}
          description={
            filtersActive
              ? "Try another search or show all statuses."
              : scope === "All"
                ? "New requests from your organization will appear here, most urgent first."
                : "When you need help from IT, open a ticket and follow its progress here."
          }
          actions={
            filtersActive ? (
              <Button variant="outline" onClick={() => set({ status: null, priority: null, category: null, q: null })}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                New ticket
              </Button>
            )
          }
        />
      ) : (
        <div className={cn("space-y-3 transition-opacity", isPlaceholderData && "opacity-60")}>
          <ul className="relative divide-y overflow-hidden rounded-xl border bg-card">
            {data.items.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/app/tickets/${ticket.id}`)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:bg-muted/50 sm:flex-nowrap"
                >
                  <PriorityIcon priority={ticket.priority} />
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">#{ticket.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{ticket.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ticket.requester.displayName} · {TICKET_CATEGORY_LABEL[ticket.category]} · updated {timeAgo(ticket.updatedAt)}
                    </span>
                  </span>
                  {ticket.commentCount > 0 && (
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                      <MessageSquare className="size-3" aria-hidden />
                      <span className="sr-only">Replies:</span>
                      {ticket.commentCount}
                    </span>
                  )}
                  <TicketStatusLabel status={ticket.status} className="w-40 text-xs text-muted-foreground" />
                  <AssigneeAvatar user={ticket.assignee} />
                </button>
              </li>
            ))}
          </ul>
          <nav aria-label="Pagination" className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {data.totalCount} {data.totalCount === 1 ? "ticket" : "tickets"}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 === 1 ? null : String(data.page - 1) })}>
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
              <span className="px-2 tabular-nums">
                Page {data.page} of {data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => set({ page: String(data.page + 1) })}>
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </nav>
        </div>
      )}

      {active && <NewTicketDialog organizationId={active.id} open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
