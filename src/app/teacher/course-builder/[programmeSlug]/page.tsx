import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getGenMProgrammeByTitle, type GenMProgramSlug } from "@/lib/genm/curriculum";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

import { CourseBuilderWorkspace } from "../CourseBuilderWorkspace";

type PageProps = {
  params: Promise<{ programmeSlug: string }>;
  searchParams?: Promise<{ success?: string; tab?: "overview" | "plan" | "lesson" | "task" | "materials" }>;
};

export default async function TeacherProgrammeBuilderPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const assignedProgramme = dashboard.rosters.find(
    (roster) => getGenMProgrammeByTitle(roster.title)?.slug === resolvedParams.programmeSlug,
  );

  if (!assignedProgramme) {
    const fallbackProgramme = dashboard.rosters[0] ? getGenMProgrammeByTitle(dashboard.rosters[0].title) : null;
    if (fallbackProgramme) {
      redirect(`/teacher/course-builder/${fallbackProgramme.slug}`);
    }
    redirect("/teacher/course-builder");
  }

  const programme = getGenMProgrammeByTitle(assignedProgramme.title);
  if (!programme) {
    redirect("/teacher/course-builder");
  }

  return (
    <TeacherDashboardFrame
      title={`${programme.title} Builder`}
      subtitle={`Plan, publish, and refine ${programme.title.toLowerCase()} content inside a dedicated workspace that updates the family LMS for this programme only.`}
      navItems={getTeacherNavItems()}
    >
      <CourseBuilderWorkspace
        dashboard={dashboard}
        teacherUserId={session.user.id}
        success={resolvedSearch?.success}
        selectedProgrammeSlug={programme.slug as GenMProgramSlug}
        activeTab={resolvedSearch?.tab ?? "overview"}
      />
    </TeacherDashboardFrame>
  );
}
