import { attendanceDayKey } from "./attendance-policy";
export type RecoveryReportSummary = { fromDay: string; toDay: string; missedCount: number; parentName: string };
type Row = { lessonDate: Date; status: string };
export function attendanceTotals(rows: Array<{ status: string }>, reports: Array<{ missedCount: number }> = []) {
  const confirmed = rows.filter(row => row.status !== "NEEDS_CONFIRMATION");
  const deduction = reports.reduce((sum, report) => sum + report.missedCount, 0);
  const present = Math.max(0, confirmed.filter(row => row.status === "PRESENT" || row.status === "LATE").length - deduction);
  const absent = confirmed.filter(row => row.status === "ABSENT").length + deduction;
  return { total: rows.length, confirmed: confirmed.length, present, absent, pending: rows.length - confirmed.length, rate: confirmed.length ? Math.round(present / confirmed.length * 100) : null };
}
export function monthlyAttendance(rows: Row[], reports: RecoveryReportSummary[] = []) {
  const months = [...new Set(rows.map(row => attendanceDayKey(row.lessonDate).slice(0,7)))].sort().reverse();
  return months.map(month => {
    const related = reports.filter(report => report.fromDay.slice(0,7) <= month && report.toDay.slice(0,7) >= month && report.missedCount > 0);
    const uncertain = related.some(report => report.fromDay.slice(0,7) !== report.toDay.slice(0,7));
    const totals = attendanceTotals(rows.filter(row => attendanceDayKey(row.lessonDate).startsWith(month)), related.filter(report => report.fromDay.slice(0,7) === report.toDay.slice(0,7)));
    return { month, ...totals, uncertain, rate: uncertain ? null : totals.rate };
  });
}
