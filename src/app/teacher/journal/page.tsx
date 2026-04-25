import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatDate, formatGrade } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherJournalPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Journal Review"
      subtitle="Review weekly reflections, practice minutes, self-ratings, and teacher feedback needs."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Entries", value: String(dashboard.journals.length), hint: "Recent submitted journal entries." },
          { label: "Pending feedback", value: String(dashboard.metrics.journalReviews), hint: "Entries still waiting on teacher feedback." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners in your teaching scope." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programs contributing journal work." },
        ]}
      />

      <TeacherSection eyebrow="Review queue" title="Student journal entries">
        <div className="space-y-4">
          {dashboard.journals.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.studentName}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {formatDate(entry.submittedAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {entry.title} • {entry.practiceMinutes} min • {formatGrade(entry.selfRating)}
              </p>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                {entry.teacherFeedback ? "Feedback sent" : "Feedback pending"}
              </p>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
