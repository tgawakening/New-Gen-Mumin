import Link from "next/link";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherAttendanceReport } from "@/lib/live-classes/attendance-reports";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = { searchParams?: Promise<{ range?: string; schedule?: string }> };

function dateTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Not recorded";
}

function statusClass(status: string) {
  if (status === "PRESENT") return "bg-[#e9f8ef] text-[#237044]";
  if (status === "LATE") return "bg-[#fff2d8] text-[#8b5d12]";
  if (status === "EXCUSED") return "bg-[#edf3ff] text-[#315c9c]";
  return "bg-[#fdeaea] text-[#a23c3c]";
}

export default async function TeacherAttendancePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const params = searchParams ? await searchParams : {};
  const range = params.range === "month" ? "month" : "week";
  const report = await getTeacherAttendanceReport(session.user.id, range);
  const records = params.schedule ? report.records.filter((record) => record.scheduleId === params.schedule) : report.records;

  return <TeacherDashboardFrame title="Attendance" subtitle="Automatic Zoom attendance with verified join, leave, and class-time evidence." navItems={getTeacherNavItems()}>
    <TeacherMetricGrid metrics={[
      { label: "Present", value: String(report.summary.present), hint: range === "month" ? "This month." : "Last 7 days." },
      { label: "Late", value: String(report.summary.late), hint: "Joined over 10 minutes after start." },
      { label: "Absent", value: String(report.summary.absent), hint: "No verified Zoom attendance." },
      { label: "Average time", value: `${report.summary.averageMinutes} min`, hint: "Average tracked class time." },
    ]} />
    <TeacherSection eyebrow="Attendance report" title="Roster attendance by session">
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/teacher/attendance?range=week" className={`rounded-full px-4 py-2 text-sm font-semibold ${range === "week" ? "bg-[#22304a] text-white" : "border bg-white text-[#22304a]"}`}>Last 7 days</Link>
        <Link href="/teacher/attendance?range=month" className={`rounded-full px-4 py-2 text-sm font-semibold ${range === "month" ? "bg-[#22304a] text-white" : "border bg-white text-[#22304a]"}`}>This month</Link>
        {report.schedules.map((item) => <Link key={item.id} href={`/teacher/attendance?range=${range}&schedule=${item.id}`} className="rounded-full border bg-white px-4 py-2 text-sm text-[#22304a]">{item.title}</Link>)}
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[#617184]"><th className="p-3">Learner</th><th className="p-3">Class</th><th className="p-3">Session</th><th className="p-3">Status</th><th className="p-3">Joined / left</th><th className="p-3">Time</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-[#edf0f4]"><td className="p-3 font-semibold text-[#22304a]">{record.studentName}</td><td className="p-3">{record.classTitle}</td><td className="p-3">{dateTime(record.lessonDate)}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status}</span></td><td className="p-3 text-xs">{dateTime(record.joinedAt)}<br />{dateTime(record.leftAt)}</td><td className="p-3 font-semibold">{record.durationMinutes ?? 0} min</td></tr>)}</tbody></table></div>
      {!records.length ? <p className="rounded-2xl bg-[#fbf6ef] p-5 text-sm text-[#617184]">No attendance records are available for this period yet.</p> : null}
    </TeacherSection>
  </TeacherDashboardFrame>;
}
