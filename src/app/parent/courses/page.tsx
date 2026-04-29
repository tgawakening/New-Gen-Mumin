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

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Courses"
      subtitle="Review each child's enrolled programmes, the whole Gen-Mumins term plan, teacher team, and the exact content being published week by week."
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

      {selectedChild ? (
        <>
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
                  <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                  {course.strapline ? (
                    <p className="mt-2 text-sm font-medium text-[#c27a2c]">{course.strapline}</p>
                  ) : null}
                  {course.description ? (
                    <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{course.description}</p>
                  ) : null}
                  <p className="mt-3 text-sm text-[#5f6b7a]">Status: {course.status}</p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">Started: {formatDate(course.startedAt)}</p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">Weekly schedule slots: {course.meetingCount}</p>
                  {course.recentLessonTopics.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {course.recentLessonTopics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                        >
                          {topic}
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
                <div key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Status: {assignment.status.replace(/_/g, " ")} • Due: {formatDate(assignment.dueDate)}
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Score: {assignment.score === null ? "Pending review" : `${assignment.score} points`}
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}
                  </p>
                  {assignment.familyNote ? (
                    <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{assignment.familyNote}</p>
                  ) : null}
                </div>
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
                      {course.teachers.length} teachers
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                        Key outcomes
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {course.wholePlanOutcomes.map((outcome) => (
                          <li key={outcome}>• {outcome}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                        Weekly schedule
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {course.weeklySchedule.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                      Term plan snapshot
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {course.termPlans.map((term) => (
                        <div key={term.id} className="rounded-[18px] border border-[#eadfce] bg-[#fffaf5] p-4">
                          <p className="text-sm font-semibold text-[#22304a]">
                            {term.title} • {term.level}
                          </p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c27a2c]">
                            {term.window}
                          </p>
                          <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                            {term.highlights.slice(0, 3).map((highlight) => (
                              <li key={highlight}>• {highlight}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Policies" title="Parent learning agreement">
            <div className={`grid gap-4 lg:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.courses[0]?.policies.map((policy) => (
                <div key={policy} className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#5f6b7a]">
                  {policy}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Teachers" title="Programme teachers and specialists">
            <div className={`grid gap-4 lg:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.courses.flatMap((course) =>
                course.teachers.map((teacher) => (
                  <div
                    key={`${course.id}-${teacher.name}`}
                    className="rounded-[24px] bg-[#fbf6ef] p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                      {course.title}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[#22304a]">{teacher.name}</h3>
                    <p className="mt-1 text-sm font-medium text-[#c27a2c]">{teacher.title}</p>
                    <p className="mt-2 text-sm text-[#5f6b7a]">{teacher.credential}</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{teacher.bio}</p>
                  </div>
                )),
              )}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
