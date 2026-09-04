"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";

type NotificationItem = { id: string; title: string; body: string; href: string | null; createdAt: string; readAt: string | null };

export function NotificationBellClient({ notifications }: { notifications: NotificationItem[] }) {
  const initialUnread = notifications.filter((item) => !item.readAt).length;
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [marked, setMarked] = useState(false);
  async function markRead() {
    if (marked || unreadCount === 0) return;
    setMarked(true); setUnreadCount(0);
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => { setMarked(false); setUnreadCount(initialUnread); });
  }
  return <details className="group relative" onToggle={(event) => event.currentTarget.open && void markRead()}>
    <summary aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[#d9e2eb] bg-white text-[#22304a] [&::-webkit-details-marker]:hidden"><Bell className="h-4 w-4"/>{unreadCount?<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d63c3c] px-1 text-[11px] font-semibold text-white">{unreadCount}</span>:null}</summary>
    <div className="fixed inset-x-4 top-28 z-[80] max-h-[68vh] overflow-y-auto rounded-[22px] border border-[#dce4ed] bg-white p-4 shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-[70vh] sm:w-[min(400px,calc(100vw-2rem))]">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#22304a]">Recent notifications</p><p className="mt-0.5 text-xs text-[#617184]">Opening an alert keeps it in this history.</p></div>{unreadCount?<span className="rounded-full bg-[#fff0db] px-2.5 py-1 text-xs font-bold text-[#9a5b16]">{unreadCount} new</span>:null}</div>
      <div className="mt-3 space-y-2">{notifications.map((notification)=><Link key={notification.id} href={notification.href ?? "#"} className={`block rounded-2xl border px-3 py-3 text-sm transition hover:border-[#f0b45b] hover:bg-[#fffaf4] ${notification.readAt||marked?"border-[#edf0f4] bg-white":"border-[#f4cf97] bg-[#fff8ed]"}`}><div className="flex items-start justify-between gap-2"><p className="font-semibold text-[#22304a]">{notification.title}</p>{!notification.readAt&&!marked?<span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e78c24]"/>:null}</div><p className="mt-1 line-clamp-3 text-xs leading-5 text-[#617184]">{notification.body}</p><p className="mt-1.5 text-[11px] text-[#8a94a3]">{new Date(notification.createdAt).toLocaleString()}</p></Link>)}{!notifications.length?<p className="rounded-2xl bg-[#fbf6ef] px-3 py-3 text-sm text-[#617184]">No notifications yet.</p>:null}</div>
    </div>
  </details>;
}