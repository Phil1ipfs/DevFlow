"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HttpTransportType, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationKeys, type Notification } from "@/lib/api/insights";
import { useCurrentUser } from "@/lib/auth/auth-api";

/**
 * Holds one SignalR connection while the user is signed in. Each pushed notification shows a
 * toast, bumps the bell and refreshes affected data so other people's changes appear without a
 * reload. If the connection drops, SignalR reconnects with back-off; meanwhile the bell's
 * periodic refetch keeps counts roughly current.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const connection = new HubConnectionBuilder()
      // Vercel cannot pass WebSockets through to the API, so long-poll there (Vercel exposes
      // NEXT_PUBLIC_VERCEL_ENV at build time). Elsewhere SignalR picks the best transport.
      .withUrl("/hubs/notifications", process.env.NEXT_PUBLIC_VERCEL_ENV ? { transport: HttpTransportType.LongPolling } : {})
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("notification", (notification: Notification) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      // Refresh whatever the notification is about (tasks, tickets, boards, counts).
      queryClient.invalidateQueries({
        predicate: (query) => ["tasks", "tickets", "projects", "organizations"].includes(String(query.queryKey[0])),
      });
      toast(notification.title, {
        description: notification.body ?? undefined,
        action: { label: "Open", onClick: () => router.push(notification.link) },
      });
    });

    let stopped = false;
    connection.start().catch((error) => {
      if (!stopped) console.warn("Real-time notifications unavailable; falling back to polling.", error);
    });

    return () => {
      stopped = true;
      connection.stop();
    };
  }, [userId, queryClient, router]);

  return children;
}
