import "server-only";

import { db } from "@/lib/db";
import { cleanLiveClassTitle } from "@/lib/live-classes/service";

type ReportSchedule = {
  id: string;
  teacherId: string;
  teacher: {
    userId: string;
    user: {
      firstName: string;
      lastName: string | null;
      email: string;
    };
  };
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  startsOn: Date | null;
  endsOn: Date | null;
  program: {
    title: string;
  };
  lessonLogs: Array<{
    id: string;
    lessonDate: Date;
    topic: string;
    summary: string;
    teacherUserId: string;
    teacher: {
      firstName: string;
      lastName: string | null;
      email: string;
    };
  }>;
  attendances: Array<{
    id: string;
    lessonDate: Date;
    status: string;
  }>;
  sessionOccurrences: Array<{
    id: string;
    teacherUserId: string | null;
    occurrenceDate: Date;
    startedAt: Date;
    source: string;
  }>;
};

function displayName(user: { firstName: string; lastName: string | null; email: string }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.email;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseReportMonth(value?: string | null) {
  const normalized = value && /^\d{4}-\d{2}$/.test(value) ? value : monthKey(new Date());
  const [year, month] = normalized.split("-").map(Number);
  const startsAt = new Date(Date.UTC(year, month - 1, 1));
  const endsAt = new Date(Date.UTC(year, month, 1));

  return {
    key: normalized,
    startsAt,
    endsAt,
    label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(startsAt),
  };
}

function scheduledDatesForMonth(schedule: ReportSchedule, startsAt: Date, endsAt: Date) {
  const dates: Date[] = [];
  const cursor = new Date(startsAt);
  const lastDay = new Date(endsAt);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);

  while (cursor < endsAt) {
    const withinScheduleStart = !schedule.startsOn || cursor >= startOfUtcDay(schedule.startsOn);
    const withinScheduleEnd = !schedule.endsOn || cursor <= startOfUtcDay(schedule.endsOn);

    if (cursor.getUTCDay() === schedule.weekday && withinScheduleStart && withinScheduleEnd) {
      dates.push(new Date(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function statusCounts(records: ReportSchedule["attendances"], key: string) {
  return records
    .filter((record) => dateKey(record.lessonDate) === key)
    .reduce(
      (counts, record) => {
        if (record.status === "PRESENT") counts.present += 1;
        if (record.status === "ABSENT") counts.absent += 1;
        if (record.status === "LATE") counts.late += 1;
        if (record.status === "EXCUSED") counts.excused += 1;
        return counts;
      },
      { present: 0, absent: 0, late: 0, excused: 0 },
    );
}

function classDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return Math.max(0, endTotal - startTotal);
}

export async function getAdminTeacherMonthlyReports(options: {
  month?: string;
  teacherId?: string;
} = {}) {
  const reportMonth = parseReportMonth(options.month);
  const now = new Date();
  const today = startOfUtcDay(now);

  const [teachers, schedules] = await Promise.all([
    db.teacherProfile.findMany({
      where: { isActive: true },
      include: { user: true },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    db.classSchedule.findMany({
      where: {
        OR: [
          { startsOn: null },
          { startsOn: { lt: reportMonth.endsAt } },
        ],
        AND: [
          {
            OR: [
              { endsOn: null },
              { endsOn: { gte: reportMonth.startsAt } },
            ],
          },
        ],
      },
      include: {
        program: { select: { title: true } },
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        lessonLogs: {
          where: {
            lessonDate: {
              gte: reportMonth.startsAt,
              lt: reportMonth.endsAt,
            },
          },
          include: {
            teacher: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { lessonDate: "asc" },
        },
        attendances: {
          where: {
            lessonDate: {
              gte: reportMonth.startsAt,
              lt: reportMonth.endsAt,
            },
          },
          select: {
            id: true,
            lessonDate: true,
            status: true,
          },
        },
        sessionOccurrences: {
          where: {
            occurrenceDate: {
              gte: reportMonth.startsAt,
              lt: reportMonth.endsAt,
            },
            source: "teacher-start",
          },
          orderBy: { startedAt: "asc" },
        },
      },
    }),
  ]);

  const reports = teachers.map((teacher) => {
    const assignedSchedules = schedules.filter((schedule) => schedule.teacherId === teacher.id);
    const coveredSchedules = schedules.filter((schedule) =>
      schedule.lessonLogs.some((log) => log.teacherUserId === teacher.userId && schedule.teacher.userId !== teacher.userId) ||
      schedule.sessionOccurrences.some((occurrence) => occurrence.teacherUserId === teacher.userId && schedule.teacher.userId !== teacher.userId),
    );
    const relevantSchedules = Array.from(
      new Map([...assignedSchedules, ...coveredSchedules].map((schedule) => [schedule.id, schedule])).values(),
    );

    const details = relevantSchedules.flatMap((schedule) => {
      const assignedToTeacher = schedule.teacherId === teacher.id;
      const scheduledDates = assignedToTeacher
        ? scheduledDatesForMonth(schedule, reportMonth.startsAt, reportMonth.endsAt)
        : [];
      const coverageDates = schedule.lessonLogs
        .filter((log) => log.teacherUserId === teacher.userId && !scheduledDates.some((date) => dateKey(date) === dateKey(log.lessonDate)))
        .map((log) => startOfUtcDay(log.lessonDate));
      const occurrenceDates = schedule.sessionOccurrences
        .filter((occurrence) => occurrence.teacherUserId === teacher.userId && !scheduledDates.some((date) => dateKey(date) === dateKey(occurrence.occurrenceDate)))
        .map((occurrence) => startOfUtcDay(occurrence.occurrenceDate));

      return Array.from(
        new Map([...scheduledDates, ...coverageDates, ...occurrenceDates].map((date) => [dateKey(date), date])).values(),
      ).map((lessonDate) => {
        const key = dateKey(lessonDate);
        const logs = schedule.lessonLogs.filter((log) => dateKey(log.lessonDate) === key);
        const occurrences = schedule.sessionOccurrences.filter((occurrence) => dateKey(occurrence.occurrenceDate) === key);
        const ownLog = logs.find((log) => log.teacherUserId === teacher.userId) ?? null;
        const ownOccurrence = occurrences.find((occurrence) => occurrence.teacherUserId === teacher.userId) ?? null;
        const substituteLog = logs.find((log) => log.teacherUserId !== schedule.teacher.userId) ?? null;
        const substituteOccurrence = occurrences.find((occurrence) => occurrence.teacherUserId && occurrence.teacherUserId !== schedule.teacher.userId) ?? null;
        const assignedTeacherLog = logs.find((log) => log.teacherUserId === schedule.teacher.userId) ?? null;
        const assignedTeacherOccurrence = occurrences.find((occurrence) => occurrence.teacherUserId === schedule.teacher.userId) ?? null;
        const due = lessonDate <= today;
        const attendance = statusCounts(schedule.attendances, key);

        let status: "present" | "absent" | "covered-by-other" | "covered-for-other" | "upcoming";
        if (!assignedToTeacher) {
          status = "covered-for-other";
        } else if (ownLog || ownOccurrence) {
          status = "present";
        } else if (substituteLog || substituteOccurrence) {
          status = "covered-by-other";
        } else if (due) {
          status = "absent";
        } else {
          status = "upcoming";
        }

        return {
          id: `${schedule.id}-${key}-${assignedToTeacher ? "assigned" : "coverage"}`,
          scheduleId: schedule.id,
          lessonDate,
          dateKey: key,
          classTitle: cleanLiveClassTitle(schedule.title),
          programTitle: schedule.program.title,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          durationMinutes: classDurationMinutes(schedule.startTime, schedule.endTime),
          timezone: schedule.timezone,
          assignedTeacherName: displayName(schedule.teacher.user),
          actualTeacherName: ownLog
            ? displayName(ownLog.teacher)
            : ownOccurrence
              ? displayName(teacher.user)
            : substituteLog
              ? displayName(substituteLog.teacher)
              : substituteOccurrence
                ? "Substitute teacher via Zoom"
              : assignedTeacherLog
                ? displayName(assignedTeacherLog.teacher)
                : assignedTeacherOccurrence
                  ? displayName(schedule.teacher.user)
                : null,
          topic: ownLog?.topic ?? substituteLog?.topic ?? assignedTeacherLog?.topic ?? (ownOccurrence ? "Started via Zoom link" : null),
          summary:
            ownLog?.summary ??
            substituteLog?.summary ??
            assignedTeacherLog?.summary ??
            (ownOccurrence ? `Started at ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(ownOccurrence.startedAt)} UTC` : null),
          status,
          studentAttendance: attendance,
        };
      });
    }).sort((left, right) => left.lessonDate.getTime() - right.lessonDate.getTime());

    const scheduled = details.filter((detail) => detail.assignedTeacherName === displayName(teacher.user)).length;
    const present = details.filter((detail) => detail.status === "present").length;
    const absent = details.filter((detail) => detail.status === "absent").length;
    const coveredByOther = details.filter((detail) => detail.status === "covered-by-other").length;
    const coveredForOthers = details.filter((detail) => detail.status === "covered-for-other").length;
    const upcoming = details.filter((detail) => detail.status === "upcoming").length;
    const payableClasses = present + coveredForOthers;
    const scheduledMinutes = details
      .filter((detail) => detail.assignedTeacherName === displayName(teacher.user))
      .reduce((sum, detail) => sum + detail.durationMinutes, 0);
    const payableMinutes = details
      .filter((detail) => detail.status === "present" || detail.status === "covered-for-other")
      .reduce((sum, detail) => sum + detail.durationMinutes, 0);
    const dueClasses = scheduled - upcoming;
    const completionRate = dueClasses > 0 ? Math.round((present / dueClasses) * 100) : 0;

    return {
      teacherId: teacher.id,
      teacherUserId: teacher.userId,
      teacherName: displayName(teacher.user),
      teacherEmail: teacher.user.email,
      metrics: {
        scheduled,
        dueClasses,
        present,
        absent,
        coveredByOther,
        coveredForOthers,
        upcoming,
        payableClasses,
        scheduledMinutes,
        payableMinutes,
        completionRate,
      },
      details,
    };
  });

  const visibleReports = options.teacherId
    ? reports.filter((report) => report.teacherId === options.teacherId)
    : reports;

  return {
    month: reportMonth,
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      name: displayName(teacher.user),
    })),
    reports: visibleReports,
    totals: visibleReports.reduce(
      (totals, report) => {
        totals.scheduled += report.metrics.scheduled;
        totals.present += report.metrics.present;
        totals.absent += report.metrics.absent;
        totals.coveredByOther += report.metrics.coveredByOther;
        totals.coveredForOthers += report.metrics.coveredForOthers;
        totals.payableClasses += report.metrics.payableClasses;
        totals.scheduledMinutes += report.metrics.scheduledMinutes;
        totals.payableMinutes += report.metrics.payableMinutes;
        return totals;
      },
      {
        scheduled: 0,
        present: 0,
        absent: 0,
        coveredByOther: 0,
        coveredForOthers: 0,
        payableClasses: 0,
        scheduledMinutes: 0,
        payableMinutes: 0,
      },
    ),
  };
}
