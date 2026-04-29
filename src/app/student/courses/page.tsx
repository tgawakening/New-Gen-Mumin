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
      subtitle="Explore your Gen-Mumins learning path, weekly rhythm, teacher team, and the term-by-term plan from one connected course space."
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
              {course.currentTaskTitles.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.currentTaskTitles.map((task) => (
                    <span
                      key={task}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                    >
                      {task}
                    </span>
                  ))}
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
            <div key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {assignment.status.replace(/_/g, " ")}
                </span>
              </div>
              {assignment.weekLabel ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                  {assignment.weekLabel}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-[#5f6b7a]">Due: {formatDate(assignment.dueDate)}</p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Score: {assignment.score === null ? "Pending review" : `${assignment.score} points`}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}
              </p>
              {assignment.instructions ? (
                <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">{assignment.instructions}</p>
              ) : null}
              {assignment.resourceLinks.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
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
              {assignment.feedback ? (
                <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">{assignment.feedback}</p>
              ) : null}
            </div>
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

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Programme outcomes
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                    {course.outcomes.map((outcome) => (
                      <li key={outcome}>• {outcome}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Weekly lesson flow
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                    {course.weeklyFlow.map((step) => (
                      <li key={step}>• {step}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Weekly class map
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                    {course.weeklySchedule.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Key materials
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                    {course.keyMaterials.map((material) => (
                      <li key={material}>• {material}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                  Two-year term plan
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
                        {term.highlights.map((highlight) => (
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

      <SectionCard eyebrow="Teachers" title="Who is guiding each programme">
        <div className={`grid gap-4 lg:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.courses.map((course) => (
            <div key={`${course.id}-teachers`} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
              <div className="mt-4 space-y-4">
                {course.teachers.map((teacher) => (
                  <div key={`${course.id}-${teacher.name}`} className="rounded-[20px] bg-white p-4">
                    <p className="text-base font-semibold text-[#22304a]">{teacher.name}</p>
                    <p className="mt-1 text-sm font-medium text-[#c27a2c]">{teacher.title}</p>
                    <p className="mt-2 text-sm text-[#5f6b7a]">{teacher.credential}</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{teacher.bio}</p>
                  </div>
                ))}
                {!course.teachers.length ? (
                  <p className="rounded-[20px] bg-white p-4 text-sm text-[#5f6b7a]">
                    Teacher assignments for this programme will appear here.
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
