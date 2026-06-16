import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getGenMProgrammeByTitle, isArabicTajweedSlug, type GenMProgramSlug } from "@/lib/genm/curriculum";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

import { CourseBuilderWorkspace } from "../CourseBuilderWorkspace";

type PageProps = {
  params: Promise<{ programmeSlug: string }>;
  searchParams?: Promise<{ success?: string; tab?: "overview" | "plan" | "lesson" | "task" | "materials"; weekLabel?: string; topic?: string; termId?: string; lessonId?: string; moduleId?: string; weekId?: string; moduleComposer?: string; weekComposer?: string; lessonComposer?: string; quizComposer?: string; taskComposer?: string; liveComposer?: string; materialComposer?: string }>;
};

export default async function TeacherProgrammeBuilderPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const assignedProgramme = dashboard.rosters.find((roster) => {
    const programme = getGenMProgrammeByTitle(roster.title);
    if (!programme) return false;
    return isArabicTajweedSlug(resolvedParams.programmeSlug)
      ? isArabicTajweedSlug(programme.slug)
      : programme.slug === resolvedParams.programmeSlug;
  });

  if (!assignedProgramme) {
    const fallbackProgramme = dashboard.rosters[0] ? getGenMProgrammeByTitle(dashboard.rosters[0].title) : null;
    if (fallbackProgramme) {
      redirect(`/teacher/course-builder/${isArabicTajweedSlug(fallbackProgramme.slug) ? "arabic" : fallbackProgramme.slug}`);
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
        prefillWeekLabel={resolvedSearch?.weekLabel}
        prefillTopic={resolvedSearch?.topic}
        prefillTermId={resolvedSearch?.termId}
        lessonId={resolvedSearch?.lessonId}
        moduleId={resolvedSearch?.moduleId}
        weekId={resolvedSearch?.weekId}
        moduleComposer={resolvedSearch?.moduleComposer === "1"}
        weekComposer={resolvedSearch?.weekComposer === "1"}
        lessonComposer={resolvedSearch?.lessonComposer === "1"}
        quizComposer={resolvedSearch?.quizComposer === "1"}
        taskComposer={resolvedSearch?.taskComposer === "1"}
        liveComposer={resolvedSearch?.liveComposer === "1"}
        materialComposer={resolvedSearch?.materialComposer === "1"}
      />
    </TeacherDashboardFrame>
  );
}
