"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@/lib/query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/workspace/organization-provider";
import { notificationsQuery, unreadCountQuery, useMarkAllNotificationsRead, useMarkNotificationRead, type Notification } from "@/lib/api/insights";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function NotificationItem({ notification, onOpen }: { notification: Notification; onOpen: (n: Notification) => void }) {
  const unread = !notification.readAt;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full gap-3 px-4 py-3 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", unread ? "font-medium" : "text-muted-foreground")}>
            {notification.title}
            {unread && <span className="sr-only"> (unread)</span>}
          </span>
          {notification.body && <span className="block truncate text-xs text-muted-foreground">{notification.body}</span>}
          <time dateTime={notification.createdAt} className="mt-0.5 block text-xs text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </time>
        </span>
      </button>
    </li>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { organizations, active, setActive } = useOrganization();
  const unread = useQuery(unreadCountQuery);
  const list = useQuery({ ...notificationsQuery, enabled: open });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data?.count ?? 0;

  function openNotification(notification: Notification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    // Notifications can come from any of the user's workspaces; switch to the right one first.
    if (notification.organizationId !== active?.id && organizations?.some((o) => o.id === notification.organizationId)) {
      setActive(notification.organizationId);
    }
    setOpen(false);
    router.push(notification.link);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
          <Bell />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" disabled={count === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck data-icon="inline-start" />
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {list.isPending ? (
            <div className="space-y-2 p-4" role="status" aria-label="Loading notifications">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : list.data?.items.length ? (
            <ul className="divide-y">
              {list.data.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onOpen={openNotification} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
