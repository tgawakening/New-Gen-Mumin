import "server-only";

import { TeacherHoursLogSource, TeacherHoursLogStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { sendTeacherHoursSubmittedEmail } from "@/lib/email/notifications";
import { cleanLiveClassTitle, isLiveClassVisibleToStudents } from "@/lib/live-classes/service";

export const MIN_PAYABLE_TRACKED_SESSION_MINUTES = 15;
const HOURS_LOG_EXCLUDED_MARKER = "[HOURS_LOG_EXCLUDED]";

export type HoursLogFilter = {
  month?: string | null;
  start?: string | null;
  end?: string | null;
};

export function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseIsoDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addOneDay(value: Date) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function formatPeriodDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

export function parseHoursMonth(value?: string | null) {
  const key = value && /^\d{4}-\d{2}$/.test(value) ? value : monthKey(new Date());
  const [year, month] = key.split("-").map(Number);
  const startsAt = new Date(Date.UTC(year, month - 1, 1));
  const endsAt = new Date(Date.UTC(year, month, 1));
  return {
    key,
    startsAt,
    endsAt,
    startInput: startsAt.toISOString().slice(0, 10),
    endInput: new Date(endsAt.getTime() - 86400000).toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(startsAt),
    mode: "month" as const,
  };
}

export function parseHoursPeriod(filter?: HoursLogFilter | string | null) {
  const values = typeof filter === "string" ? { month: filter } : filter ?? {};
  const customStart = parseIsoDate(values.start);
  const customEnd = parseIsoDate(values.end);

  if (customStart && customEnd && customEnd >= customStart) {
    const endsAt = addOneDay(customEnd);
    return {
      key: monthKey(customStart),
      startsAt: customStart,
      endsAt,
      startInput: customStart.toISOString().slice(0, 10),
      endInput: customEnd.toISOString().slice(0, 10),
      label: `${formatPeriodDate(customStart)} to ${formatPeriodDate(customEnd)}`,
      mode: "range" as const,
    };
  }

  return parseHoursMonth(values.month);
}

export function formatHoursMinutes(minutes: number) {
  const safeMinutes = Math.max(0, minutes || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (!hours) return `${remaining} min`;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function displayName(user: { firstName: string; lastName: string | null; email: string }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.email;
}

function occurrenceMode(source: string) {
  if (source === "teacher-member-start") return "Website / TGA Zoom member";
  if (source === "zoom-recording") return "Website / Zoom recording";
  return "Website / TGA Zoom host";
}

function isTeacherEditedTrackedRow(notes?: string | null) {
  return Boolean(notes?.includes("Teacher edited from original:") || notes?.includes("Admin edited from original:"));
}

function duplicateTrackedOccurrenceIds(occurrences: Array<{
  id: string;
  scheduleId: string;
  startedAt: Date;
  durationMinutes: number | null;
  completedAt: Date | null;
  endedAt: Date | null;
  source: string;
}>) {
  const duplicateIds = new Set<string>();
  const ordered = [...occurrences].sort((left, right) =>
    left.scheduleId.localeCompare(right.scheduleId) || left.startedAt.getTime() - right.startedAt.getTime(),
  );

  for (let index = 0; index < ordered.length; index += 1) {
    const first = ordered[index];
    if (duplicateIds.has(first.id)) continue;
    const sameStart = ordered.filter((candidate) =>
      candidate.scheduleId === first.scheduleId &&
      Math.abs(candidate.startedAt.getTime() - first.startedAt.getTime()) <= 2 * 60 * 1000,
    );
    if (sameStart.length < 2) continue;
    const quality = (occurrence: (typeof sameStart)[number]) =>
      (occurrence.completedAt || occurrence.endedAt ? 100000 : 0) +
      (occurrence.source === "zoom-recording" ? 10000 : 0) +
      (occurrence.durationMinutes ?? 0);
    const canonical = [...sameStart].sort((left, right) => quality(right) - quality(left))[0];
    for (const occurrence of sameStart) {
      if (occurrence.id !== canonical.id) duplicateIds.add(occurrence.id);
    }
  }
  return duplicateIds;
}
async function syncTrackedHours(teacher: { id: string; userId: string }, startsAt: Date, endsAt: Date) {
  const occurrences = await db.liveClassSessionOccurrence.findMany({
    where: {
      teacherUserId: teacher.userId,
      occurrenceDate: { gte: startsAt, lt: endsAt },
      source: { in: ["teacher-start", "teacher-member-start", "zoom-recording"] },
    },
    include: {
      schedule: {
        include: {
          program: { select: { title: true } },
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });
  const duplicateOccurrenceIds = duplicateTrackedOccurrenceIds(occurrences);

  for (const occurrence of occurrences) {
    const existing = await db.teacherHoursLogEntry.findUnique({ where: { occurrenceId: occurrence.id } });
    if (duplicateOccurrenceIds.has(occurrence.id)) {
      if (existing?.source === TeacherHoursLogSource.TRACKED && !isTeacherEditedTrackedRow(existing.notes)) {
        await db.teacherHoursLogEntry.delete({ where: { id: existing.id } });
      }
      continue;
    }
    if (!isLiveClassVisibleToStudents(occurrence.schedule.title)) {
      if (existing?.source === TeacherHoursLogSource.TRACKED && !isTeacherEditedTrackedRow(existing.notes)) {
        await db.teacherHoursLogEntry.delete({ where: { id: existing.id } });
      }
      continue;
    }


    const trackedDuration = occurrence.durationMinutes ?? 0;
    if (trackedDuration > 0 && trackedDuration < MIN_PAYABLE_TRACKED_SESSION_MINUTES) {
      if (existing?.source === TeacherHoursLogSource.TRACKED && !isTeacherEditedTrackedRow(existing.notes)) {
        await db.teacherHoursLogEntry.delete({ where: { id: existing.id } });
      }
      continue;
    }

    if (existing?.notes?.includes(HOURS_LOG_EXCLUDED_MARKER) || (existing && isTeacherEditedTrackedRow(existing.notes))) continue;

    const fallbackDuration = trackedDuration > 0 ? trackedDuration : 60;
    const startTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(occurrence.startedAt);
    const rowData = {
      teacherId: teacher.id,
      scheduleId: occurrence.scheduleId,
      occurrenceId: occurrence.id,
      source: TeacherHoursLogSource.TRACKED,
      title: cleanLiveClassTitle(occurrence.schedule.title),
      programTitle: occurrence.schedule.program.title,
      sessionDate: occurrence.startedAt,
      startTime,
      durationMinutes: fallbackDuration,
      mode: occurrenceMode(occurrence.source),
      notes: occurrence.completedAt ? "Auto-tracked from website/Zoom." : "Auto-tracked start; please confirm final duration.",
    };

    if (existing) {
      await db.teacherHoursLogEntry.update({
        where: { id: existing.id },
        data: {
          scheduleId: rowData.scheduleId,
          title: rowData.title,
          programTitle: rowData.programTitle,
          sessionDate: rowData.sessionDate,
          startTime: rowData.startTime,
          durationMinutes: rowData.durationMinutes,
          mode: rowData.mode,
          notes: existing.notes || rowData.notes,
        },
      });
    } else {
      await db.teacherHoursLogEntry.create({ data: rowData });
    }
  }
}
export async function getTeacherHoursLogData(userId: string, filter?: HoursLogFilter | string | null) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!teacher) return null;

  const period = parseHoursPeriod(filter);
  await syncTrackedHours(teacher, period.startsAt, period.endsAt);

  const [entries, submissions] = await Promise.all([
    db.teacherHoursLogEntry.findMany({
      where: {
        teacherId: teacher.id,
        sessionDate: { gte: period.startsAt, lt: period.endsAt },
        NOT: { notes: { contains: HOURS_LOG_EXCLUDED_MARKER } },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    }),
    db.teacherHoursSubmission.findMany({
      where: {
        teacherId: teacher.id,
        periodStart: { lt: period.endsAt },
        periodEnd: { gt: period.startsAt },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const submittedMinutes = entries.filter((entry) => entry.status === TeacherHoursLogStatus.SUBMITTED).reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const draftMinutes = totalMinutes - submittedMinutes;

  return {
    teacher,
    teacherName: displayName(teacher.user),
    period,
    entries,
    submissions,
    totals: {
      totalMinutes,
      submittedMinutes,
      draftMinutes,
      totalLabel: formatHoursMinutes(totalMinutes),
      submittedLabel: formatHoursMinutes(submittedMinutes),
      draftLabel: formatHoursMinutes(draftMinutes),
    },
  };
}

export async function getAdminTeacherHoursLogData(filter?: HoursLogFilter | string | null) {
  const period = parseHoursPeriod(filter);
  const teachers = await db.teacherProfile.findMany({
    where: { isActive: true },
    include: { user: true },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  for (const teacher of teachers) {
    await syncTrackedHours(teacher, period.startsAt, period.endsAt);
  }

  const [entries, submissions] = await Promise.all([
    db.teacherHoursLogEntry.findMany({
      where: { sessionDate: { gte: period.startsAt, lt: period.endsAt }, NOT: { notes: { contains: HOURS_LOG_EXCLUDED_MARKER } } },
      include: { teacher: { include: { user: true } } },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    }),
    db.teacherHoursSubmission.findMany({
      where: {
        periodStart: { lt: period.endsAt },
        periodEnd: { gt: period.startsAt },
      },
      include: { teacher: { include: { user: true } } },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const reports = teachers.map((teacher) => {
    const teacherEntries = entries.filter((entry) => entry.teacherId === teacher.id);
    const teacherSubmissions = submissions.filter((submission) => submission.teacherId === teacher.id);
    const totalMinutes = teacherEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
    const submittedMinutes = teacherEntries.filter((entry) => entry.status === TeacherHoursLogStatus.SUBMITTED).reduce((sum, entry) => sum + entry.durationMinutes, 0);
    return {
      teacherId: teacher.id,
      teacherName: displayName(teacher.user),
      teacherEmail: teacher.user.email,
      entries: teacherEntries,
      submissions: teacherSubmissions,
      totalMinutes,
      submittedMinutes,
      totalLabel: formatHoursMinutes(totalMinutes),
      submittedLabel: formatHoursMinutes(submittedMinutes),
    };
  });

  return { period, reports };
}

export async function addTeacherHoursEntry(input: {
  teacherUserId: string;
  title: string;
  programTitle?: string | null;
  sessionDate: Date;
  startTime?: string | null;
  durationMinutes: number;
  mode: string;
  notes?: string | null;
}) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId: input.teacherUserId } });
  if (!teacher) throw new Error("Teacher profile not found.");

  return db.teacherHoursLogEntry.create({
    data: {
      teacherId: teacher.id,
      source: TeacherHoursLogSource.MANUAL,
      title: input.title,
      programTitle: input.programTitle || null,
      sessionDate: input.sessionDate,
      startTime: input.startTime || null,
      durationMinutes: input.durationMinutes,
      mode: input.mode,
      notes: input.notes || null,
    },
  });
}

export async function updateTeacherHoursEntry(input: {
  teacherUserId: string;
  entryId: string;
  title: string;
  programTitle?: string | null;
  sessionDate: Date;
  startTime?: string | null;
  durationMinutes: number;
  mode: string;
  notes?: string | null;
}) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId: input.teacherUserId } });
  if (!teacher) throw new Error("Teacher profile not found.");

  const entry = await db.teacherHoursLogEntry.findFirst({ where: { id: input.entryId, teacherId: teacher.id } });
  if (!entry) throw new Error("Hours entry not found.");

  const teacherNote = input.notes || null;
  const editedTrackedNote =
    entry.source === TeacherHoursLogSource.TRACKED && !isTeacherEditedTrackedRow(entry.notes)
      ? [
          `Teacher edited from original: ${entry.title} | ${entry.sessionDate.toISOString().slice(0, 10)} | ${entry.startTime ?? "time not set"} | ${formatHoursMinutes(entry.durationMinutes)} | ${entry.mode}`,
          teacherNote,
        ].filter(Boolean).join("\n")
      : teacherNote;

  return db.teacherHoursLogEntry.update({
    where: { id: entry.id },
    data: {
      title: input.title,
      programTitle: input.programTitle || null,
      sessionDate: input.sessionDate,
      startTime: input.startTime || null,
      durationMinutes: input.durationMinutes,
      mode: input.mode,
      notes: editedTrackedNote,
    },
  });
}

export async function deleteTeacherHoursEntry(userId: string, entryId: string) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId } });
  if (!teacher) throw new Error("Teacher profile not found.");

  const entry = await db.teacherHoursLogEntry.findFirst({ where: { id: entryId, teacherId: teacher.id } });
  if (!entry) throw new Error("Hours entry not found.");
  await db.teacherHoursLogEntry.update({
    where: { id: entry.id },
    data: { notes: [entry.notes, HOURS_LOG_EXCLUDED_MARKER, "Excluded by teacher from hours log."].filter(Boolean).join("\n") },
  });
}

export async function updateAdminHoursEntry(input: {
  adminUserId: string;
  entryId: string;
  sessionDate: Date;
  startTime?: string | null;
  durationMinutes: number;
}) {
  const admin = await db.user.findFirst({ where: { id: input.adminUserId, role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Admin access required.");
  if (input.durationMinutes <= 0) throw new Error("Duration must be at least 1 minute.");
  const entry = await db.teacherHoursLogEntry.findUnique({ where: { id: input.entryId } });
  if (!entry) throw new Error("Hours entry not found.");

  return db.teacherHoursLogEntry.update({
    where: { id: entry.id },
    data: {
      sessionDate: input.sessionDate,
      startTime: input.startTime || null,
      durationMinutes: input.durationMinutes,
      notes: [
        entry.notes,
        "Admin edited from original: " + entry.sessionDate.toISOString().slice(0, 10) + " | " + (entry.startTime ?? "time not set") + " | " + formatHoursMinutes(entry.durationMinutes),
      ].filter(Boolean).join("\n"),
    },
  });
}

export async function deleteAdminHoursEntry(adminUserId: string, entryId: string) {
  const admin = await db.user.findFirst({ where: { id: adminUserId, role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Admin access required.");
  const entry = await db.teacherHoursLogEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Hours entry not found.");

  await db.teacherHoursLogEntry.update({
    where: { id: entry.id },
    data: { notes: [entry.notes, HOURS_LOG_EXCLUDED_MARKER, "Excluded by admin from hours log."].filter(Boolean).join("\n") },
  });
}
export async function submitTeacherHours(input: {
  teacherUserId: string;
  periodStart: Date;
  periodEnd: Date;
  note?: string | null;
}) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId: input.teacherUserId }, include: { user: true } });
  if (!teacher) throw new Error("Teacher profile not found.");
  if (input.periodEnd <= input.periodStart) throw new Error("Choose a valid date range.");

  const entries = await db.teacherHoursLogEntry.findMany({
    where: {
      teacherId: teacher.id,
      status: TeacherHoursLogStatus.DRAFT,
      sessionDate: { gte: input.periodStart, lt: input.periodEnd },
      NOT: { notes: { contains: HOURS_LOG_EXCLUDED_MARKER } },
    },
    orderBy: { sessionDate: "asc" },
  });
  if (!entries.length) throw new Error("No draft hours rows found for this date range.");

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const submission = await db.$transaction(async (tx) => {
    const created = await tx.teacherHoursSubmission.create({
      data: {
        teacherId: teacher.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        monthKey: monthKey(input.periodStart),
        totalMinutes,
        entryCount: entries.length,
        note: input.note || null,
      },
    });

    await tx.teacherHoursLogEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) } },
      data: { status: TeacherHoursLogStatus.SUBMITTED, submittedAt: created.submittedAt },
    });

    return created;
  });

  await sendTeacherHoursSubmittedEmail({
    teacherName: displayName(teacher.user),
    teacherEmail: teacher.user.email,
    periodLabel: `${input.periodStart.toISOString().slice(0, 10)} to ${new Date(input.periodEnd.getTime() - 86400000).toISOString().slice(0, 10)}`,
    totalLabel: formatHoursMinutes(totalMinutes),
    entryCount: entries.length,
    dashboardPath: `/admin/hours-log?start=${input.periodStart.toISOString().slice(0, 10)}&end=${new Date(input.periodEnd.getTime() - 86400000).toISOString().slice(0, 10)}`,
  });

  return submission;
}
