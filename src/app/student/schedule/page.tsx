import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, MetricGrid, SectionCard, formatWeekday } from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentSchedulePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;

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
          { label: "Weekly slots", value: String(child.schedule.length), hint: "Recurring live classes this week." },
          { label: "Timezone", value: child.profile.timezone ?? "Europe/London", hint: "Default class timezone." },
          { label: "Meeting links", value: child.schedule.some((item) => item.meetingUrl) ? "Ready" : "Pending", hint: "Live classroom links." },
          { label: "Access", value: child.accessLocked ? "Locked" : "Open", hint: "Schedule opens fully after payment confirmation." },
        ]}
      />

      <SectionCard eyebrow="Weekly timetable" title="Class schedule">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.schedule.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {entry.provider ?? "Live class"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                {formatWeekday(entry.weekday)} • {entry.startTime} - {entry.endTime} • {entry.timezone}
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
          {!child.schedule.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Your weekly class schedule will appear once a teacher assigns the slot.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
