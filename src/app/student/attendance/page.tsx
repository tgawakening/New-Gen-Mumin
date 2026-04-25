import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, MetricGrid, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentAttendancePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Attendance"
      subtitle="See your attendance rate and status breakdown across all current classes."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Attendance rate", value: `${child.attendanceRate}%`, hint: "Present sessions versus total records." },
          { label: "Present", value: String(child.attendanceBreakdown[0]?.value ?? 0), hint: "On-time attendance." },
          { label: "Late", value: String(child.attendanceBreakdown[1]?.value ?? 0), hint: "Late arrivals recorded." },
          { label: "Missed", value: String((child.attendanceBreakdown[2]?.value ?? 0) + (child.attendanceBreakdown[3]?.value ?? 0)), hint: "Absent or excused sessions." },
        ]}
      />

      <SectionCard eyebrow="Breakdown" title="Attendance status">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {child.attendanceBreakdown.map((entry) => (
            <div key={entry.label} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <p className="text-sm text-[#6d7785]">{entry.label}</p>
              <p className="mt-2 text-3xl font-semibold text-[#22304a]">{entry.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
