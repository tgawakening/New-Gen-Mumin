import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatWeekday } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherAttendancePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Attendance"
      subtitle="Prepare attendance marking, class-level headcount, and session readiness for each weekly class."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Classes", value: String(dashboard.classes.length), hint: "Attendance can be marked per class." },
          { label: "Learners", value: String(dashboard.metrics.students), hint: "Students linked to your classes." },
          { label: "Lesson logs", value: String(dashboard.lessonLogs.length), hint: "Recent recorded lessons." },
          { label: "Upcoming", value: String(dashboard.metrics.upcomingLessons), hint: "Sessions awaiting delivery." },
        ]}
      />

      <TeacherSection eyebrow="Attendance desk" title="Class attendance readiness">
        <div className="space-y-4">
          {dashboard.classes.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {formatWeekday(entry.weekday)} • {entry.startTime}-{entry.endTime} • {entry.activeEnrollments} active learners
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Mark present, late, absent, and excused attendance from this class block.
              </p>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
