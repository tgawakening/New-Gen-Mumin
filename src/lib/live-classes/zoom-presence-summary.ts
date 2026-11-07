import { connectedSeconds, presenceProgramme, WEEKLY_PRESENCE_REQUIREMENTS, type PresenceProgramme } from "./zoom-presence-policy";

export type PresenceInterval = {
  id: string; studentId: string | null; parentId: string | null; meetingUuid: string | null;
  participantName: string | null; joinedAt: Date; leftAt: Date | null;
  evidenceSource: string; matchMethod: string | null;
  sessionStartedAt: Date | null; sessionEndedAt: Date | null;
  schedule: { title: string; program: { title: string; slug: string } };
};
export function pktDay(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function shiftPresenceDay(day: string, amount: number) { const date = new Date(day + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
export function mondayPresenceDay(day: string) { const weekday = new Date(day + "T12:00:00Z").getUTCDay(); return shiftPresenceDay(day, -(weekday === 0 ? 6 : weekday - 1)); }
export function validPresenceMonth(value: string, now = new Date()) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) && value <= pktDay(now).slice(0, 7);
}
export function presenceMonthBounds(month: string) {
  const start = new Date(`${month}-01T00:00:00+05:00`);
  const next = new Date(`${month}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  const endDay = next.toISOString().slice(0, 10);
  return { start, end: new Date(endDay + "T00:00:00+05:00"), endDay };
}

/** A completion is one 60-minute teaching day, capped at the weekly programme quota. */
export function buildZoomPresenceSummary(month: string, intervals: PresenceInterval[], enrolled: Array<{ slug: string; title: string; startedAt: Date }>, now = new Date()) {
  const bounds = presenceMonthBounds(month);
  const startDay = `${month}-01`, finalDay = shiftPresenceDay(bounds.endDay, -1);
  const subjects = new Map<PresenceProgramme, Date>();
  for (const programme of enrolled) {
    const subject = presenceProgramme(programme.title, programme.slug);
    if (subject && (!subjects.has(subject) || subjects.get(subject)! > programme.startedAt)) subjects.set(subject, programme.startedAt);
  }
  if (!subjects.has("parental") && intervals.some(row => row.parentId)) subjects.set("parental", bounds.start);
  const actorKey = (row: PresenceInterval) => `${row.studentId ?? "parent:" + row.parentId}:${row.meetingUuid}`;
  const authoritative = new Set(intervals.filter(row => row.meetingUuid && row.evidenceSource === "zoom-report").map(actorKey));
  const firstJoin = new Map<string, Date>();
  for (const row of intervals) if (row.meetingUuid && (!firstJoin.has(actorKey(row)) || firstJoin.get(actorKey(row))! > row.joinedAt)) firstJoin.set(actorKey(row), row.joinedAt);
  const days = new Map<string, { subject: PresenceProgramme; day: string; sessions: Set<string>; ranges: Array<{ joinedAt: Date; leftAt: Date | null }> }>();
  for (const row of intervals) {
    if (["legacy", "inferred-close"].includes(row.evidenceSource)) continue;
    if (row.meetingUuid && authoritative.has(actorKey(row)) && row.evidenceSource !== "zoom-report") continue;
    const subject = row.parentId ? "parental" : presenceProgramme(row.schedule.title, row.schedule.program.slug);
    if (!subject || !subjects.has(subject) || (subject === "parental" && !row.parentId)) continue;
    const start = new Date(Math.max(row.joinedAt.getTime(), bounds.start.getTime(), subjects.get(subject)!.getTime(), row.sessionStartedAt?.getTime() ?? -Infinity));
    const end = row.leftAt ? new Date(Math.min(row.leftAt.getTime(), bounds.end.getTime(), row.sessionEndedAt?.getTime() ?? Infinity)) : null;
    if (!end || end <= start) continue;
    // A midnight-crossing class belongs to its teaching start day; monthly time is still clipped.
    const day = pktDay(row.sessionStartedAt ?? (row.meetingUuid ? firstJoin.get(actorKey(row)) : undefined) ?? row.joinedAt);
    const key = `${subject}:${day}`;
    const group = days.get(key) ?? { subject, day, sessions: new Set<string>(), ranges: [] };
    group.sessions.add(row.meetingUuid ?? row.schedule.title + ":" + day);
    group.ranges.push({ joinedAt: start, leftAt: end }); days.set(key, group);
  }
  const daily = [...days.values()].map(row => ({ subject: row.subject, day: row.day, joinedSessions: row.sessions.size, seconds: connectedSeconds(row.ranges) }));
  const weeks: Array<{ week: string; endDay: string; programmes: Array<{ subject: PresenceProgramme; required: number; completed: number; joinedSessions: number; minutes: number; assessable: boolean; state: string }> }> = [];
  for (let week = mondayPresenceDay(startDay); week <= finalDay; week = shiftPresenceDay(week, 7)) {
    const endDay = shiftPresenceDay(week, 7);
    const fullCalendarWeek = week >= startDay && endDay <= bounds.endDay;
    const closed = new Date(endDay + "T00:00:00+05:00") <= now;
    const programmes = [...subjects.entries()].map(([subject, enrolledAt]) => {
      const related = daily.filter(row => row.subject === subject && row.day >= week && row.day < endDay && new Date(row.day + "T23:59:59+05:00") >= enrolledAt);
      const required = WEEKLY_PRESENCE_REQUIREMENTS[subject];
      const completed = Math.min(required, related.filter(row => row.seconds >= 3600).length);
      const assessable = fullCalendarWeek && closed && enrolledAt <= new Date(week + "T00:00:00+05:00");
      return { subject, required, completed, joinedSessions: related.reduce((sum, row) => sum + row.joinedSessions, 0), minutes: Math.floor(related.reduce((sum, row) => sum + row.seconds, 0) / 60), assessable, state: assessable ? completed >= required ? "Completed" : "Below target / evidence pending" : closed ? "Partial week" : "In progress" };
    });
    weeks.push({ week, endDay: shiftPresenceDay(endDay, -1), programmes });
  }
  return { month, weeks, daily, programmeTotals: [...subjects.keys()].map(subject => {
    const related = daily.filter(row => row.subject === subject);
    const assessed = weeks.flatMap(week => week.programmes.filter(row => row.subject === subject && row.assessable));
    return { subject, joinedSessions: related.reduce((sum, row) => sum + row.joinedSessions, 0), minutes: Math.floor(related.reduce((sum, row) => sum + row.seconds, 0) / 60), completed: assessed.reduce((sum, row) => sum + row.completed, 0), required: assessed.reduce((sum, row) => sum + row.required, 0) };
  }) };
}
