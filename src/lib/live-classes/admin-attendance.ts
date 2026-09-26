import "server-only";
import { randomUUID, createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadRecoveryGroups } from "@/lib/live-classes/parent-attendance";
import { attendanceDayKey } from "@/lib/live-classes/attendance-policy";
import { attendancePointState, lockAttendanceStudent, parentAttendancePointDelta } from "@/lib/live-classes/attendance-ledger";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00+05:00`);
  return Number.isFinite(date.getTime()) && attendanceDayKey(date) === value;
}, "Choose a valid calendar date.");
export const recoveryInput = z.object({
  studentId: z.string().min(1), from: day, to: day,
  parentName: z.string().trim().min(1).max(191), note: z.string().trim().min(1).max(4000),
  mode: z.enum(["all", "dates", "count"]), missedKeys: z.array(z.string()).max(500),
  missedCount: z.number().int().min(0).max(500), teacherId: z.string().optional(), fingerprint: z.string(),
});
export type RecoveryInput = z.infer<typeof recoveryInput>;
async function requireAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new Error("Administrator access required.");
}
function range(from: string, to: string) {
  day.parse(from); day.parse(to);
  if (from > to || to > attendanceDayKey(new Date())) throw new Error("Choose a past or current date range in the correct order.");
  const start = new Date(`${from}T00:00:00+05:00`);
  const end = new Date(Math.min(Date.now(), new Date(`${to}T23:59:59.999+05:00`).getTime()));
  if (end.getTime() - start.getTime() > 366 * 86400000) throw new Error("Choose up to one year at a time.");
  return { start, end };
}
function fingerprint(groups: Awaited<ReturnType<typeof loadRecoveryGroups>>) {
  return createHash("sha256").update(groups.map(group => group.key).sort().join(":" )).digest("hex");
}
export async function previewAdminAttendance(userId: string, studentId: string, from: string, to: string) {
  await requireAdmin(userId);
  const { start, end } = range(from, to);
  const groups = await loadRecoveryGroups(userId, studentId, end, { admin: true, from: start });
  if (groups.length > 500) throw new Error("This range contains too many classes. Choose a shorter range.");
  return { fingerprint: fingerprint(groups), sessions: groups.map(group => ({
    key: group.key, day: group.day, title: group.title, teachers: group.teacherNames,
    teacherIds: [...new Set(group.slots.map(slot => slot.teacherId))], verified: group.locked, status: group.status,
  })) };
}
export async function saveAdminAttendance(userId: string, raw: RecoveryInput) {
  await requireAdmin(userId);
  const input = recoveryInput.parse(raw);
  const { start, end } = range(input.from, input.to);
  const groups = await loadRecoveryGroups(userId, input.studentId, end, { admin: true, from: start });
  if (!groups.length || groups.length > 500) throw new Error("No eligible completed classes, or the date range is too large.");
  if (input.fingerprint !== fingerprint(groups)) throw new Error("The available classes changed. Preview the dates again before saving.");
  const missed = new Set(input.mode === "dates" ? input.missedKeys : []);
  if ([...missed].some(key => !groups.some(group => group.key === key))) throw new Error("A missed class is outside the previewed range.");
  const estimatedMissed = input.mode === "count" ? input.missedCount : 0;
  if (input.mode === "count" && estimatedMissed < 1) throw new Error("Enter the number of missed classes, or select attended all.");
  const membership = await ensureStudentHouseMembership(input.studentId);
  return db.$transaction(async tx => {
    await lockAttendanceStudent(tx, input.studentId);
    const reports = await tx.adminAttendanceRecovery.findMany({ where: { studentId: input.studentId, fromDay: { lte: input.to }, toDay: { gte: input.from } } });
    const existing = reports.find(report => report.fromDay === input.from && report.toDay === input.to);
    if (reports.some(report => report.id !== existing?.id)) throw new Error("This range overlaps an existing recovery report. Edit using its exact date range, or choose a separate period.");
    if (existing && Array.isArray(existing.sessions) && existing.sessions.some(session => session && typeof session === "object" && "key" in session && !groups.some(group => group.key === session.key))) {
      throw new Error("Previously reported classes are no longer available in this preview. Check hidden schedules or enrollment changes before revising the report.");
    }
    const reportId = existing?.id ?? randomUUID();
    const revisionId = randomUUID();
    const scheduleIds = [...new Set(groups.flatMap(group => group.slots.map(slot => slot.scheduleId)))];
    const records = await tx.attendanceRecord.findMany({ where: { studentId: input.studentId, scheduleId: { in: scheduleIds }, lessonDate: { gte: start, lte: end } } });
    const intervals = await tx.zoomAttendanceInterval.findMany({ where: { studentId: input.studentId, scheduleId: { in: scheduleIds }, joinedAt: { gte: start, lte: end } }, select: { scheduleId: true, joinedAt: true } });
    const snapshot = {
      schedules: await tx.classSchedule.findMany({ select: { id: true, title: true, program: { select: { title: true } } } }),
      rows: await tx.housePointLedger.findMany({ where: { studentId: input.studentId, sourceType: { startsWith: "ATTENDANCE_" } }, select: { points: true, sourceType: true, sourceId: true } }),
    };
    const plans = groups.map(group => {
      const ids = new Set(group.slots.map(slot => slot.scheduleId));
      const matched = records.filter(record => record.scheduleId && ids.has(record.scheduleId) && attendanceDayKey(record.lessonDate) === group.day);
      const verified = intervals.some(interval => ids.has(interval.scheduleId) && attendanceDayKey(interval.joinedAt) === group.day)
        || matched.some(record => !record.source?.startsWith("admin-recovery") && record.source !== "parent-confirmed" && (record.status === "PRESENT" || record.status === "LATE" || record.joinedAt || (record.durationMinutes ?? 0) > 0));
      if (verified && missed.has(group.key)) throw new Error(`Verified attendance cannot be marked absent: ${group.title}, ${group.day}.`);
      return { group, matched, verified, status: missed.has(group.key) ? "ABSENT" as const : "PRESENT" as const };
    });
    const estimatePool = plans.filter(plan => !plan.verified && (!input.teacherId || plan.group.slots.some(slot => slot.teacherId === input.teacherId)));
    if (estimatedMissed > estimatePool.length) throw new Error("Missed count exceeds the unverified classes for this learner/teacher. Verified attendance is protected.");
    const credits: Prisma.HousePointLedgerCreateManyInput[] = [];
    const newRecords: Prisma.AttendanceRecordCreateManyInput[] = [];
    const updates = new Map<string, { ids: string[]; data: Prisma.AttendanceRecordUpdateManyMutationInput }>();
    let pointsDelta = 0;
    for (const plan of plans) {
      const { group, matched, status, verified } = plan;
      const slot = group.slots[0];
      const state = await attendancePointState(tx, input.studentId, slot.schedule, slot.date, snapshot);
      const delta = parentAttendancePointDelta(status, state);
      pointsDelta += delta;
      if (delta) credits.push({ studentId: input.studentId, houseId: membership.houseId, points: delta, sourceType: delta > 0 ? "ATTENDANCE_PARENT_ADMIN" : "ATTENDANCE_PARENT_ADMIN_REVERSAL", sourceId: `${state.key}:${revisionId}`, reason: `Admin recorded parent attendance: ${group.title} (${group.day})` });
      // Preserve actual attendance evidence, but repair stale unconfirmed rows
      // when another slot or a Zoom interval proves this requirement was attended.
      const writable = verified ? matched.filter(record =>
        record.status !== "PRESENT" && record.status !== "LATE" && !record.joinedAt && !(record.durationMinutes ?? 0)
      ) : matched;
      const isEstimate = estimatedMissed > 0 && estimatePool.includes(plan);
      const data = { status, source: isEstimate ? "admin-recovery-estimate" : "admin-recovery", note: `Parent report: ${input.parentName}. ${input.note} Report ${reportId}.`, markedByUserId: userId, joinedAt: null, leftAt: null, durationMinutes: null };
      if (writable.length) {
        const bucketKey = `${status}:${data.source}`;
        const bucket = updates.get(bucketKey) ?? { ids: [] as string[], data };
        bucket.ids.push(...writable.map(record => record.id));
        updates.set(bucketKey, bucket);
      }
      else if (!matched.length) newRecords.push({ ...data, id: randomUUID(), studentId: input.studentId, enrollmentId: slot.enrollmentId, scheduleId: slot.scheduleId, lessonDate: slot.date, attendanceDay: group.day });
    }
    const oldEstimateBalance = snapshot.rows.filter(row => row.sourceType === "ATTENDANCE_ADMIN_ESTIMATE" && row.sourceId?.startsWith(`${reportId}:`)).reduce((sum, row) => sum + row.points, 0);
    const adjustment = -estimatedMissed * 5 - oldEstimateBalance;
    pointsDelta += adjustment;
    if (adjustment) credits.push({ studentId: input.studentId, houseId: membership.houseId, points: adjustment, sourceType: "ATTENDANCE_ADMIN_ESTIMATE", sourceId: `${reportId}:${revisionId}`, reason: `Parent-reported missed-class adjustment: ${estimatedMissed} missed, dates unknown (${input.from} to ${input.to}).` });
    for (const bucket of updates.values()) await tx.attendanceRecord.updateMany({ where: { id: { in: bucket.ids } }, data: bucket.data });
    if (newRecords.length) await tx.attendanceRecord.createMany({ data: newRecords });
    if (credits.length) await tx.housePointLedger.createMany({ data: credits });
    const sessions = plans.map(plan => ({ key: plan.group.key, day: plan.group.day, title: plan.group.title, status: plan.status, verified: plan.verified }));
    const revision = { id: revisionId, adminUserId: userId, savedAt: new Date().toISOString(), parentName: input.parentName, note: input.note, mode: input.mode, missedCount: estimatedMissed, teacherId: input.teacherId ?? null, missedKeys: [...missed], pointsDelta, sessionCount: groups.length };
    const history = Array.isArray(existing?.revisions) ? existing.revisions : [];
    const data = { parentName: input.parentName, note: input.note, missedCount: estimatedMissed, teacherId: input.teacherId || null, sessions, revisions: [...history, revision] };
    await tx.adminAttendanceRecovery.upsert({ where: { studentId_fromDay_toDay: { studentId: input.studentId, fromDay: input.from, toDay: input.to } }, create: { id: reportId, studentId: input.studentId, fromDay: input.from, toDay: input.to, ...data }, update: data });
    return { sessions: groups.length, attended: groups.length - missed.size - estimatedMissed, missed: missed.size + estimatedMissed, pointsDelta };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
}
