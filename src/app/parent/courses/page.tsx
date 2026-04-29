import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentCoursesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) {
      redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    }
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Courses"
      subtitle="Review each child's active programmes, term highlights, and weekly teacher updates in a compact family-friendly view."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/courses"
        />
      </SectionCard>

      <MetricGrid
        metrics={[
          { label: "Courses", value: String(selectedChild.courses.length), hint: "Current enrolled programmes." },
          { label: "Assignments", value: String(selectedChild.assignments.length), hint: "Coursework and homework items." },
          { label: "Schedule slots", value: String(selectedChild.schedule.length), hint: "Live class slots for the child." },
          { label: "Access", value: selectedChild.accessLocked ? "Locked" : "Unlocked", hint: "Controlled by payment confirmation." },
        ]}
      />

      <SectionCard eyebrow="Programmes" title={`${selectedChild.name}'s courses`}>
        <div className={`grid gap-4 lg:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.courses.map((course) => (
            <div key={course.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {course.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-[#c27a2c]">
                Instructors: {course.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon"}
              </p>
              {course.strapline ? <p className="mt-2 text-sm text-[#5f6b7a]">{course.strapline}</p> : null}
              <div className="mt-3 grid gap-2 text-sm text-[#5f6b7a] sm:grid-cols-2">
                <p>Started: {formatDate(course.startedAt)}</p>
                <p>Weekly slots: {course.meetingCount}</p>
              </div>
              {course.recentLessonTopics.length || course.currentTaskTitles.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.recentLessonTopics.slice(0, 2).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                    >
                      Lesson: {topic}
                    </span>
                  ))}
                  {course.currentTaskTitles.slice(0, 2).map((task) => (
                    <span
                      key={task}
                      className="rounded-full bg-[#22304a] px-3 py-1 text-xs font-semibold text-white"
                    >
                      Task: {task}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Assignments" title="Coursework tracking">
        <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.assignments.map((assignment) => (
            <details key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                    <p className="mt-2 text-sm text-[#5f6b7a]">
                      {assignment.programTitle} • {assignment.status.replace(/_/g, " ")} • Due {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {assignment.score === null ? "Pending" : `${assignment.score} pts`}
                  </span>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f6b7a]">
                <p>Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}</p>
                {assignment.familyNote ? <p>{assignment.familyNote}</p> : null}
                {assignment.instructions ? <p>{assignment.instructions}</p> : null}
              </div>
            </details>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Curriculum" title="Whole programme plan">
        <div className={`space-y-5 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.courses.map((course) => (
            <div key={`${course.id}-curriculum`} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                <span className="rounded-full bg-[#22304a] px-3 py-1 text-xs font-semibold text-white">
                  {course.termPlans.length} terms
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <details className="rounded-[20px] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                    Key outcomes and weekly rhythm
                  </summary>
                  <div className="mt-3 grid gap-4 text-sm leading-7 text-[#5f6b7a] xl:grid-cols-2">
                    <ul className="space-y-2">
                      {course.outcomes.slice(0, 4).map((outcome) => (
                        <li key={outcome}>• {outcome}</li>
                      ))}
                    </ul>
                    <ul className="space-y-2">
                      {course.weeklySchedule.slice(0, 5).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </details>
                {course.termPlans.map((term) => (
                  <details key={term.id} className="rounded-[20px] bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                      {term.title} • {term.level} • {term.window}
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {term.highlights.slice(0, 4).map((highlight) => (
                        <li key={highlight}>• {highlight}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
