import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { attendanceDayKey, deduplicateAttendance } from "@/lib/live-classes/attendance-policy";
import { attendancePointKey, attendancePointState, lockAttendanceStudent, parentAttendancePointDelta, type AttendancePointSchedule } from "@/lib/live-classes/attendance-ledger";
import { cleanLiveClassTitle, isLiveClassVisibleToStudents, isParentalLiveClass, createReadOnlyRosterResolver } from "@/lib/live-classes/service";

export const ATTENDANCE_RECOVERY_START = new Date("2026-09-01T00:00:00+05:00");
export class AttendanceConfirmationError extends Error {}
type Slot = { scheduleId: string; enrollmentId: string; date: Date; schedule: AttendancePointSchedule };
type RecoveryGroup = { key: string; day: string; title: string; teacherNames: string[]; slots: Slot[]; status: string; locked: boolean };

async function loadRecoveryGroups(parentUserId: string, studentId: string, now = new Date()) {
  const relation = await db.parentStudent.findFirst({ where: { studentId, parent: { userId: parentUserId } }, select: { id: true } });
  if (!relation) throw new AttendanceConfirmationError("You can only confirm attendance for your own child.");
  const enrollments = await db.enrollment.findMany({
    where: { studentId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
    include: { program: { include: { schedules: {
      include: {
        teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        sessionOccurrences: { where: { startedAt: { gte: ATTENDANCE_RECOVERY_START, lte: now }, OR: [{ endedAt: { lte: now } }, { completedAt: { lte: now } }] }, orderBy: { startedAt: "asc" } },
        attendances: { where: { studentId, lessonDate: { gte: ATTENDANCE_RECOVERY_START, lte: now } }, orderBy: { lessonDate: "asc" } },
      },
    } } } },
  });
  const intervals = await db.zoomAttendanceInterval.findMany({ where: { studentId, joinedAt: { gte: ATTENDANCE_RECOVERY_START, lte: now } }, select: { scheduleId: true, joinedAt: true } });
  const joined = new Set(intervals.map((entry) => `${entry.scheduleId}:${attendanceDayKey(entry.joinedAt)}`));
  const groups = new Map<string, RecoveryGroup>();
  const resolveScheduleStudentIds = createReadOnlyRosterResolver();
  for (const enrollment of enrollments) {
    for (const schedule of enrollment.program.schedules) {
      if (!isLiveClassVisibleToStudents(schedule.title) || isParentalLiveClass(schedule.title)) continue;
      if (!schedule.attendances.length && !schedule.sessionOccurrences.length) continue;
      const rostered = (await resolveScheduleStudentIds(schedule.id)).includes(studentId);
      const dates = new Map<string, Date>();
      if (rostered) for (const occurrence of schedule.sessionOccurrences) dates.set(attendanceDayKey(occurrence.startedAt), occurrence.startedAt);
      // Historical records establish membership even if today's roster has changed.
      for (const record of schedule.attendances) dates.set(attendanceDayKey(record.lessonDate), record.lessonDate);
      for (const [day, date] of dates) {
        if (enrollment.startedAt && date < enrollment.startedAt) continue;
        const pointSchedule = { id: schedule.id, title: schedule.title, program: { title: enrollment.program.title } };
        const key = attendancePointKey(studentId, pointSchedule, date);
        const records = schedule.attendances.filter((record) => attendanceDayKey(record.lessonDate) === day);
        const verified = joined.has(`${schedule.id}:${day}`) || records.some((record) =>
          record.source !== "parent-confirmed" && (record.status === "PRESENT" || record.status === "LATE" || record.joinedAt || (record.durationMinutes ?? 0) > 0));
        const effective = deduplicateAttendance(records.map((record) => ({ ...record, schedule: pointSchedule, enrollment: { program: pointSchedule.program } })))[0];
        const status = verified ? "PRESENT" : effective?.status ?? "NEEDS_CONFIRMATION";
        const group = groups.get(key) ?? { key, day, title: cleanLiveClassTitle(schedule.title), teacherNames: [], slots: [], status, locked: false };
        const teacherName = [schedule.teacher?.user.firstName, schedule.teacher?.user.lastName].filter(Boolean).join(" ").trim();
        if (teacherName && !group.teacherNames.includes(teacherName)) group.teacherNames.push(teacherName);
        group.slots.push({ scheduleId: schedule.id, enrollmentId: enrollment.id, date, schedule: pointSchedule });
        group.locked ||= Boolean(verified);
        if (verified || status === "PRESENT") group.status = "PRESENT";
        else if (group.status !== "PRESENT" && status !== "NEEDS_CONFIRMATION") group.status = status;
        groups.set(key, group);
      }
    }
  }
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title));
}

export async function getParentAttendanceRecovery(parentUserId: string, studentId: string) {
  const groups = await loadRecoveryGroups(parentUserId, studentId);
  const audit = await db.attendanceConfirmationAudit.findMany({ where: { studentId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
  const actors = await db.user.findMany({ where: { id: { in: [...new Set(audit.map((entry) => entry.parentUserId))] } }, select: { id: true, firstName: true, lastName: true } });
  return {
    rows: groups.map(({ key, day, title, teacherNames, status, locked, slots }) => ({ key, day, title, teacherNames, status, locked, alternatives: slots.length })),
    audit: audit.map((entry) => ({ id: entry.id, title: groups.find((group) => group.key === entry.requirementKey)?.title ?? "Class attendance", confirmedBy: actors.filter((actor) => actor.id === entry.parentUserId).map((actor) => `${actor.firstName} ${actor.lastName ?? ""}`.trim())[0] ?? "Parent", day: entry.attendanceDay, status: entry.status, pointsDelta: entry.pointsDelta, createdAt: entry.createdAt.toISOString() })),
  };
}

export async function confirmParentAttendance(parentUserId: string, studentId: string, changes: Array<{ key: string; status: "PRESENT" | "ABSENT" }>) {
  if (!changes.length || changes.length > 100 || new Set(changes.map((entry) => entry.key)).size !== changes.length
    || changes.some((entry) => !["PRESENT", "ABSENT"].includes(entry.status))) {
    throw new AttendanceConfirmationError("Choose between 1 and 100 different class dates to save.");
  }
  const groups = await loadRecoveryGroups(parentUserId, studentId);
  const selected = changes.map((change) => {
    const group = groups.find((entry) => entry.key === change.key);
    if (!group) throw new AttendanceConfirmationError("A selected class is not eligible for confirmation. Refresh the page.");
    if (group.locked) throw new AttendanceConfirmationError("Verified attendance cannot be changed by a parent.");
    return { group, status: change.status };
  });
  const membership = await ensureStudentHouseMembership(studentId);
  // The same learner row is locked by Zoom, so a late report cannot race a correction.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        await lockAttendanceStudent(tx, studentId);
        const relation = await tx.parentStudent.findFirst({ where: { studentId, parent: { userId: parentUserId } }, select: { id: true } });
        if (!relation) throw new AttendanceConfirmationError("You can only confirm attendance for your own child.");
        let pointsDelta = 0;
        let saved = 0;
        for (const { group, status } of selected) {
          const scheduleIds = group.slots.map((slot) => slot.scheduleId);
          const start = new Date(`${group.day}T00:00:00+05:00`);
          const end = new Date(start.getTime() + 86400000);
          const records = await tx.attendanceRecord.findMany({ where: { studentId, scheduleId: { in: scheduleIds }, lessonDate: { gte: start, lt: end } } });
          const verifiedInterval = await tx.zoomAttendanceInterval.findFirst({ where: { studentId, scheduleId: { in: scheduleIds }, joinedAt: { gte: start, lt: end } }, select: { id: true } });
          if (verifiedInterval || records.some((record) => record.source !== "parent-confirmed" && (record.status === "PRESENT" || record.status === "LATE" || record.joinedAt || (record.durationMinutes ?? 0) > 0))) {
            throw new AttendanceConfirmationError("Zoom or a teacher has now verified this class. Refresh the page to see the update.");
          }
          const slot = group.slots[0];
          const state = await attendancePointState(tx, studentId, slot.schedule, slot.date);
          const delta = parentAttendancePointDelta(status, state);
          if (records.length && records.every((record) => record.source === "parent-confirmed" && record.status === status) && delta === 0) continue;
          const audit = await tx.attendanceConfirmationAudit.create({ data: {
            studentId, parentUserId, requirementKey: group.key, scheduleId: slot.scheduleId,
            attendanceDay: group.day, previousStatus: records.find((record) => record.source === "parent-confirmed")?.status ?? "NEEDS_CONFIRMATION", status, pointsDelta: delta,
          } });
          const data = { status, source: "parent-confirmed", markedByUserId: parentUserId, joinedAt: null, leftAt: null, durationMinutes: null,
            note: `Confirmed by parent on ${new Date().toISOString()}. Audit: ${audit.id}.` };
          // Update all alternate-slot records together so an old parent entry cannot win deduplication.
          if (records.length) await tx.attendanceRecord.updateMany({ where: { id: { in: records.map((record) => record.id) } }, data });
          else await tx.attendanceRecord.create({ data: { ...data, studentId, enrollmentId: slot.enrollmentId, scheduleId: slot.scheduleId, lessonDate: slot.date, attendanceDay: group.day } });
          if (delta) await tx.housePointLedger.create({ data: {
            studentId, houseId: membership.houseId, points: delta,
            sourceType: delta > 0 ? "ATTENDANCE_PARENT" : "ATTENDANCE_PARENT_REVERSAL",
            sourceId: `${state.key}:${audit.id}`,
            reason: `${delta > 0 ? "Parent-confirmed attendance" : "Parent attendance correction"}: ${group.title} (${group.day})`,
          } });
          pointsDelta += delta;
          saved++;
        }
        return { saved, pointsDelta };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new AttendanceConfirmationError("Attendance could not be saved. Please try again.");
}
