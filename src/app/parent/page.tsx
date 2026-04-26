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

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const showAddChildModal = params?.addChild === "1";

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title={`Assalamu alaikum, ${dashboard.parentName}`}
      subtitle="Switch between children, follow attendance and course access, and monitor schedule, quizzes, journal, and progress from one family workspace."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Children", value: String(dashboard.children.length), hint: "Linked learner profiles in your family account." },
          { label: "Access", value: dashboard.accessStateLabel, hint: "Payment status controls learning access." },
          { label: "Latest order", value: dashboard.latestOrder?.orderNumber ?? "No order yet", hint: dashboard.latestOrder ? `${dashboard.latestOrder.gateway} • ${dashboard.latestOrder.currency} ${dashboard.latestOrder.totalAmount}` : "Create or complete an enrollment to begin." },
          { label: "Selected child", value: selectedChild?.name ?? "No child yet", hint: selectedChild ? `${selectedChild.courses.length} courses • ${selectedChild.attendanceRate}% attendance` : "Your learners will appear here after registration." },
        ]}
      />

      <SectionCard
        eyebrow="Child selector"
        title="Choose a learner"
        action={
          <Link
            href="/parent?addChild=1"
            className="rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
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
            <SectionCard eyebrow="Courses" title={selectedChild.name}>
              <InfoList
                items={selectedChild.courses.map(
                  (course) => `${course.title} • ${course.status} • ${course.meetingCount} weekly slots`,
                )}
                emptyLabel="Courses will appear here once enrollment is active."
              />
            </SectionCard>

            <SectionCard eyebrow="Learning" title="Quizzes, assignments, and journal">
              <div className={`grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <InfoList
                  items={selectedChild.quizzes.slice(0, 4).map(
                    (quiz) => `${quiz.title} • ${quiz.type} • ${quiz.latestScore ?? "Pending"} pts`,
                  )}
                  emptyLabel="Published quizzes will appear here."
                />
                <InfoList
                  items={selectedChild.assignments.slice(0, 4).map(
                    (assignment) =>
                      `${assignment.title} • ${assignment.status.replace(/_/g, " ")} • ${assignment.score ?? "Pending"} pts`,
                  )}
                  emptyLabel="Assignments will appear here."
                />
                <InfoList
                  items={selectedChild.journals.slice(0, 4).map(
                    (journal) => `${journal.title} • ${journal.practiceMinutes} min • ${formatGrade(journal.selfRating)}`,
                  )}
                  emptyLabel="Journal reflections will appear here."
                />
              </div>
            </SectionCard>

            <SectionCard eyebrow="Teacher updates" title="Daily work and weekly tasks">
              <div className={`grid gap-4 xl:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <InfoList
                  items={selectedChild.lessonUpdates.slice(0, 5).map(
                    (update) =>
                      `${update.programTitle} â€¢ ${update.topic} â€¢ ${formatWeekday(update.lessonDate.getDay())} â€¢ ${update.teacherName ?? "Teacher update"}`,
                  )}
                  emptyLabel="Teacher lesson updates will appear here once daily content starts being posted."
                />
                <InfoList
                  items={selectedChild.assignments.slice(0, 5).map((assignment) => {
                    const due = assignment.dueDate
                      ? `Due ${assignment.dueDate.toLocaleDateString("en-GB")}`
                      : "No due date yet";
                    return `${assignment.programTitle} â€¢ ${assignment.title} â€¢ ${assignment.status.replace(/_/g, " ")} â€¢ ${due}`;
                  })}
                  emptyLabel="Weekly tasks and homework will appear here once teachers publish them."
                />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard eyebrow="Next class" title="Schedule">
              {selectedChild.nextClass ? (
                <div className={`rounded-[24px] bg-[#22304a] p-5 text-white ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                  <p className="text-lg font-semibold">{selectedChild.nextClass.title}</p>
                  <p className="mt-2 text-sm text-white/80">
                    {formatWeekday(selectedChild.nextClass.weekday)} • {selectedChild.nextClass.startTime} - {selectedChild.nextClass.endTime}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Teacher: {selectedChild.nextClass.teacherName ?? "Assigned soon"}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    {selectedChild.nextClass.provider ?? "Live class"} • {selectedChild.nextClass.timezone}
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-7 text-[#5f6b7a]">
                  Weekly schedule details will appear after class times are assigned.
                </p>
              )}
            </SectionCard>

            <SectionCard eyebrow="Payments" title="Enrollment billing">
              {dashboard.latestOrder ? (
                <InfoList
                  items={[
                    `Order • ${dashboard.latestOrder.orderNumber}`,
                    `Gateway • ${dashboard.latestOrder.gateway}`,
                    `Status • ${dashboard.latestOrder.status.replace(/_/g, " ")}`,
                    `Amount • ${dashboard.latestOrder.currency} ${dashboard.latestOrder.totalAmount}`,
                  ]}
                  emptyLabel="Payment details will appear here."
                />
              ) : (
                <p className="text-sm leading-7 text-[#5f6b7a]">
                  Payment details will appear here after the first enrollment checkout.
                </p>
              )}
            </SectionCard>

            <SectionCard eyebrow="Recognition" title="Badges and certificates">
              <InfoList
                items={selectedChild.badges.map(
                  (badge) =>
                    `${badge.title} â€¢ ${badge.status === "earned" ? "Earned" : "In progress"} â€¢ ${badge.description}`,
                )}
                emptyLabel="Badges, gem-of-the-week, and certificates will appear here as student activity grows."
              />
            </SectionCard>
          </div>
        </div>
      ) : (
        <SectionCard eyebrow="Family dashboard" title="No child linked yet">
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
