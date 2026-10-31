import "server-only";

import { db } from "@/lib/db";
import { parseTaskPayload } from "@/lib/genm/published-content";
import { homeworkIsOpen } from "@/lib/homework/timing";
import { loadModuleSharing, moduleIsShared } from "@/lib/curriculum/handover";

export type NavActivity = { count: number; ids: string[]; tooltip: string; persistent?: boolean };
type NotificationRow = { id: string; title: string; body: string; href: string | null };
const searchable = (item: NotificationRow) => `${item.title} ${item.body} ${item.href ?? ""}`.toLowerCase();
function matchesNavigation(label: string, href: string, item: NotificationRow) {
  const value = searchable(item); const nav = `${label} ${href}`.toLowerCase();
  if (nav.includes("live house point") || nav.includes("live points & recognition")) return /class has started|live class|meeting started|house point/.test(value);
  if (nav.includes("live session") || nav.includes("schedule") || nav.includes("live class")) return /live.class|class has started|meeting started|\/schedule|\/live-sessions|\/classes/.test(value);
  if (nav.includes("homework")) return /homework|task.*assigned|task.*submitted|assignment/.test(value);
  if (nav.includes("quiz")) return /quiz|\/quizzes/.test(value);
  if (nav.includes("fardh")) return /fardh|salah|prayer|\/fardh-tracker/.test(value);
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
    return await Promise.all(items.map(async (item) => {
      if (item.href.startsWith("/parent/homework")) {
        const child = new URL(item.href, "https://local.invalid").searchParams.get("child");
        const rows = await db.notification.findMany({ where: { userId, readAt: null, href: { startsWith: child ? `/parent/homework?child=${encodeURIComponent(child)}&` : "/parent/homework?" } }, select: { id: true, href: true }, take: 1000 });
        const taskId = (href: string | null) => new URLSearchParams(href?.split("?")[1]).get("task") || "";
        const tasks = rows.length ? await db.assignment.findMany({ where: { id: { in: [...new Set(rows.map(row => taskId(row.href)))] } }, select: { id: true, programId: true, instructions: true } }) : [];
        const sharing = tasks.length ? await loadModuleSharing([...new Set(tasks.map(task => task.programId))]) : {};
        const visible = new Set(tasks.filter(task => { const parsed = parseTaskPayload(task.instructions); return homeworkIsOpen(parsed.launchAt) && moduleIsShared(sharing, task.programId, parsed.termId, parsed.weekLabel); }).map(task => task.id));
        const active = rows.filter(row => visible.has(taskId(row.href)));
        return { ...item, activity: active.length ? { count: active.length, ids: active.map(row => row.id), tooltip: "New homework to review", persistent: true } : undefined };
      }
      if (item.href.startsWith("/parent/curriculum")) {
        const child = new URL(item.href, "https://local.invalid").searchParams.get("child");
        const where = { userId, readAt: null, href: { startsWith: "/parent/curriculum?" }, ...(child ? { AND: [{ href: { contains: `&child=${encodeURIComponent(child)}&` } }] } : {}) };
        const [count, rows] = await Promise.all([db.notification.count({ where }), db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, body: true } })]);
        return { ...item, activity: count ? { count, ids: rows.map((row) => row.id), tooltip: "New or updated curriculum to review", persistent: true } : undefined };
      }
      const matches = unread.filter((notification) => matchesNavigation(item.label, item.href, notification)); const latest = matches[0]; return { ...item, activity: latest ? { count: matches.length, ids: matches.map((entry) => entry.id), tooltip: `${latest.title}: ${latest.body}` } : undefined };
    }));
  } catch (error) {
    console.error("Navigation activity unavailable", error);
    return items;
  }
}
