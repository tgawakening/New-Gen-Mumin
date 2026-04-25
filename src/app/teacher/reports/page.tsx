import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatGrade } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherReportsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Reports"
      subtitle="Review class performance, student grades, and attendance-linked progress across assigned programmes."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Reports", value: String(dashboard.reports.length), hint: "Published progress reports." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners included in reporting." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes under your reporting scope." },
          { label: "Attendance-linked", value: "Yes", hint: "Reports surface attendance percentages." },
        ]}
      />

      <TeacherSection eyebrow="Performance overview" title="Student progress reports">
        <div className="space-y-4">
          {dashboard.reports.map((report) => (
            <div key={report.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{report.studentName}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {report.reportPeriod}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {report.programTitle} • {formatGrade(report.grade)} • {report.attendancePct ?? "Pending"}% attendance
              </p>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
