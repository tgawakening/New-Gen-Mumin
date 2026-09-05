"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import type { NavActivity } from "@/lib/notifications/navigation";

export function clearNavActivity(ids: string[]) {
  if (!ids.length) return;
  void fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }), keepalive: true });
}
export function NavActivityBadge({ activity, active = false }: { activity?: NavActivity; active?: boolean }) {
  const [visible, setVisible] = useState(Boolean(activity?.count));
  useEffect(() => { if (!active || !activity?.ids.length) return; const timer = window.setTimeout(() => { setVisible(false); clearNavActivity(activity.ids); }, 700); return () => window.clearTimeout(timer); }, [active, activity]);
  if (!activity || !visible) return null;
  return <span aria-label={`${activity.count} new updates`} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#dc3434] px-1 text-[11px] font-bold text-white shadow-md">{activity.count > 9 ? "9+" : activity.count}</span>;
}
export function NavActivityLink({ href, title, activity, active, className, children }: { href: string; title: string; activity?: NavActivity; active?: boolean; className: string; children: ReactNode }) {
  const [visible, setVisible] = useState(Boolean(activity?.count));
  useEffect(() => { if (!active || !activity?.ids.length) return; const timer = window.setTimeout(() => { setVisible(false); clearNavActivity(activity.ids); }, 700); return () => window.clearTimeout(timer); }, [active, activity]);
  return <Link href={href} title={visible && activity ? activity.tooltip : title} onClick={() => { if (activity?.ids.length) { setVisible(false); clearNavActivity(activity.ids); } }} className={`${className} relative`}>{children}{visible ? <NavActivityBadge activity={activity} /> : null}</Link>;
}