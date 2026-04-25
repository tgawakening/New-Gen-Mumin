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
      subtitle="Track your enrolled programmes, lesson rhythm, and assignment workload from one place."
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
              <p className="mt-2 text-sm text-[#5f6b7a]">Status: {course.status}</p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Started: {formatDate(course.startedAt)}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Weekly schedule slots: {course.meetingCount}
              </p>
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
              <p className="mt-3 text-sm text-[#5f6b7a]">Due: {formatDate(assignment.dueDate)}</p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Score: {assignment.score === null ? "Pending review" : `${assignment.score} points`}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}
              </p>
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
    </FamilyDashboardFrame>
  );
}
