import Link from "next/link";
import { Bell } from "lucide-react";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function NotificationBell() {
  const session = await getCurrentSession();
  if (!session) return null;

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <details className="group relative">
      <summary className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[#d9e2eb] bg-white text-[#22304a] [&::-webkit-details-marker]:hidden">
        <Bell className="h-4 w-4" />
        {notifications.length ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d63c3c] px-1 text-[11px] font-semibold text-white">
            {notifications.length}
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
