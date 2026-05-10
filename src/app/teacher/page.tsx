import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherHomeDashboard } from "@/components/dashboard/teacher/TeacherHomeDashboard";

export default async function TeacherDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title={dashboard.teacherName}
      subtitle="Run live classes, follow student rosters, review assessments, and prepare course delivery from one teaching workspace."
      navItems={getTeacherNavItems()}
    >
      <TeacherHomeDashboard dashboard={dashboard} />
    </TeacherDashboardFrame>
  );
}
