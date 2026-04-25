import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherSection, TeacherInfoList } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherCourseBuilderPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Organise lesson modules, upload teaching resources, and prepare weekly content delivery by programme."
      navItems={getTeacherNavItems()}
    >
      <TeacherSection eyebrow="Builder" title="Programme lesson workspace">
        <TeacherInfoList
          items={dashboard.rosters.map(
            (roster) =>
              `${roster.title} • Create modules, attach PDFs/videos, add homework notes, and publish lesson guidance`,
          )}
          emptyLabel="Assigned programmes will appear here for lesson building."
        />
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
