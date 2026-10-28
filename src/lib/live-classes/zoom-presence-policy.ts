import { createHash } from "node:crypto";

export function zoomAttendanceCode(kind: "student" | "parent", id: string) {
  return `GM-${kind === "student" ? "S" : "P"}-${createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 12).toUpperCase()}`;
}

const normalized = (value?: string | null) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export type ZoomIdentityCandidate = { id: string; names: string[]; emails: string[] };
export function matchZoomIdentity(kind: "student" | "parent", candidates: ZoomIdentityCandidate[], name?: string | null, email?: string | null) {
  const codes = [...new Set(name?.toUpperCase().match(/\bGM-[SP]-[A-F0-9]{12}\b/g) ?? [])];
  if (codes.length > 1) return null;
  const code = codes[0];
  if (code) {
    const found = candidates.filter(candidate => zoomAttendanceCode(kind, candidate.id) === code);
    return found.length === 1 ? { id: found[0].id, method: "attendance-code" } : null;
  }
  const byName = candidates.filter(candidate => candidate.names.some(value => normalized(value) && normalized(value) === normalized(name)));
  const byEmail = email ? candidates.filter(candidate => candidate.emails.some(value => normalized(value) === normalized(email))) : [];
  if (byEmail.length === 1) return { id: byEmail[0].id, method: "zoom-email" };
  if (byEmail.length > 1) {
    const exact = byEmail.filter(candidate => byName.some(entry => entry.id === candidate.id));
    return exact.length === 1 ? { id: exact[0].id, method: "zoom-email-and-name" } : null;
  }
  return byName.length === 1 ? { id: byName[0].id, method: "display-name" } : null;
}

/** Milliseconds are merged before rounding: gaps and simultaneous devices never add twice. */
export function connectedSeconds(intervals: Array<{ joinedAt: Date; leftAt: Date | null }>, bounds?: { start: Date; end: Date }) {
  const ranges = intervals.flatMap(row => {
    if (!row.leftAt || !Number.isFinite(row.joinedAt.getTime()) || !Number.isFinite(row.leftAt.getTime())) return [];
    const start = Math.max(row.joinedAt.getTime(), bounds?.start.getTime() ?? -Infinity);
    const end = Math.min(row.leftAt.getTime(), bounds?.end.getTime() ?? Infinity);
    return end > start ? [[start, end] as const] : [];
  }).sort((a, b) => a[0] - b[0]);
  let total = 0, previousEnd = -Infinity;
  for (const [start, end] of ranges) { total += Math.max(0, end - Math.max(start, previousEnd)); previousEnd = Math.max(previousEnd, end); }
  return Math.floor(total / 1000);
}

export type PresenceProgramme = "arabic" | "seerah" | "leadership" | "parental";
export function presenceProgramme(title: string, slug = ""): PresenceProgramme | null {
  const text = `${title} ${slug}`;
  if (/\[Category:PARENTAL\]|\bparent(?:al|ing|s)?\b/i.test(text)) return "parental";
  if (/\barabic\b|\btajweed\b/i.test(text)) return "arabic";
  if (/\bseerah\b|\bseera\b|\bsirah\b|\bseerat\b/i.test(text)) return "seerah";
  if (/\bleadership\b|\blife[\s-]*(?:skills?|lessons?)\b/i.test(text)) return "leadership";
  return null;
}
export const WEEKLY_PRESENCE_REQUIREMENTS = { arabic: 3, seerah: 1, leadership: 1, parental: 1 } as const;

export type RoutingSchedule = { id: string; title: string; weekday: number; startTime: string; endTime: string; timezone: string; startsOn: Date | null; endsOn: Date | null; teacher: { user: { email: string } } };
export function selectZoomAttendanceSchedule<T extends RoutingSchedule>(schedules: T[], at: Date, topic?: string, hostEmail?: string) {
  const clean = (text: string) => text.replace(/\[[^\]]*\]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let pool = schedules.filter(s => (!s.startsOn || s.startsOn.getTime() <= at.getTime() + 86400000) && (!s.endsOn || s.endsOn.getTime() + 86400000 >= at.getTime()));
  const topicMatches = topic ? pool.filter(s => clean(s.title) === clean(topic)) : [];
  if (topicMatches.length) pool = topicMatches;
  const hostMatches = hostEmail ? pool.filter(s => normalized(s.teacher.user.email) === normalized(hostEmail)) : [];
  if (hostMatches.length) pool = hostMatches;
  if (pool.length === 1 && topicMatches.length === 1) return pool[0];
  const timed = pool.filter(s => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: s.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
      const value = (key: string) => parts.find(p => p.type === key)?.value ?? "";
      if (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday")) !== s.weekday) return false;
      const minutes = Number(value("hour")) * 60 + Number(value("minute"));
      const parse = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
      return minutes >= parse(s.startTime) - 30 && minutes <= parse(s.endTime) + 120;
    } catch { return false; }
  });
  return timed.length === 1 ? timed[0] : null;
}
