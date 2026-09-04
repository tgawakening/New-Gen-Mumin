"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActivityShortcutLink({ href, notificationIds, alertText, children, className }: { href: string; notificationIds: string[]; alertText?: string | null; children: ReactNode; className: string }) {
  const router = useRouter();
  const [seen, setSeen] = useState(false);
  const count = seen ? 0 : notificationIds.length;
  async function markSeen() {
    if (!count) return;
    setSeen(true);
    await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: notificationIds }) }).catch(() => setSeen(false));
    router.refresh();
  }
  return <Link href={href} onClick={markSeen} title={alertText || undefined} className={className}>
    {children}
    {count ? <span title={alertText || `${count} new update${count === 1 ? "" : "s"}`} className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#d83939] px-1 text-[11px] font-bold text-white shadow-md">{count > 99 ? "99+" : count}</span> : null}
  </Link>;
}
