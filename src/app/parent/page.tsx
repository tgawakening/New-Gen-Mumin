import Link from "next/link";
import { redirect } from "next/navigation";

import { AddChildEnrollmentModal } from "@/components/registration/AddChildEnrollmentModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getRegistrationOptions } from "@/lib/registration/service";
import {
  ChildSelector,
  FamilyDashboardFrame,
  InfoList,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; addChild?: string }>;
};

export default async function ParentDashboardPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const [dashboard, options] = await Promise.all([
    getParentDashboardData(session.user.id),
    getRegistrationOptions(),
  ]);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length && dashboard.accessLocked) {
    if (dashboard.pendingRegistrationId) {
      redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    }
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const showAddChildModal = params?.addChild === "1";

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title={`Assalamu alaikum, ${dashboard.parentName}`}
      subtitle="Follow active learners, track weekly progress, and stay close to classes, tasks, and journal growth from one family workspace."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Children", value: String(dashboard.children.length), hint: "Linked learner profiles in your family account." },
          { label: "Access", value: dashboard.accessStateLabel, hint: "Payment status controls learning access." },
          { label: "Journal score", value: String(selectedChild?.journalMonthlySummary.leadershipDevelopmentScore ?? 0), hint: "Leadership and growth check-in for the selected child." },
          { label: "Selected child", value: selectedChild?.name ?? "No child yet", hint: selectedChild ? `${selectedChild.courses.length} courses - ${selectedChild.attendanceRate}% attendance` : "Your learners will appear here after registration." },
        ]}
      />

      <SectionCard
        eyebrow="Child selector"
        title="Choose a learner"
        icon="star"
        action={
          <Link
            href="/parent?addChild=1"
            className="cursor-pointer rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
          >
            Add another child
          </Link>
        }
      >
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent"
        />
      </SectionCard>

      {selectedChild ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <SectionCard eyebrow="Courses" title={selectedChild.name} icon="book">
              <InfoList
                items={selectedChild.courses.map(
                  (course) =>
                    `${course.title} - By ${course.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "assigned teachers"} - ${course.meetingCount} weekly slots`,
                )}
                emptyLabel="Courses will appear here once enrollment is active."
              />
            </SectionCard>

            <SectionCard eyebrow="Learning" title="Quizzes, assignments, and journal" icon="sparkles">
              <div className={`grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <InfoList
                  items={selectedChild.quizzes.slice(0, 4).map(
                    (quiz) => `${quiz.title} - ${quiz.type} - ${quiz.latestScore ?? "Pending"} pts`,
                  )}
                  emptyLabel="Published quizzes will appear here."
                />
                <InfoList
                  items={selectedChild.assignments.slice(0, 4).map(
                    (assignment) =>
                      `${assignment.title} - ${assignment.status.replace(/_/g, " ")} - ${assignment.score ?? "Pending"} pts`,
                  )}
                  emptyLabel="Assignments will appear here."
                />
                <InfoList
                  items={selectedChild.journals.slice(0, 4).map(
                    (journal) => `${journal.template.weekLabel} - ${journal.practiceMinutes} min - ${formatGrade(journal.selfRating)}`,
                  )}
                  emptyLabel="Journal reflections will appear here."
                />
              </div>
            </SectionCard>

            <SectionCard eyebrow="Teacher updates" title="Daily work and weekly tasks" icon="pen">
              <div className={`grid gap-4 xl:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <InfoList
                  items={selectedChild.lessonUpdates.slice(0, 5).map(
                    (update) =>
                      `${update.programTitle} - ${update.topic} - ${formatWeekday(update.lessonDate.getDay())} - ${update.teacherName ?? "Teacher update"}`,
                  )}
                  emptyLabel="Teacher lesson updates will appear here once daily content starts being posted."
                />
                <InfoList
                  items={selectedChild.assignments.slice(0, 5).map((assignment) => {
                    const due = assignment.dueDate
                      ? `Due ${assignment.dueDate.toLocaleDateString("en-GB")}`
                      : "No due date yet";
                    return `${assignment.programTitle} - ${assignment.title} - ${assignment.status.replace(/_/g, " ")} - ${due}`;
                  })}
                  emptyLabel="Weekly tasks and homework will appear here once teachers publish them."
                />
              </div>
            </SectionCard>

            <SectionCard eyebrow="Weekly journal" title="Growth summary" icon="chart">
              <div className={`grid gap-4 xl:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <InfoList
                  items={[
                    `Most consistent trait - ${selectedChild.journalMonthlySummary.mostConsistentTrait}`,
                    `Strongest skill area - ${selectedChild.journalMonthlySummary.strongestSkillArea}`,
                    `Arabic fluency trend - ${selectedChild.journalMonthlySummary.arabicFluencyTrend}`,
                  ]}
                  emptyLabel="Monthly journal growth will appear here."
                />
                <InfoList
                  items={[
                    `Leadership score - ${selectedChild.journalMonthlySummary.leadershipDevelopmentScore}/5`,
                    `Teacher summary - ${selectedChild.journalMonthlySummary.teacherSummary}`,
                  ]}
                  emptyLabel="Leadership and teacher summary will appear here."
                />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard eyebrow="Next class" title="Schedule" icon="calendar">
              {selectedChild.nextClass ? (
                <div className={`rounded-[24px] bg-[#22304a] p-5 text-white ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                  <p className="text-lg font-semibold">{selectedChild.nextClass.title}</p>
                  <p className="mt-2 text-sm text-white/80">
                    {formatWeekday(selectedChild.nextClass.weekday)} - {selectedChild.nextClass.startTime} - {selectedChild.nextClass.endTime}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Teacher: {selectedChild.nextClass.teacherName ?? "Assigned soon"}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    {selectedChild.nextClass.provider ?? "Live class"} - {selectedChild.nextClass.timezone}
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-7 text-[#5f6b7a]">
                  Weekly schedule details will appear after class times are assigned.
                </p>
              )}
            </SectionCard>

            <SectionCard eyebrow="Recognition" title="Badges and certificates" icon="trophy">
              <InfoList
                items={selectedChild.badges.map(
                  (badge) =>
                    `${badge.title} - ${badge.status === "earned" ? "Earned" : "In progress"} - ${badge.description}`,
                )}
                emptyLabel="Badges, gem-of-the-week, and certificates will appear here as student activity grows."
              />
            </SectionCard>
          </div>
        </div>
      ) : (
        <SectionCard eyebrow="Family dashboard" title="No child linked yet" icon="home">
          <p className="text-sm leading-7 text-[#5f6b7a]">
            Complete an enrollment to see child profiles, learning progress, and class access here.
          </p>
        </SectionCard>
      )}

      {showAddChildModal ? (
        <AddChildEnrollmentModal
          parent={{
            parentName: dashboard.parentName,
            parentEmail: dashboard.parentProfile.email,
            phoneCountryCode: dashboard.parentProfile.phoneCountryCode,
            phoneNumber: dashboard.parentProfile.phoneNumber,
            billingCountryCode: dashboard.parentProfile.billingCountryCode,
            billingCountryName: dashboard.parentProfile.billingCountryName,
          }}
          offers={options.offers}
          countries={options.countries}
        />
      ) : null}
    </FamilyDashboardFrame>
  );
}
