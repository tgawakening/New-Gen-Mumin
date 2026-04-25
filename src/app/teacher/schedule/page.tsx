import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatWeekday } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherSchedulePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Schedule"
      subtitle="Track recurring weekly classes, live meeting links, and timetable timezone settings."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Weekly classes", value: String(dashboard.classes.length), hint: "Recurring timetable slots." },
          { label: "Meeting links", value: dashboard.classes.some((entry) => entry.meetingUrl) ? "Ready" : "Pending", hint: "Live classroom links." },
          { label: "Timezone", value: dashboard.profile.timezone ?? "Europe/London", hint: "Default teacher timezone." },
          { label: "Providers", value: String(new Set(dashboard.classes.map((entry) => entry.provider || "Live class")).size), hint: "Zoom/meeting provider variety." },
        ]}
      />

      <TeacherSection eyebrow="Weekly timetable" title="Assigned schedule">
        <div className="space-y-4">
          {dashboard.classes.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {entry.provider ?? "Live class"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {formatWeekday(entry.weekday)} • {entry.startTime}-{entry.endTime} • {entry.timezone}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Students: {entry.activeEnrollments} active
              </p>
              {entry.meetingUrl ? (
                <Link
                  href={entry.meetingUrl}
                  target="_blank"
                  className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
                >
                  Open meeting
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
