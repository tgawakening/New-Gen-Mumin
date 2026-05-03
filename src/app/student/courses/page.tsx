import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentCoursesPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (session.user.role !== "STUDENT") {
    redirect(getDashboardHome(session.user.role));
  }

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) {
    redirect("/auth/login");
  }

  const child = dashboard.child;

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Courses"
      subtitle="Explore your Gen-Mumins learning path, weekly rhythm, teacher team, and term highlights in a compact course space."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Enrolled courses", value: String(child.courses.length), hint: "Current programme load." },
          { label: "Assignments", value: String(child.assignments.length), hint: "Homework and coursework items." },
          { label: "Unlocked", value: child.accessLocked ? "No" : "Yes", hint: "Learning access after payment confirmation." },
          { label: "Weekly classes", value: String(child.schedule.length), hint: "Live recurring timetable slots." },
        ]}
      />

      <SectionCard eyebrow="Course list" title="Your enrolled programmes">
        <div className={`grid gap-4 lg:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.courses.map((course) => (
            <div key={course.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {course.status}
                </span>
              </div>
              {course.strapline ? (
                <p className="mt-2 text-sm font-medium text-[#c27a2c]">{course.strapline}</p>
              ) : null}
              <p className="mt-3 text-sm font-medium text-[#22304a]">
                Instructors: {course.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon"}
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[#5f6b7a] sm:grid-cols-2">
                <p>Started: {formatDate(course.startedAt)}</p>
                <p>Weekly slots: {course.meetingCount}</p>
              </div>
              {course.currentTaskTitles.length || course.recentLessonTopics.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.currentTaskTitles.slice(0, 2).map((task) => (
                    <span
                      key={task}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                    >
                      Task: {task}
                    </span>
                  ))}
                  {course.recentLessonTopics.slice(0, 2).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-[#22304a] px-3 py-1 text-xs font-semibold text-white"
                    >
                      Lesson: {topic}
                    </span>
                  ))}
                </div>
              ) : null}
              {(course.recentLessonCards.length || course.currentTaskCards.length) ? (
                <div className="mt-4 space-y-3">
                  {course.recentLessonCards.length ? (
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Latest lesson updates
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[#5f6b7a]">
                        {course.recentLessonCards.map((lesson) => (
                          <div key={lesson.id} className="rounded-[14px] border border-[#eef2f5] px-3 py-2">
                            <p className="font-semibold text-[#22304a]">{lesson.topic}</p>
                            <p className="mt-1 text-xs text-[#6d7785]">
                              By {lesson.teacherName ?? "Assigned teacher"}
                              {lesson.weekLabel ? ` • ${lesson.weekLabel}` : ""}
                              {lesson.contentType ? ` • ${lesson.contentType}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {course.currentTaskCards.length ? (
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Current tasks
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[#5f6b7a]">
                        {course.currentTaskCards.map((task) => (
                          <div key={task.id} className="rounded-[14px] border border-[#eef2f5] px-3 py-2">
                            <p className="font-semibold text-[#22304a]">{task.title}</p>
                            <p className="mt-1 text-xs text-[#6d7785]">
                              By {task.teacherName ?? "Assigned teacher"}
                              {task.weekLabel ? ` • ${task.weekLabel}` : ""}
                              {task.taskCategory ? ` • ${task.taskCategory}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {!child.courses.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Enrolled courses will appear here once registration is complete.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Assignments" title="Coursework and submissions">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.assignments.map((assignment) => (
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
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#4d5a6b]">
                {assignment.weekLabel ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                    {assignment.weekLabel}
                  </p>
                ) : null}
                <p>Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}</p>
                {assignment.instructions ? <p>{assignment.instructions}</p> : null}
                {assignment.resourceLinks.length ? (
                  <div className="flex flex-wrap gap-2">
                    {assignment.resourceLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                      >
                        Open resource
                      </a>
                    ))}
                  </div>
                ) : null}
                {assignment.feedback ? <p>{assignment.feedback}</p> : null}
              </div>
            </details>
          ))}
          {!child.assignments.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Assignments will appear once teachers publish coursework.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Gen-Mumins plan" title="Curriculum map and weekly rhythm">
        <div className={`space-y-5 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.courses.map((course) => (
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
                    Quick programme view
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
