import "server-only";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { attendanceDayKey, alternativeAttendanceSubject } from "@/lib/live-classes/attendance-policy";

export type AttendancePointSchedule = { id: string; title: string; program: { title: string } };

export function attendancePointKey(studentId: string, schedule: AttendancePointSchedule, date: Date) {
  const subject = alternativeAttendanceSubject(schedule.title) ?? alternativeAttendanceSubject(schedule.program.title);
  return createHash("sha256").update(`${studentId}:${subject ?? schedule.id}:${attendanceDayKey(date)}`).digest("hex");
}

/** Parent confirmations and Zoom reconciliation serialize on the same learner. */
export async function lockAttendanceStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM StudentProfile WHERE id = ${studentId} FOR UPDATE`);
}

export async function attendancePointState(tx: Prisma.TransactionClient, studentId: string, schedule: AttendancePointSchedule, date: Date, snapshot?: { schedules: AttendancePointSchedule[]; rows: Array<{ points: number; sourceType: string; sourceId: string | null }> }) {
  const key = attendancePointKey(studentId, schedule, date);
  const subject = alternativeAttendanceSubject(schedule.title) ?? alternativeAttendanceSubject(schedule.program.title);
  const schedules = subject ? (snapshot?.schedules ?? await tx.classSchedule.findMany({ select: { id: true, title: true, program: { select: { title: true } } } })) : [schedule];
  const legacyIds = schedules.filter((entry) => !subject || (alternativeAttendanceSubject(entry.title) ?? alternativeAttendanceSubject(entry.program.title)) === subject)
    .map((entry) => `${entry.id}:${attendanceDayKey(date)}`);
  const rows = snapshot ? snapshot.rows.filter((row) => row.sourceId?.startsWith(`${key}:`) || legacyIds.includes(row.sourceId ?? "")) : await tx.housePointLedger.findMany({
    where: { studentId, sourceType: { startsWith: "ATTENDANCE_" }, OR: [
      { sourceId: { startsWith: `${key}:` } },
      { sourceId: { in: legacyIds } },
    ] },
    select: { points: true, sourceType: true },
  });
  const parentBalance = rows.filter((row) => row.sourceType.startsWith("ATTENDANCE_PARENT")).reduce((sum, row) => sum + row.points, 0);
  const verifiedBalance = rows.filter((row) => !row.sourceType.startsWith("ATTENDANCE_PARENT")).reduce((sum, row) => sum + row.points, 0);
  return { key, parentBalance, verifiedBalance };
}

export function parentAttendancePointDelta(status: "PRESENT" | "ABSENT", state: { parentBalance: number; verifiedBalance: number }) {
  const target = status === "PRESENT" && state.verifiedBalance <= 0 ? 5 : 0;
  return target - state.parentBalance;
}
