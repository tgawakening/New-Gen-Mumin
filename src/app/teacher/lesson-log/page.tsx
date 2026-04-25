import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatDate } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherLessonLogPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Lesson Log"
      subtitle="Track recent lesson summaries, topics taught, and follow-up notes for each class."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Lesson logs", value: String(dashboard.lessonLogs.length), hint: "Recent logged lessons." },
          { label: "Classes", value: String(dashboard.classes.length), hint: "Active class streams." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes being taught." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners covered by lesson logs." },
        ]}
      />

      <TeacherSection eyebrow="Recent logs" title="Lesson summaries">
        <div className="space-y-4">
          {dashboard.lessonLogs.map((log) => (
            <div key={log.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{log.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {formatDate(log.lessonDate)}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#22304a]">{log.topic}</p>
              <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">{log.summary}</p>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
