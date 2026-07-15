import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { ensureParentLiveClassReminders, getUnreadNotifications } from "@/lib/live-classes/notifications";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; tab?: string }>;
};

function scheduleHref(childId: string | undefined, tab: "classes" | "parental") {
  const params = new URLSearchParams();
  if (childId) params.set("child", childId);
  params.set("tab", tab);
  return `/parent/schedule?${params.toString()}`;
}

export default async function ParentSchedulePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  await ensureParentLiveClassReminders(session.user.id);
  const notifications = await getUnreadNotifications(session.user.id);
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const activeTab = params?.tab === "parental" ? "parental" : "classes";
  const classSessions = selectedChild?.schedule.filter((entry) => entry.category !== "PARENTAL") ?? [];
  const parentalSessions = selectedChild?.schedule.filter((entry) => entry.category === "PARENTAL") ?? [];
  const visibleSessions = activeTab === "parental" ? parentalSessions : classSessions;

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Schedule"
      subtitle="Follow each child's weekly timetable, timezone, teacher assignment, and meeting details."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/schedule"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Class slots", value: String(classSessions.length), hint: "Rostered child classes." },
              { label: "Parental sessions", value: String(parentalSessions.length), hint: "Shared parent sessions by Ustadh Mehran / Ustadha Saba." },
              { label: "Teacher linked", value: selectedChild.schedule.some((entry) => entry.teacherName) ? "Yes" : "Pending", hint: "Teacher assignment visibility." },
              { label: "Meeting links", value: selectedChild.schedule.some((entry) => entry.meetingUrl) ? "Ready" : "Pending", hint: "Live classroom access." },
            ]}
          />

          {notifications.length ? (
            <SectionCard eyebrow="Live class alerts" title="Notifications">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href ?? "/parent/schedule"}
                    className="block rounded-[20px] border border-[#eadfce] bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-[#22304a]">{notification.title}</p>
                    <p className="mt-1 text-sm text-[#5f6b7a]">{notification.body}</p>
                  </Link>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard eyebrow="Timetable" title={activeTab === "parental" ? "Parental Sessions" : `${selectedChild.name}'s weekly classes`}>
            <div className="mb-5 flex flex-wrap gap-3">
              <Link href={scheduleHref(selectedChild.id, "classes")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "classes" ? "bg-[#22304a] text-white" : "border border-[#d8c3ac] bg-white text-[#22304a]"}`}>
                Class Schedule
              </Link>
              <Link href={scheduleHref(selectedChild.id, "parental")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "parental" ? "bg-[#22304a] text-white" : "border border-[#d8c3ac] bg-white text-[#22304a]"}`}>
                Parental Sessions
              </Link>
            </div>

            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {visibleSessions.map((entry) => (
                <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{entry.category === "PARENTAL" ? entry.scheduleTitle ?? "Parental Session" : entry.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {formatWeekday(entry.weekday)} - {entry.startTime} - {entry.endTime} - {entry.timezone}
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Teacher: {entry.teacherName ?? "Assigned soon"} - {entry.provider ?? "Live class"}
                  </p>
                  {entry.meetingUrl && !selectedChild.accessLocked ? (
                    <Link
                      href={entry.meetingUrl}
                      target="_blank"
                      className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Join meeting
                    </Link>
                  ) : null}
                </div>
              ))}
              {!visibleSessions.length ? (
                <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                  {activeTab === "parental" ? "Parental sessions by Ustadh Mehran / Ustadha Saba will appear here when scheduled." : "Weekly live classes will appear here after admin or teachers assign the schedule."}
                </p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}

