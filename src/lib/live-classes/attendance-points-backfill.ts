import "server-only";
import { createHash } from "crypto";
import { ATTENDANCE_POINTS, attendanceDayKey, alternativeAttendanceSubject } from "@/lib/live-classes/attendance-policy";
import { attendancePointKey, type AttendancePointSchedule } from "@/lib/live-classes/attendance-ledger";

type Row = { points: number; sourceType: string; sourceId: string | null; houseId: string };
type Record = { id: string; scheduleId: string | null; lessonDate: Date; status: string; joinedAt: Date | null; durationMinutes: number | null; source: string | null; enrollmentId: string; enrollment: { programId: string; program: { title: string } } };
type Schedule = AttendancePointSchedule & { programId: string };
type Report = { id: string; missedCount: number; fromDay: string; toDay: string };
type Credit = { studentId: string; houseId: string; points: number; sourceType: string; sourceId: string; reason: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const attended = (record: Record) => ["PRESENT", "LATE"].includes(record.status) || Boolean(record.joinedAt) || (record.durationMinutes ?? 0) > 0;

/** Pure dry-run plan. Call under the learner lock and append credits atomically. */
export function planAttendancePointsUpgrade(input: { studentId: string; houseId: string | null; schedules: Schedule[]; records: Record[]; rows: Row[]; reports: Report[] }) {
  const { studentId, schedules, records, rows, reports } = input;
  const byId = new Map(schedules.map(schedule => [schedule.id, schedule]));
  const groups = new Map<string, { rows: Row[]; present: boolean; verified: boolean; confirmedAbsent: boolean; label: string }>();
  const skipped: Array<{ id: string; reason: string }> = [];
  const group = (key: string, label: string) => {
    let entry = groups.get(key);
    if (!entry) { entry = { rows: [], present: false, verified: false, confirmedAbsent: false, label }; groups.set(key, entry); }
    return entry;
  };
  const legacyByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.sourceType.startsWith("ATTENDANCE_") || row.sourceType === "ATTENDANCE_ADMIN_ESTIMATE") continue;
    const modern = row.sourceId?.match(/^([a-f0-9]{64}):/);
    const legacy = row.sourceId?.match(/^([^:]+):(\d{4}-\d{2}-\d{2})$/);
    if (!modern && !legacy) { skipped.push({ id: row.sourceId ?? "unknown", reason: "Unrecognized attendance award identifier" }); continue; }
    const key = modern ? modern[1] : attendancePointKey(studentId, byId.get(legacy![1]) ?? { id: legacy![1], title: "", program: { title: "" } }, new Date(legacy![2] + "T12:00:00+05:00"));
    group(key, legacy ? legacy[2] : "previous confirmed class").rows.push(row);
    if (legacy && row.points > 0) {
      const keys = legacyByDay.get(legacy[2]) ?? new Set<string>(); keys.add(key); legacyByDay.set(legacy[2], keys);
    }
  }
  for (const record of records) {
    const day = attendanceDayKey(record.lessonDate);
    const schedule = record.scheduleId ? byId.get(record.scheduleId) : null;
    let key: string;
    if (schedule) key = attendancePointKey(studentId, schedule, record.lessonDate);
    else if (alternativeAttendanceSubject(record.enrollment.program.title)) {
      key = attendancePointKey(studentId, { id: "unlinked", title: "", program: record.enrollment.program }, record.lessonDate);
    } else {
      if (!attended(record)) continue;
      // Deleted schedules lose their foreign key. Never guess which of several
      // same-day classes a historical orphan belongs to or award it twice.
      const legacyKeys = legacyByDay.get(day);
      const linked = records.filter(other => other.scheduleId && attended(other) && other.enrollment.programId === record.enrollment.programId && attendanceDayKey(other.lessonDate) === day);
      const unlinked = records.filter(other => !other.scheduleId && attended(other) && attendanceDayKey(other.lessonDate) === day);
      if (legacyKeys?.size === 1 && !linked.length && unlinked.length === 1) key = [...legacyKeys][0];
      else if (legacyKeys?.size || linked.length) { skipped.push({ id: record.id, reason: "Unlinked class may duplicate another award on this date" }); continue; }
      else key = hash(studentId + ":orphan:" + record.enrollment.programId + ":" + day);
    }
    const entry = group(key, day);
    entry.label = (schedule?.title ?? record.enrollment.program.title).replace(/\[(?:Audience|Students):[^\]]*\]/gi, "").trim() + " (" + day + ")";
    if (attended(record)) {
      entry.present = true;
      if (!record.source?.startsWith("admin-recovery") && record.source !== "parent-confirmed") entry.verified = true;
    } else if (record.status === "ABSENT" && (record.source?.startsWith("admin-recovery") || record.source === "parent-confirmed")) entry.confirmedAbsent = true;
  }
  const credits: Credit[] = [];
  let alreadyAtTarget = 0, aboveTarget = 0;
  for (const [key, entry] of groups) {
    const balance = entry.rows.reduce((sum, row) => sum + row.points, 0);
    const verified = entry.rows.filter(row => !row.sourceType.startsWith("ATTENDANCE_PARENT")).reduce((sum, row) => sum + row.points, 0);
    if (!entry.present && (balance <= 0 || (entry.confirmedAbsent && verified <= 0))) continue;
    if (balance >= ATTENDANCE_POINTS) { if (balance > ATTENDANCE_POINTS) aboveTarget++; else alreadyAtTarget++; continue; }
    const houseId = entry.rows.find(row => row.points > 0)?.houseId ?? input.houseId;
    if (!houseId) { skipped.push({ id: key, reason: "Learner has no Qabila assignment" }); continue; }
    credits.push({ studentId, houseId, points: ATTENDANCE_POINTS - balance,
      sourceType: entry.verified || verified > 0 ? "ATTENDANCE_POLICY_UPGRADE" : "ATTENDANCE_PARENT_POLICY_UPGRADE",
      sourceId: key + ":policy-25:" + hash(JSON.stringify(entry.rows.map(row => [row.sourceType, row.sourceId, row.points]).sort())),
      reason: "Attendance updated to 25 points: " + entry.label + " (previously " + balance + ")." });
  }
  for (const report of reports) {
    const adjustments = rows.filter(row => row.sourceType === "ATTENDANCE_ADMIN_ESTIMATE" && row.sourceId?.startsWith(report.id + ":"));
    const balance = adjustments.reduce((sum, row) => sum + row.points, 0);
    const delta = -report.missedCount * ATTENDANCE_POINTS - balance;
    if (!delta) continue;
    const houseId = adjustments[0]?.houseId ?? input.houseId;
    if (!houseId) { skipped.push({ id: report.id, reason: "Missed-class adjustment has no Qabila assignment" }); continue; }
    credits.push({ studentId, houseId, points: delta, sourceType: "ATTENDANCE_ADMIN_ESTIMATE",
      sourceId: report.id + ":policy-25:" + hash(JSON.stringify([report.missedCount, adjustments.map(row => [row.sourceId, row.points]).sort()])),
      reason: "Attendance updated to 25 points: " + report.missedCount + " reported missed classes, dates unknown (" + report.fromDay + " to " + report.toDay + ")." });
  }
  return { credits, skipped, alreadyAtTarget, aboveTarget };
}
