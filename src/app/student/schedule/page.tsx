import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { ensureStudentLiveClassReminders, getUnreadNotifications } from "@/lib/live-classes/notifications";
import { FamilyDashboardFrame, MetricGrid, SectionCard, formatWeekday } from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function scheduleHref(tab: "classes" | "parental") {
  return `/student/schedule?tab=${tab}`;
}

export default async function StudentSchedulePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");
  await ensureStudentLiveClassReminders(session.user.id);
  const notifications = await getUnreadNotifications(session.user.id);
  const params = searchParams ? await searchParams : undefined;

  const child = dashboard.child;
  const activeTab = params?.tab === "parental" ? "parental" : "classes";
  const classSessions = child.schedule.filter((entry) => entry.category !== "PARENTAL");
  const parentalSessions = child.schedule.filter((entry) => entry.category === "PARENTAL");
  const visibleSessions = activeTab === "parental" ? parentalSessions : classSessions;

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Schedule"
      subtitle="Follow your weekly classes, teacher assignment, meeting links, and lesson timezone."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Class slots", value: String(classSessions.length), hint: "Rostered child classes." },
          { label: "Parental sessions", value: String(parentalSessions.length), hint: "Shared parent sessions by Ustadh Mehran / Ustadha Saba." },
          { label: "Meeting links", value: child.schedule.some((item) => item.meetingUrl) ? "Ready" : "Pending", hint: "Live classroom links." },
          { label: "Access", value: child.accessLocked ? "Locked" : "Open", hint: "Schedule opens fully after payment confirmation." },
        ]}
      />

      {notifications.length ? (
        <SectionCard eyebrow="Live class alerts" title="Notifications">
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? "/student/schedule"}
                className="block rounded-[20px] border border-[#eadfce] bg-white px-4 py-3"
              >
                <p className="font-semibold text-[#22304a]">{notification.title}</p>
                <p className="mt-1 text-sm text-[#5f6b7a]">{notification.body}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Weekly timetable" title={activeTab === "parental" ? "Parental Sessions" : "Class schedule"}>
        <div className="mb-5 flex flex-wrap gap-3">
          <Link href={scheduleHref("classes")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "classes" ? "bg-[#22304a] text-white" : "border border-[#d8c3ac] bg-white text-[#22304a]"}`}>
            Class Schedule
          </Link>
          <Link href={scheduleHref("parental")} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "parental" ? "bg-[#22304a] text-white" : "border border-[#d8c3ac] bg-white text-[#22304a]"}`}>
            Parental Sessions
          </Link>
        </div>

        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {visibleSessions.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.category === "PARENTAL" ? entry.scheduleTitle ?? "Parental Session" : entry.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {entry.category === "PARENTAL" ? "Parental session" : entry.provider ?? "Live class"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                {formatWeekday(entry.weekday)} - {entry.startTime} - {entry.endTime} - {entry.timezone}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Teacher: {entry.teacherName ?? "Assigned soon"}
              </p>
              {entry.meetingUrl && !child.accessLocked ? (
                <Link
                  href={entry.meetingUrl}
                  target="_blank"
                  className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
                >
                  Join meeting
                </Link>
              ) : (
                <p className="mt-4 text-sm text-[#5f6b7a]">
                  Meeting link will become available after access unlocks.
                </p>
              )}
            </div>
          ))}
          {!visibleSessions.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              {activeTab === "parental" ? "Parental sessions by Ustadh Mehran / Ustadha Saba will appear here when scheduled." : "Your weekly class schedule will appear once a teacher assigns the slot."}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}

