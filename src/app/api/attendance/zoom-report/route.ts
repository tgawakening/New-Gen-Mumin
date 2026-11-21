import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getZoomPresenceReport } from "@/lib/live-classes/zoom-presence-report";
import { csvCell } from "@/lib/feedback/monthly-questions";
import { connectedSeconds } from "@/lib/live-classes/zoom-presence-policy";
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const report = await getZoomPresenceReport(session.user, request.nextUrl.searchParams.get("student") ?? "", request.nextUrl.searchParams.get("month") ?? "");
    if (request.nextUrl.searchParams.get("format") === "status") {
      const now = new Date();
      const open = report.intervals.filter(row => !row.leftAt && now.getTime() - row.joinedAt.getTime() < 4 * 3600_000);
      return NextResponse.json({ openConnections: open.length, openMinutes: Math.floor(connectedSeconds(open.map(row => ({ joinedAt: row.joinedAt, leftAt: now }))) / 60) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (request.nextUrl.searchParams.get("format") === "connections") {
      const rows = [["Student", "Actor", "Class", "Joined (UTC)", "Left (UTC)", "Evidence", "Identity match", "Meeting occurrence"]];
      for (const row of report.intervals) rows.push([report.name, row.parentId ? "parent" : "student", row.schedule.title, row.joinedAt.toISOString(), row.leftAt?.toISOString() ?? "pending", row.evidenceSource, row.matchMethod ?? "unresolved", row.meetingUuid ?? "unknown"]);
      return new NextResponse("\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-connections-${report.month}.csv"`, "Cache-Control": "private, no-store" } });
    }
    const subjects = report.summary.programmeTotals.map(row => row.subject);
    const rows: Array<Array<string | number>> = [["Student", "Month", "Week beginning (PKT)", ...subjects.flatMap(subject => [subject + " joined Zoom sessions", subject + " connected minutes", subject + " completed one-hour days", subject + " required one-hour days", subject + " assessment"])]];
    for (const week of report.summary.weeks) rows.push([report.name, report.month, week.week, ...subjects.flatMap(subject => { const row = week.programmes.find(item => item.subject === subject); return row ? [row.joinedSessions, row.minutes, row.completed, row.required, row.state] : [0, 0, 0, 0, "Not enrolled"]; })]);
    return new NextResponse("\uFEFF" + rows.map(row => row.map(value => csvCell(String(value))).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-${report.month}.csv"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Attendance report unavailable or access denied." }, { status: 403 });
  }
}
