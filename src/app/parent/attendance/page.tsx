import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentAttendancePage({ searchParams }: PageProps) {
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
      title="Attendance"
      subtitle="Check each child’s attendance rate and breakdown across active classes."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/attendance"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Attendance rate", value: `${selectedChild.attendanceRate}%`, hint: "Present sessions versus total records." },
              { label: "Present", value: String(selectedChild.attendanceBreakdown[0]?.value ?? 0), hint: "On-time classes." },
              { label: "Late", value: String(selectedChild.attendanceBreakdown[1]?.value ?? 0), hint: "Late arrivals recorded." },
              { label: "Missed", value: String((selectedChild.attendanceBreakdown[2]?.value ?? 0) + (selectedChild.attendanceBreakdown[3]?.value ?? 0)), hint: "Absent or excused records." },
            ]}
          />

          <SectionCard eyebrow="Breakdown" title={`${selectedChild.name}'s attendance`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {selectedChild.attendanceBreakdown.map((entry) => (
                <div key={entry.label} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <p className="text-sm text-[#6d7785]">{entry.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#22304a]">{entry.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
