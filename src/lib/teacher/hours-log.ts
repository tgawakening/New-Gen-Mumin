import "server-only";

import { TeacherHoursLogSource, TeacherHoursLogStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { sendTeacherHoursSubmittedEmail } from "@/lib/email/notifications";
import { cleanLiveClassTitle, isLiveClassVisibleToStudents } from "@/lib/live-classes/service";

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

  for (const occurrence of occurrences) {
    if (!isLiveClassVisibleToStudents(occurrence.schedule.title)) continue;
    const durationMinutes = occurrence.durationMinutes ?? 0;
    const fallbackDuration = durationMinutes > 0 ? durationMinutes : 60;
    const startTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(occurrence.startedAt);

    await db.teacherHoursLogEntry.upsert({
      where: { occurrenceId: occurrence.id },
      create: {
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
      },
      update: {
        scheduleId: occurrence.scheduleId,
        title: cleanLiveClassTitle(occurrence.schedule.title),
        programTitle: occurrence.schedule.program.title,
        sessionDate: occurrence.startedAt,
        startTime,
        durationMinutes: fallbackDuration,
        mode: occurrenceMode(occurrence.source),
      },
    });
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
      where: { sessionDate: { gte: period.startsAt, lt: period.endsAt } },
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
  if (entry.status === TeacherHoursLogStatus.SUBMITTED) throw new Error("Submitted hours cannot be edited. Please ask admin if this needs correction.");

  return db.teacherHoursLogEntry.update({
    where: { id: entry.id },
    data: {
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

export async function deleteTeacherHoursEntry(userId: string, entryId: string) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId } });
  if (!teacher) throw new Error("Teacher profile not found.");

  const entry = await db.teacherHoursLogEntry.findFirst({ where: { id: entryId, teacherId: teacher.id } });
  if (!entry) throw new Error("Hours entry not found.");
  if (entry.source === TeacherHoursLogSource.TRACKED) throw new Error("Tracked website rows cannot be deleted; set the duration to 0 or add a note for admin.");
  if (entry.status === TeacherHoursLogStatus.SUBMITTED) throw new Error("Submitted hours cannot be deleted.");

  await db.teacherHoursLogEntry.delete({ where: { id: entry.id } });
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