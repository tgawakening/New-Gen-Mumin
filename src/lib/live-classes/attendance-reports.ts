import "server-only";

import { attendanceDayKey, attendanceRequirementKey, connectedMinutes, deduplicateAttendance } from "@/lib/live-classes/attendance-policy";

import { db } from "@/lib/db";
import { cleanLiveClassTitle, resolveScheduleStudentIds } from "@/lib/live-classes/service";

export type AttendanceHistoryEntry = {
  id: string;
  lessonDate: Date;
  status: string;
  joinedAt: Date | null;
  leftAt: Date | null;
  durationMinutes: number | null;
  source: string | null;
  classTitle: string;
  programTitle: string;
  teacherName: string;
};

function personName(user: { firstName: string; lastName: string | null }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim();
}

function mapAttendance(record: { id: string; lessonDate: Date; status: string; joinedAt: Date | null; leftAt: Date | null; durationMinutes: number | null; source: string | null; enrollment: { program: { title: string } }; schedule: { title: string; teacher: { user: { firstName: string; lastName: string | null } } | null } | null }): AttendanceHistoryEntry {
  return {
    id: record.id,
    lessonDate: record.lessonDate,
    status: record.status,
    joinedAt: record.joinedAt,
    leftAt: record.leftAt,
    durationMinutes: record.durationMinutes,
    source: record.source,
    classTitle: cleanLiveClassTitle(record.schedule?.title ?? record.enrollment.program.title),
    programTitle: record.enrollment.program.title,
    teacherName: record.schedule?.teacher ? personName(record.schedule.teacher.user) : "Teacher",
  };
}

const historyInclude = {
  enrollment: { include: { program: true } },
  schedule: { include: { teacher: { include: { user: true } } } },
} as const;

export async function listStudentAttendanceByUser(userId: string) {
  const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  return student ? listStudentAttendance(student.id) : [];
}

export async function listParentChildAttendance(parentUserId: string, studentId: string) {
  const relation = await db.parentStudent.findFirst({ where: { studentId, parent: { userId: parentUserId } }, select: { id: true } });
  return relation ? listStudentAttendance(studentId) : [];
}

async function listStudentAttendance(studentId: string) {
  const records = await db.attendanceRecord.findMany({
    where: { studentId },
    include: historyInclude,
    orderBy: { lessonDate: "desc" },
  });
  // Rebuild historical Zoom duration from connection intervals as well as new records.
  const intervals = await db.zoomAttendanceInterval.findMany({
    where: { studentId, leftAt: { not: null } },
    select: { scheduleId: true, joinedAt: true, leftAt: true },
  });
  const bySession = new Map<string, typeof intervals>();
  for (const interval of intervals) {
    const key = interval.scheduleId + ":" + attendanceDayKey(interval.joinedAt);
    const group = bySession.get(key) ?? [];
    group.push(interval);
    bySession.set(key, group);
  }
  const byRequirement = new Map<string, typeof intervals>();
  const corrected = records.map((record) => {
    const group = bySession.get(record.scheduleId + ":" + attendanceDayKey(record.lessonDate));
    if (record.source === "zoom" && group?.length) {
      const key = attendanceRequirementKey(record);
      byRequirement.set(key, [...(byRequirement.get(key) ?? []), ...group]);
    }
    return record.source === "zoom" && group?.length
      ? { ...record, durationMinutes: connectedMinutes(group) } : record;
  });
  return deduplicateAttendance(corrected).map((record) => {
    const group = byRequirement.get(attendanceRequirementKey(record));
    return mapAttendance(group?.length ? {
      ...record,
      durationMinutes: connectedMinutes(group),
      joinedAt: new Date(Math.min(...group.map((item) => item.joinedAt.getTime()))),
      leftAt: new Date(Math.max(...group.map((item) => item.leftAt!.getTime()))),
    } : record);
  });
}

export async function getTeacherAttendanceReport(userId: string, range: "week" | "month") {
  const teacher = await db.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!teacher) return { schedules: [], records: [], summary: { present: 0, late: 0, absent: 0, excused: 0, averageMinutes: 0 } };
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  if (range === "month") from.setUTCDate(1);
  else from.setUTCDate(from.getUTCDate() - 6);

  const schedules = await db.classSchedule.findMany({
    where: { teacherId: teacher.id },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    select: { id: true, title: true, program: { select: { title: true } } },
  });
  const records = await db.attendanceRecord.findMany({
    where: { scheduleId: { in: schedules.map((item) => item.id) }, lessonDate: { gte: from } },
    include: {
      student: { include: { user: true } },
      enrollment: { include: { program: true } },
      schedule: true,
    },
    orderBy: [{ lessonDate: "desc" }, { student: { displayName: "asc" } }],
  });
  const rosterEntries = await Promise.all(schedules.map(async (schedule) => [schedule.id, new Set(await resolveScheduleStudentIds(schedule.id))] as const));
  const rosterBySchedule = new Map(rosterEntries);
  const rosterScopedRecords = records.filter((record) => {
    if (!record.scheduleId) return true;
    if (record.source !== "zoom" || record.status !== "ABSENT") return true;
    return rosterBySchedule.get(record.scheduleId)?.has(record.studentId) ?? false;
  });
  const uniqueRecords = deduplicateAttendance(rosterScopedRecords);
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  let durationTotal = 0;
  let durationCount = 0;
  const mapped = uniqueRecords.map((record) => {
    counts[record.status.toLowerCase() as keyof typeof counts] += 1;
    if (record.durationMinutes != null) { durationTotal += record.durationMinutes; durationCount += 1; }
    return {
      id: record.id,
      scheduleId: record.scheduleId,
      studentName: record.student.displayName || personName(record.student.user),
      studentId: record.studentId,
      lessonDate: record.lessonDate,
      status: record.status,
      joinedAt: record.joinedAt,
      leftAt: record.leftAt,
      durationMinutes: record.durationMinutes,
      classTitle: cleanLiveClassTitle(record.schedule?.title ?? record.enrollment.program.title),
      programTitle: record.enrollment.program.title,
      automated: record.source === "zoom",
    };
  });
  return {
    schedules: schedules.map((schedule) => ({ id: schedule.id, title: cleanLiveClassTitle(schedule.title), programTitle: schedule.program.title })),
    records: mapped,
    summary: { ...counts, averageMinutes: durationCount ? Math.round(durationTotal / durationCount) : 0 },
  };
}
