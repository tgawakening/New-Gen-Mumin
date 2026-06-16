import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getGenMProgrammeByTitle, isArabicTajweedSlug } from "@/lib/genm/curriculum";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

import { CourseBuilderWorkspace } from "./CourseBuilderWorkspace";

type PageProps = {
  searchParams?: Promise<{ success?: string; tab?: "overview" | "plan" | "lesson" | "task" | "materials"; weekLabel?: string; topic?: string; termId?: string; lessonId?: string; moduleId?: string; weekId?: string; moduleComposer?: string; weekComposer?: string; lessonComposer?: string; quizComposer?: string; taskComposer?: string; liveComposer?: string; materialComposer?: string }>;
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
      const query = new URLSearchParams();
      if (params?.success) query.set("success", params.success);
      if (params?.tab) query.set("tab", params.tab);
      if (params?.weekLabel) query.set("weekLabel", params.weekLabel);
      if (params?.topic) query.set("topic", params.topic);
      if (params?.termId) query.set("termId", params.termId);
      if (params?.lessonId) query.set("lessonId", params.lessonId);
      if (params?.moduleId) query.set("moduleId", params.moduleId);
      if (params?.weekId) query.set("weekId", params.weekId);
      if (params?.moduleComposer) query.set("moduleComposer", params.moduleComposer);
      if (params?.weekComposer) query.set("weekComposer", params.weekComposer);
      if (params?.lessonComposer) query.set("lessonComposer", params.lessonComposer);
      if (params?.quizComposer) query.set("quizComposer", params.quizComposer);
      if (params?.taskComposer) query.set("taskComposer", params.taskComposer);
      if (params?.liveComposer) query.set("liveComposer", params.liveComposer);
      if (params?.materialComposer) query.set("materialComposer", params.materialComposer);
      redirect(`/teacher/course-builder/${isArabicTajweedSlug(programme.slug) ? "arabic" : programme.slug}${query.size ? `?${query.toString()}` : ""}`);
    }
  }

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Choose one assigned programme workspace. Each teacher now works only inside their own programme builder instead of seeing the full teaching suite at once."
      navItems={getTeacherNavItems()}
    >
      <CourseBuilderWorkspace
        dashboard={dashboard}
        teacherUserId={session.user.id}
        success={params?.success}
        activeTab={params?.tab ?? "overview"}
        prefillWeekLabel={params?.weekLabel}
        prefillTopic={params?.topic}
        prefillTermId={params?.termId}
        lessonId={params?.lessonId}
        moduleId={params?.moduleId}
        weekId={params?.weekId}
        moduleComposer={params?.moduleComposer === "1"}
        weekComposer={params?.weekComposer === "1"}
        lessonComposer={params?.lessonComposer === "1"}
        quizComposer={params?.quizComposer === "1"}
        taskComposer={params?.taskComposer === "1"}
        liveComposer={params?.liveComposer === "1"}
        materialComposer={params?.materialComposer === "1"}
      />
    </TeacherDashboardFrame>
  );
}
