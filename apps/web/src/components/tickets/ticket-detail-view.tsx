"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/query";
import { ChevronLeft, Lock, TicketX } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app-shell/empty-state";
import { initials } from "@/components/app-shell/user-menu";
import { PrioritySelect } from "@/components/tasks/task-fields";
import { PriorityLabel } from "@/components/tasks/task-meta";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MemberSelect } from "@/components/workspace/member-select";
import { useOrganization } from "@/components/workspace/organization-provider";
import { isApiError } from "@/lib/api/client";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  ticketCommentsQuery,
  ticketQuery,
  useAddTicketComment,
  useUpdateTicket,
  type TicketDetail,
  type TicketStatus,
  type TicketUpdate,
} from "@/lib/api/tickets";
import { useCurrentUser } from "@/lib/auth/auth-api";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TicketStatusLabel } from "./ticket-meta";

function Conversation({ ticket }: { ticket: TicketDetail }) {
  const { data: comments, isPending } = useQuery(ticketCommentsQuery(ticket.id));
  const add = useAddTicketComment(ticket.id);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);

  async function send() {
    if (!draft.trim()) return;
    try {
      await add.mutateAsync({ body: draft, isInternal: internal });
      setDraft("");
      setInternal(false);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Couldn't send the reply.");
    }
  }

  return (
    <section aria-labelledby="conversation-heading" className="space-y-4">
      <h2 id="conversation-heading" className="text-sm font-semibold">
        Conversation
      </h2>
      {isPending ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : comments?.length ? (
        <ol className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn("rounded-xl border p-4", comment.isInternal ? "border-warning/40 bg-warning/5" : "bg-card")}
            >
              <div className="flex items-center gap-2 text-xs">
                <Avatar className="size-6">
                  <AvatarFallback className="bg-secondary text-[9px]">{initials(comment.author.displayName)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{comment.author.displayName}</span>
                {comment.author.id === ticket.requester.id && <Badge variant="outline">Requester</Badge>}
                {comment.isInternal && (
                  <Badge variant="outline" className="gap-1 border-warning/50">
                    <Lock className="size-3" aria-hidden />
                    Internal note
                  </Badge>
                )}
                <time dateTime={comment.createdAt} className="ml-auto text-muted-foreground" title={new Date(comment.createdAt).toLocaleString()}>
                  {timeAgo(comment.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      )}

      {ticket.status !== "Closed" && (
        <div className={cn("space-y-2 rounded-xl border p-3", internal && "border-warning/40 bg-warning/5")}>
          <Label htmlFor="ticketReply" className="sr-only">
            {internal ? "Internal note" : "Reply"}
          </Label>
          <Textarea
            id="ticketReply"
            rows={3}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            placeholder={internal ? "Internal note: only admins can see this…" : "Write a reply…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            }}
          />
          <div className="flex items-center gap-3">
            {ticket.permissions.canAddInternalNotes && (
              <div className="flex items-center gap-2">
                <Checkbox id="internalNote" checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
                <Label htmlFor="internalNote" className="text-xs font-normal text-muted-foreground">
                  Internal note
                </Label>
              </div>
            )}
            <Button size="sm" className="ml-auto" onClick={send} disabled={!draft.trim() || add.isPending}>
              {add.isPending ? "Sending…" : internal ? "Add note" : "Send reply"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Properties({ ticket }: { ticket: TicketDetail }) {
  const update = useUpdateTicket(ticket.id);
  const { user } = useCurrentUser();
  const { canTriage, canChangeStatus } = ticket.permissions;
  const isRequesterOnly = !canTriage && ticket.requester.id === user?.id && ticket.assignee?.id !== user?.id;

  async function save(change: TicketUpdate, message: string) {
    try {
      await update.mutateAsync(change);
      toast.success(message);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Couldn't save the change.");
    }
  }

  return (
    <Card>
      <CardContent>
        <dl className="grid gap-4">
          <Property label="Status">
            {canChangeStatus && !isRequesterOnly ? (
              <Select value={ticket.status} onValueChange={(v) => save({ status: v as TicketStatus }, `Status set to ${TICKET_STATUS_LABEL[v as TicketStatus]}`)}>
                <SelectTrigger aria-label="Status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <TicketStatusLabel status={s} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <TicketStatusLabel status={ticket.status} />
                {isRequesterOnly && (
                  <div>
                    {ticket.status === "Resolved" || ticket.status === "Closed" ? (
                      <Button size="sm" variant="outline" onClick={() => save({ status: "Open" }, "Ticket reopened")}>
                        Reopen ticket
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => save({ status: "Closed" }, "Ticket closed")}>
                        Close ticket
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Property>
          <Property label="Priority">
            {canTriage ? (
              <PrioritySelect aria-label="Priority" value={ticket.priority} onChange={(p) => save({ priority: p }, "Priority updated")} />
            ) : (
              <PriorityLabel priority={ticket.priority} />
            )}
          </Property>
          <Property label="Category">
            {canTriage ? (
              <Select value={ticket.category} onValueChange={(c) => save({ category: c as TicketDetail["category"] }, "Category updated")}>
                <SelectTrigger aria-label="Category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TICKET_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              TICKET_CATEGORY_LABEL[ticket.category]
            )}
          </Property>
          <Property label="Assignee">
            {canTriage ? (
              <MemberSelect
                aria-label="Assignee"
                organizationId={ticket.organizationId}
                value={ticket.assignee?.id ?? ""}
                noneLabel="Unassigned"
                onChange={(id) => save(id ? { assigneeId: id } : { clearAssignee: true }, id ? "Ticket assigned" : "Assignee removed")}
              />
            ) : (
              (ticket.assignee?.displayName ?? "Not assigned yet")
            )}
          </Property>
          <Property label="Requester">{ticket.requester.displayName}</Property>
          <Property label="Opened">{formatDate(ticket.createdAt)}</Property>
          {ticket.firstResponseAt && <Property label="First response">{timeAgo(ticket.firstResponseAt)}</Property>}
          {ticket.resolvedAt && <Property label="Resolved">{formatDate(ticket.resolvedAt)}</Property>}
        </dl>
      </CardContent>
    </Card>
  );
}

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const { data: ticket, isPending, error } = useQuery(ticketQuery(ticketId));
  const { active, setActive } = useOrganization();

  // Deep links (e.g. from a notification) switch to the ticket's workspace.
  useEffect(() => {
    if (ticket && active && ticket.organizationId !== active.id) setActive(ticket.organizationId);
  }, [ticket, active, setActive]);

  if (isPending) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading ticket">
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={TicketX}
        title={isApiError(error, 404) ? "Ticket not found" : "Couldn't load this ticket"}
        description={isApiError(error, 404) ? "It doesn't exist, or you don't have access to it." : error.message}
        actions={
          <Button asChild variant="outline">
            <Link href="/app/tickets">All tickets</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/app/tickets" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" aria-hidden />
          Tickets
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="mr-2 font-mono text-lg text-muted-foreground">#{ticket.number}</span>
          {ticket.subject}
        </h1>
        <p className="text-sm text-muted-foreground">
          Opened by {ticket.requester.displayName} {timeAgo(ticket.createdAt)} · <TicketStatusLabel status={ticket.status} className="align-middle" />
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap break-words">{ticket.description}</p>
            </CardContent>
          </Card>
          <Conversation ticket={ticket} />
        </div>
        <aside aria-label="Ticket properties">
          <Properties ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}
