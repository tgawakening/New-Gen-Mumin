import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentSchedulePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Schedule"
      subtitle="Follow each child’s weekly timetable, timezone, teacher assignment, and meeting details."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/schedule"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Weekly slots", value: String(selectedChild.schedule.length), hint: "Recurring live classes." },
              { label: "Timezone", value: selectedChild.profile.timezone ?? "Europe/London", hint: "Class timezone." },
              { label: "Teacher linked", value: selectedChild.schedule.some((entry) => entry.teacherName) ? "Yes" : "Pending", hint: "Teacher assignment visibility." },
              { label: "Meeting links", value: selectedChild.schedule.some((entry) => entry.meetingUrl) ? "Ready" : "Pending", hint: "Live classroom access." },
            ]}
          />

          <SectionCard eyebrow="Timetable" title={`${selectedChild.name}'s weekly classes`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.schedule.map((entry) => (
                <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {formatWeekday(entry.weekday)} • {entry.startTime} - {entry.endTime} • {entry.timezone}
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Teacher: {entry.teacherName ?? "Assigned soon"} • {entry.provider ?? "Live class"}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
