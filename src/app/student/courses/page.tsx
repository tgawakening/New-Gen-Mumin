import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { listMaterials } from "@/lib/google-drive/materials";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ course?: string }>;
};

export default async function StudentCoursesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const params = searchParams ? await searchParams : {};
  const selectedCourse = child.courses.find((course) => course.id === params.course) ?? child.courses[0] ?? null;
  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  if (selectedCourse) {
    try {
      materials = await listMaterials({ programId: selectedCourse.id, status: "approved", visibility: "students_parents", limit: 20 });
    } catch {
      materials = [];
    }
  }
  const groupedMaterials = materials.reduce<Record<string, typeof materials>>((groups, material) => {
    const folderName = material.folderName ?? "General";
    groups[folderName] = groups[folderName] ?? [];
    groups[folderName].push(material);
    return groups;
  }, {});

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

      <SectionCard eyebrow="Programme tabs" title="Your enrolled programmes">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {child.courses.map((course) => (
            <Link
              key={course.id}
              href={`/student/courses?course=${course.id}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedCourse?.id === course.id
                  ? "bg-[#22304a] text-white"
                  : "border border-[#eadfce] bg-white text-[#22304a]"
              }`}
            >
              {course.title}
            </Link>
          ))}
        </div>

        {selectedCourse ? (
          <div className={`mt-5 rounded-[24px] bg-[#fbf6ef] p-5 ${child.accessLocked ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-[#22304a]">{selectedCourse.title}</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                {selectedCourse.status}
              </span>
            </div>
            {selectedCourse.strapline ? (
              <p className="mt-2 text-sm font-medium text-[#c27a2c]">{selectedCourse.strapline}</p>
            ) : null}
            <p className="mt-3 text-sm font-medium text-[#22304a]">
              Instructors: {selectedCourse.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon"}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-[#5f6b7a] sm:grid-cols-2">
              <p>Started: {formatDate(selectedCourse.startedAt)}</p>
              <p>Weekly slots: {selectedCourse.meetingCount}</p>
            </div>

            {selectedCourse.upcomingSessions.length ? (
              <div className="mt-4 rounded-[18px] bg-[#22304a] p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Upcoming sessions</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {selectedCourse.upcomingSessions.map((session) => (
                    <div key={session.id} className="rounded-[16px] bg-white/10 p-3">
                      <p className="font-semibold">{session.provider ?? "Live class"}</p>
                      <p className="mt-1 text-sm text-white/75">
                        {session.startTime}-{session.endTime} {session.timezone}
                      </p>
                      <LiveClassCountdown
                        startsAt={session.nextStartsAt.toISOString()}
                        meetingUrl={session.meetingUrl}
                        accessLocked={child.accessLocked}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
            Enrolled courses will appear here once registration is complete.
          </p>
        )}
      </SectionCard>

      {selectedCourse ? (
        <SectionCard eyebrow="Course library" title={`${selectedCourse.title} materials`}>
          <div className="space-y-4">
            {Object.entries(groupedMaterials).map(([folderName, folderMaterials]) => (
              <div key={folderName} className="rounded-[20px] bg-[#fbf6ef] p-4">
                <p className="text-sm font-semibold text-[#22304a]">{folderName}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {folderMaterials.map((material) => (
                    <a
                      key={material.id}
                      href={material.webViewLink ?? "#"}
                      target="_blank"
                      className="rounded-[16px] border border-[#eadfce] bg-white px-4 py-3 text-sm"
                    >
                      <p className="font-semibold text-[#22304a]">{material.name}</p>
                      <p className="mt-1 text-xs text-[#617184]">{material.programTitle ?? selectedCourse.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {!materials.length ? (
              <p className="rounded-[20px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                Approved course materials will appear here after your teacher uploads them.
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {selectedCourse ? (
        <SectionCard eyebrow="Gen-Mumins plan" title={`${selectedCourse.title} curriculum`}>
          <div className={`rounded-[24px] bg-[#fbf6ef] p-5 ${child.accessLocked ? "opacity-60" : ""}`}>
            <details className="rounded-[20px] bg-white p-4" open>
              <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                Quick programme view
              </summary>
              <div className="mt-3 grid gap-4 text-sm leading-7 text-[#5f6b7a] xl:grid-cols-2">
                <ul className="space-y-2">
                  {selectedCourse.outcomes.slice(0, 4).map((outcome) => (
                    <li key={outcome}>- {outcome}</li>
                  ))}
                </ul>
                <ul className="space-y-2">
                  {selectedCourse.weeklySchedule.slice(0, 5).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </details>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {selectedCourse.termPlans.map((term) => (
                <details key={term.id} className="rounded-[20px] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                    {term.title} - {term.level} - {term.window}
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                    {term.highlights.slice(0, 4).map((highlight) => (
                      <li key={highlight}>- {highlight}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Assignments" title="Coursework and submissions">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.assignments.map((assignment) => (
            <details key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                    <p className="mt-2 text-sm text-[#5f6b7a]">
                      {assignment.programTitle} - {assignment.status.replace(/_/g, " ")} - Due {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {assignment.score === null ? "Pending" : `${assignment.score} pts`}
                  </span>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#4d5a6b]">
                {assignment.instructions ? <p>{assignment.instructions}</p> : null}
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
    </FamilyDashboardFrame>
  );
}
