"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
};

export function NotificationBellClient({ notifications }: { notifications: NotificationItem[] }) {
  const [unreadCount, setUnreadCount] = useState(notifications.length);
  const [marked, setMarked] = useState(false);

  async function markRead() {
    if (marked || unreadCount === 0) return;
    setMarked(true);
    setUnreadCount(0);
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {
      setMarked(false);
      setUnreadCount(notifications.length);
    });
  }

  return (
    <details className="group relative" onToggle={(event) => event.currentTarget.open && void markRead()}>
      <summary className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[#d9e2eb] bg-white text-[#22304a] [&::-webkit-details-marker]:hidden">
        <Bell className="h-4 w-4" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d63c3c] px-1 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-50 mt-3 w-[min(360px,calc(100vw-2rem))] rounded-[22px] border border-[#dce4ed] bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-[#22304a]">Notifications</p>
        <div className="mt-3 space-y-2">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href ?? "#"}
              className="block rounded-2xl bg-[#fbf6ef] px-3 py-3 text-sm"
            >
              <p className="font-semibold text-[#22304a]">{notification.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#617184]">{notification.body}</p>
            </Link>
          ))}
          {!notifications.length ? (
            <p className="rounded-2xl bg-[#fbf6ef] px-3 py-3 text-sm text-[#617184]">
              No unread notifications.
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}
