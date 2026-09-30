import "server-only";
import { db } from "@/lib/db";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { attendanceDayKey } from "@/lib/live-classes/attendance-policy";
import { attendancePointState, lockAttendanceStudent } from "@/lib/live-classes/attendance-ledger";

export async function recordPortalClassJoin(scheduleId: string, studentId: string, userId: string) {
  const membership = await ensureStudentHouseMembership(studentId);
  return db.$transaction(async tx => {
    await lockAttendanceStudent(tx, studentId);
    const schedule = await tx.classSchedule.findUnique({ where: { id: scheduleId }, select: { id: true, title: true, meetingUrl: true, programId: true, program: { select: { title: true } }, teacher: { select: { userId: true } } } });
    if (!schedule?.meetingUrl) throw new Error("Class unavailable");
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
    if (points.parentBalance + points.verifiedBalance <= 0) await tx.housePointLedger.create({ data: { studentId, houseId: membership.houseId, points: 5, reason: "Joined class: " + schedule.title + " (" + attendanceDay + ")", sourceType: "ATTENDANCE_PORTAL", sourceId: points.key + ":portal" } });
    await tx.zoomJoinIntent.create({ data: { scheduleId, studentId, userId } });
    return schedule.meetingUrl;
  }, { maxWait: 10000, timeout: 30000 });
}
