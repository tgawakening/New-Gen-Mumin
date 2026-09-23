/** Alternative Seerah / Life Skills slots fulfil one requirement per PKT day. */
export function attendanceDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

export function alternativeAttendanceSubject(title: string) {
  if (/\b(?:seerah|seera|sirah|seerat)\b/i.test(title)) return "seerah";
  if (/\blife[\s-]*(?:skills?|lessons?)\b/i.test(title)) return "life-skills";
  return null;
}

type Attendance = {
  id: string;
  studentId: string;
  scheduleId: string | null;
  lessonDate: Date;
  status: string;
  durationMinutes: number | null;
  joinedAt?: Date | null;
  source?: string | null;
  schedule?: { title: string } | null;
  enrollment?: { program: { title: string } };
};

export function attendanceRequirementKey(record: Attendance) {
  const subject = alternativeAttendanceSubject(record.schedule?.title ?? "")
    ?? alternativeAttendanceSubject(record.enrollment?.program.title ?? "");
  const day = attendanceDayKey(record.lessonDate);
  return subject ? `${record.studentId}:${subject}:${day}`
    : record.scheduleId ? `${record.studentId}:${record.scheduleId}:${day}` : `manual:${record.id}`;
}

export function deduplicateAttendance<T extends Attendance>(records: T[]): Array<Omit<T, "status"> & { status: string }> {
  const rank: Record<string, number> = { PRESENT: 4, LATE: 3, EXCUSED: 2, ABSENT: 1, NEEDS_CONFIRMATION: 0 };
  const unique = new Map<string, Omit<T, "status"> & { status: string }>();
  for (const original of records) {
    const record: Omit<T, "status"> & { status: string } = original.status === "LATE" || original.joinedAt || (original.durationMinutes ?? 0) > 0
      ? { ...original, status: "PRESENT" }
      : original.source === "zoom-unverified" || (original.source === "zoom" && original.status === "ABSENT")
        ? { ...original, status: "NEEDS_CONFIRMATION" } : original;
    const key = attendanceRequirementKey(record);
    const current = unique.get(key);
    if (!current || (rank[record.status] ?? 0) > (rank[current.status] ?? 0)
      || (rank[record.status] === rank[current.status] && (record.durationMinutes ?? 0) > (current.durationMinutes ?? 0))) {
      unique.set(key, record);
    }
  }
  return [...unique.values()].sort((a, b) => b.lessonDate.getTime() - a.lessonDate.getTime());
}

/** Count closed connection time once, excluding disconnect gaps and overlaps. */
export function connectedMinutes(intervals: Array<{ joinedAt: Date; leftAt: Date | null }>) {
  const ranges = intervals.filter((entry) => entry.leftAt && entry.leftAt > entry.joinedAt)
    .map((entry) => [entry.joinedAt.getTime(), entry.leftAt!.getTime()] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [start, stop] of ranges) {
    total += Math.max(0, stop - Math.max(start, end));
    end = Math.max(end, stop);
  }
  return Math.round(total / 60_000);
}
