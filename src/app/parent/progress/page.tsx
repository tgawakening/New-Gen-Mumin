import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatGrade,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentProgressPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Progress"
      subtitle="Track teacher reports, grades, attendance percentages, strengths, and next steps."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/progress"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Reports", value: String(selectedChild.progress.length), hint: "Teacher progress summaries." },
              { label: "Current grade", value: selectedChild.progress[0]?.grade ? formatGrade(selectedChild.progress[0].grade) : "Pending", hint: "Latest published grade." },
              { label: "Attendance", value: `${selectedChild.attendanceRate}%`, hint: "Child attendance level." },
              { label: "Next steps", value: selectedChild.progress[0]?.nextSteps ? "Shared" : "Pending", hint: "Teacher guidance for the next cycle." },
            ]}
          />

          <SectionCard eyebrow="Teacher reports" title={`${selectedChild.name}'s progress`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.progress.map((report) => (
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
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
