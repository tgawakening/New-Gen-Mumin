import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

import { CourseBuilderWorkspace } from "./CourseBuilderWorkspace";

type PageProps = {
  searchParams?: Promise<{ success?: string }>;
};

export default async function TeacherCourseBuilderPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : undefined;

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Open a dedicated workspace for each assigned programme, publish structured weekly content, and keep student and parent LMS updates flowing from one teaching suite."
      navItems={getTeacherNavItems()}
    >
      <CourseBuilderWorkspace dashboard={dashboard} teacherUserId={session.user.id} success={params?.success} />
    </TeacherDashboardFrame>
  );
}
