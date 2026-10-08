import { hasScheduleEnded } from "@/lib/live-classes/schedule-lifecycle";
import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { ATTENDANCE_POINTS, attendanceDayKey } from "@/lib/live-classes/attendance-policy";
import { attendancePointState, lockAttendanceStudent } from "@/lib/live-classes/attendance-ledger";

export async function recordPortalClassJoin(scheduleId: string, studentId: string, userId: string) {
  const membership = await ensureStudentHouseMembership(studentId);
  return db.$transaction(async tx => {
    await lockAttendanceStudent(tx, studentId);
    const schedule = await tx.classSchedule.findUnique({ where: { id: scheduleId }, select: { id: true, title: true, endsOn: true, meetingUrl: true, programId: true, program: { select: { title: true } }, teacher: { select: { userId: true } } } });
    if (!schedule?.meetingUrl || hasScheduleEnded(schedule)) throw new Error("Class unavailable or stopped");
    const occurrence = await tx.liveClassSessionOccurrence.findFirst({ where: { scheduleId, teacherUserId: schedule.teacher.userId, source: "zoom-webhook", startedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } }, orderBy: { startedAt: "desc" } });
    if (!occurrence || occurrence.endedAt) throw new Error("Class is not live");
    const enrollment = await tx.enrollment.findFirst({ where: { studentId, programId: schedule.programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } }, select: { id: true } });
    if (!enrollment) throw new Error("Enrollment unavailable");
    const attendanceDay = attendanceDayKey(occurrence.startedAt);
    const existing = await tx.attendanceRecord.findFirst({ where: { studentId, scheduleId, attendanceDay } });
    if (!existing || !["PRESENT", "LATE"].includes(existing.status)) {
      const data = { enrollmentId: enrollment.id, studentId, scheduleId, attendanceDay, lessonDate: occurrence.startedAt, status: "PRESENT" as const, source: "portal-join", note: "Joined through the family portal. Zoom connection time is recorded separately.", markedByUserId: userId };
      if (existing) await tx.attendanceRecord.update({ where: { id: existing.id }, data });
      else await tx.attendanceRecord.create({ data });
    } else if (existing.status === "LATE") {
      await tx.attendanceRecord.update({ where: { id: existing.id }, data: { status: "PRESENT" } });
    }
    const points = await attendancePointState(tx, studentId, schedule, occurrence.startedAt);
    const delta = Math.max(0, ATTENDANCE_POINTS - points.parentBalance - points.verifiedBalance);
    if (delta) await tx.housePointLedger.create({ data: { studentId, houseId: membership.houseId, points: delta, reason: "Joined class: " + schedule.title + " (" + attendanceDay + ")", sourceType: "ATTENDANCE_PORTAL", sourceId: points.key + ":portal:" + randomUUID() } });
    await tx.zoomJoinIntent.create({ data: { scheduleId, studentId, userId } });
    return schedule.meetingUrl;
  }, { maxWait: 10000, timeout: 30000 });
}
