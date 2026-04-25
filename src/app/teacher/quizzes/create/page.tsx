import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherSection, TeacherInfoList } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherQuizCreatePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Create Quiz"
      subtitle="Prepare pre-lesson and post-lesson assessments with objective and written question types."
      navItems={getTeacherNavItems()}
    >
      <TeacherSection eyebrow="Quiz builder" title="Assessment structure">
        <TeacherInfoList
          items={[
            "Quiz types: pre-lesson and post-lesson",
            "Question types: MCQ, multiple select, true/false, short answer, fill-in-blank",
            "Set points per question and overall timer",
            "Objective questions support auto-grading and written answers support manual feedback",
          ]}
          emptyLabel="Quiz builder guidance will appear here."
        />
      </TeacherSection>

      <TeacherSection eyebrow="Assigned programs" title="Where this quiz can be published">
        <TeacherInfoList
          items={dashboard.rosters.map((roster) => roster.title)}
          emptyLabel="Assigned programmes will appear here."
        />
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
