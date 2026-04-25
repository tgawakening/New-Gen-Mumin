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
      subtitle="Review each child’s enrolled programmes, assignment load, and overall learning access."
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
                  <p className="mt-2 text-sm text-[#5f6b7a]">Status: {course.status}</p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">Started: {formatDate(course.startedAt)}</p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">Weekly schedule slots: {course.meetingCount}</p>
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
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
