import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatWeekday,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherClassesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Classes"
      subtitle="See assigned programmes, student rosters, and class-specific teaching load."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Classes", value: String(dashboard.classes.length), hint: "Assigned timetable entries." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes assigned to you." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Total learners in your roster." },
          { label: "Upcoming", value: String(dashboard.metrics.upcomingLessons), hint: "Weekly upcoming sessions." },
        ]}
      />

      <TeacherSection eyebrow="Class list" title="Assigned classes and rosters">
        <div className="space-y-4">
          {dashboard.rosters.map((roster) => {
            const classInfo = dashboard.classes.find((entry) => entry.title === roster.title);
            return (
              <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                {classInfo ? (
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {formatWeekday(classInfo.weekday)} • {classInfo.startTime}-{classInfo.endTime} • {classInfo.timezone}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {roster.students.map((student) => (
                    <div key={student.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      <div className="font-semibold text-[#22304a]">{student.name}</div>
                      <div className="mt-1">{student.email}</div>
                      <div className="mt-1">{student.enrollmentStatus}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
