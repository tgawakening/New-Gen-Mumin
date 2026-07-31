import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { formatHoursMinutes, getAdminTeacherHoursLogData } from "@/lib/teacher/hours-log";

export const dynamic = "force-dynamic";

type AdminHoursData = Awaited<ReturnType<typeof getAdminTeacherHoursLogData>>;
type AdminHoursReport = AdminHoursData["reports"][number];
type AdminHoursEntry = AdminHoursReport["entries"][number];

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

function statusLabel(entry: AdminHoursEntry) {
  if (entry.source === "TRACKED" && entry.status === "DRAFT") return "PUBLISHED";
  return entry.status;
}

function sourceLabel(entry: AdminHoursEntry) {
  if (entry.source === "MANUAL") return "Manual / outside website";
  if (entry.notes?.includes("Teacher edited from original:")) return "Website tracked - edited by teacher";
  return "Website tracked";
}

function buildTeacherRows(report: AdminHoursReport, periodLabel: string) {
  const rows: string[] = [];
  rows.push(csvRow([report.teacherName]));
  rows.push(csvRow(["Email", report.teacherEmail, "Period", periodLabel, "Total Hours", formatHoursMinutes(report.totalMinutes)]));
  rows.push(csvRow(["Date", "Start Time", "Session", "Programme", "Mode", "Source", "Length", "Minutes", "Status", "Rate", "Amount", "Notes"]));

  for (const entry of report.entries) {
    rows.push(csvRow([
      formatDate(entry.sessionDate),
      entry.startTime ?? "Time not set",
      entry.title,
      entry.programTitle ?? "Programme not set",
      entry.mode,
      sourceLabel(entry),
      formatHoursMinutes(entry.durationMinutes),
      entry.durationMinutes,
      statusLabel(entry),
      "",
      "",
      entry.notes ?? (entry.source === "TRACKED" ? "Published auto-tracked website session." : ""),
    ]));
  }

  if (!report.entries.length) rows.push(csvRow(["No payable rows for this teacher."]));
  rows.push(csvRow(["Teacher Total", "", "", "", "", "", formatHoursMinutes(report.totalMinutes), report.totalMinutes, "", "", ""]));
  rows.push("");
  return rows;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacherId");
  const data = await getAdminTeacherHoursLogData({
    month: searchParams.get("month"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  const reports = teacherId ? data.reports.filter((report) => report.teacherId === teacherId) : data.reports;
  const totalMinutes = reports.reduce((sum, report) => sum + report.totalMinutes, 0);
  const lines = [
    csvRow(["Gen-Mumin Teacher Hours Log"]),
    csvRow(["Period", data.period.label, "Teachers", reports.length, "Total Hours", formatHoursMinutes(totalMinutes)]),
    "",
    ...reports.flatMap((report) => buildTeacherRows(report, data.period.label)),
  ];

  const filenameScope = teacherId && reports[0] ? reports[0].teacherName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") : "all-teachers";
  const filename = `gen-mumin-hours-${filenameScope}-${data.period.key}.csv`;

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}