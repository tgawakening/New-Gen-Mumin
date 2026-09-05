import "server-only";

import { db } from "@/lib/db";

export type NavActivity = { count: number; ids: string[]; tooltip: string };
type NotificationRow = { id: string; title: string; body: string; href: string | null };
const searchable = (item: NotificationRow) => `${item.title} ${item.body} ${item.href ?? ""}`.toLowerCase();
function matchesNavigation(label: string, href: string, item: NotificationRow) {
  const value = searchable(item); const nav = `${label} ${href}`.toLowerCase();
  if (nav.includes("live house point")) return /class has started|live class|meeting started|house point/.test(value);
  if (nav.includes("live session") || nav.includes("schedule") || nav.includes("live class")) return /live.class|class has started|meeting started|\/schedule|\/live-sessions|\/classes/.test(value);
  if (nav.includes("quiz")) return /quiz|\/quizzes/.test(value);
  if (nav.includes("sunnah") || nav.includes("mission")) return /sunnah|mission|\/missions/.test(value);
  if (nav.includes("community") || nav.includes("qabila")) return /community|qabila/.test(value);
  if (nav.includes("reward") || nav.includes("recognition")) return /house point|reward|recognition|badge|\/rewards/.test(value);
  if (nav.includes("attendance")) return /attendance/.test(value);
  if (nav.includes("feedback")) return /feedback/.test(value);
  if (nav.includes("recording")) return /recording/.test(value);
  if (nav.includes("journal")) return /journal|reflection/.test(value);
  if (nav.includes("order")) return /order|payment|subscription/.test(value);
  if (nav.includes("student")) return /student|registration|enrol/.test(value);
  if (nav.includes("teacher report") || nav.includes("hours log")) return /teacher report|hours log/.test(value);
  return false;
}
export async function getNavigationActivity<T extends { label: string; href: string }>(userId: string, items: T[]): Promise<Array<T & { activity?: NavActivity }>> {
  try {
    const unread = await db.notification.findMany({ where: { userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, body: true, href: true } });
    return items.map((item) => { const matches = unread.filter((notification) => matchesNavigation(item.label, item.href, notification)); const latest = matches[0]; return { ...item, activity: latest ? { count: matches.length, ids: matches.map((entry) => entry.id), tooltip: `${latest.title}: ${latest.body}` } : undefined }; });
  } catch (error) {
    console.error("Navigation activity unavailable", error);
    return items;
  }
}
