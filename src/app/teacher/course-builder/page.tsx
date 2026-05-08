import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getGenMProgrammeByTitle } from "@/lib/genm/curriculum";
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

  if (dashboard.rosters.length === 1) {
    const programme = getGenMProgrammeByTitle(dashboard.rosters[0].title);
    if (programme) {
      redirect(`/teacher/course-builder/${programme.slug}${params?.success ? `?success=${params.success}` : ""}`);
    }
  }

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Choose one assigned programme workspace. Each teacher now works only inside their own programme builder instead of seeing the full teaching suite at once."
      navItems={getTeacherNavItems()}
    >
      <CourseBuilderWorkspace dashboard={dashboard} teacherUserId={session.user.id} success={params?.success} />
    </TeacherDashboardFrame>
  );
}
