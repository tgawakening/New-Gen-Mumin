import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, MetricGrid, SectionCard, formatGrade } from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentProgressPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Progress"
      subtitle="Follow teacher reports, attendance percentages, strengths, and next learning steps."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Reports", value: String(child.progress.length), hint: "Progress summaries from teachers." },
          { label: "Attendance", value: `${child.attendanceRate}%`, hint: "Attendance blended into teacher review." },
          { label: "Current grade", value: child.progress[0]?.grade ? formatGrade(child.progress[0].grade) : "Pending", hint: "Latest published report level." },
          { label: "Unlocked", value: child.accessLocked ? "No" : "Yes", hint: "Reports open after payment confirmation." },
        ]}
      />

      <SectionCard eyebrow="Teacher reports" title="Learning progress">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.progress.map((report) => (
            <div key={report.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{report.programTitle}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {report.reportPeriod}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Grade: {formatGrade(report.grade)} • Attendance: {report.attendancePct ?? "Pending"}%
              </p>
              {report.strengths ? (
                <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">
                  <strong>Strengths:</strong> {report.strengths}
                </p>
              ) : null}
              {report.nextSteps ? (
                <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">
                  <strong>Next steps:</strong> {report.nextSteps}
                </p>
              ) : null}
            </div>
          ))}
          {!child.progress.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Progress reports will appear once a teacher publishes the first review cycle.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
