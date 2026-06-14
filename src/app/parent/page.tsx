import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import { AddChildEnrollmentModal } from "@/components/registration/AddChildEnrollmentModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { FULL_GENM_PROGRAM_SLUGS } from "@/lib/registration/catalog";
import { getRegistrationOptions } from "@/lib/registration/service";
import {
  ChildSelector,
  CompactList,
  FamilyDashboardFrame,
  InfoList,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type ParentDashboard = NonNullable<Awaited<ReturnType<typeof getParentDashboardData>>>;
type ParentChild = ParentDashboard["children"][number];

type PageProps = {
  searchParams?: { child?: string; addChild?: string; enrollProgram?: string };
};

function buildParentActivity(child: ParentChild) {
  const quizAttempts = child.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0);
  const submittedAssignments = child.assignments.filter((assignment) =>
    ["SUBMITTED", "REVIEWED"].includes(assignment.status),
  ).length;
  const openTasks = child.assignments.filter((assignment) => !["SUBMITTED", "REVIEWED"].includes(assignment.status)).length;

  return {
    quizAttempts,
    submittedAssignments,
    openTasks,
  };
}

type RegistrationOffer = Awaited<ReturnType<typeof getRegistrationOptions>>["offers"][number];

function enrolledProgramSlugs(child: ParentChild) {
  const slugs = new Set(child.courses.map((course) => course.programSlug));
  if (slugs.has("full-bundle")) {
    return new Set<string>(FULL_GENM_PROGRAM_SLUGS);
  }
  return slugs;
}

function hasFullGenM(child: ParentChild) {
  const slugs = enrolledProgramSlugs(child);
  return FULL_GENM_PROGRAM_SLUGS.every((slug) => slugs.has(slug));
}

function offerProgramSlugs(offer: RegistrationOffer) {
  return "programSlugs" in offer && Array.isArray(offer.programSlugs) ? offer.programSlugs : [];
}

function eligibleProgramOffers(offers: RegistrationOffer[], child: ParentChild) {
  const enrolled = enrolledProgramSlugs(child);
  return offers
    .filter((offer) => {
      const programSlugs = offerProgramSlugs(offer);
      return programSlugs.length > 0 && programSlugs.some((slug) => !enrolled.has(slug));
    })
    .sort((left, right) => {
      if (left.slug === "full-bundle") return -1;
      if (right.slug === "full-bundle") return 1;
      return 0;
    });
}

export default async function ParentDashboardPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  let dashboard: ParentDashboard | null = null;

  try {
    dashboard = await getParentDashboardData(session.user.id);
  } catch (error) {
    console.error("Failed to load parent dashboard", error);
    return (
      <FamilyDashboardFrame
        roleLabel="Parent Dashboard"
        title="Assalamu alaikum"
        subtitle="We could not load your family dashboard right now."
        navItems={getParentNavItems(undefined)}
      >
        <SectionCard eyebrow="Error" title="Unable to load dashboard" icon="home">
          <p className="text-sm leading-7 text-[#5f6b7a]">
            We are having trouble loading your parent dashboard. Please refresh the page or contact support if this keeps happening.
          </p>
        </SectionCard>
      </FamilyDashboardFrame>
    );
  }

  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length && dashboard.accessLocked) {
    if (dashboard.pendingRegistrationId) {
      redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    }
    redirect("/registration");
  }

  const params = searchParams;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const showAddChildModal = params?.addChild === "1";
  const showProgramEnrollmentModal = params?.enrollProgram === "1" && selectedChild && !hasFullGenM(selectedChild);
  const activity = selectedChild ? buildParentActivity(selectedChild) : null;

  let options = { offers: [], countries: [] } as Awaited<ReturnType<typeof getRegistrationOptions>>;
  if (showAddChildModal || showProgramEnrollmentModal) {
    try {
      options = await getRegistrationOptions();
    } catch (error) {
      console.error("Failed to load registration options for add-child modal", error);
    }
  }
  const programEnrollmentOffers =
    showProgramEnrollmentModal && selectedChild ? eligibleProgramOffers(options.offers, selectedChild) : [];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title={`Assalamu alaikum, ${dashboard.parentName}`}
      subtitle="Quick access to live sessions, curriculum, enrolled courses, teacher updates, and your child's learning progress."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard
        eyebrow="Child selector"
        title="Choose a learner"
        icon="star"
        action={
          <div className="flex flex-wrap gap-2">
            {selectedChild ? (
              <Link
                href={`/parent/student-view?child=${selectedChild.id}`}
                className="cursor-pointer rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#17243a]"
              >
                Open student dashboard
              </Link>
            ) : null}
            <Link
              href="/parent?addChild=1"
              className="cursor-pointer rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
            >
              Add another child
            </Link>
            {selectedChild && !hasFullGenM(selectedChild) ? (
              <Link
                href={`/parent?child=${selectedChild.id}&enrollProgram=1`}
                className="cursor-pointer rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f7fbff]"
              >
                Explore other programmes
              </Link>
            ) : null}
          </div>
        }
      >
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent"
        />
      </SectionCard>

      {selectedChild && activity ? (
        <>
          <SectionCard
            eyebrow="Live sessions"
            title="Next scheduled class"
            icon="calendar"
            action={<Link href={`/parent/schedule?child=${selectedChild.id}`} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">Open full schedule</Link>}
          >
            {selectedChild.nextClass ? (
              <div className={`grid gap-4 rounded-[24px] bg-[#22304a] p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <div>
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
                <LiveClassCountdown
                  startsAt={selectedChild.nextClass.nextStartsAt.toISOString()}
                  meetingUrl={selectedChild.nextClass.meetingUrl}
                  accessLocked={selectedChild.accessLocked}
                />
              </div>
            ) : (
              <p className="text-sm leading-7 text-[#5f6b7a]">
                Weekly live session timing will appear here after admin or teachers assign the schedule.
              </p>
            )}
          </SectionCard>

          <MetricGrid
            metrics={[
              { label: "Children", value: String(dashboard.children.length), hint: "Linked learner profiles in your family account." },
              { label: "Access", value: dashboard.accessStateLabel, hint: "Payment status controls learning access." },
              { label: "Courses", value: String(selectedChild.courses.length), hint: "Currently enrolled programmes." },
              { label: "Open tasks", value: String(activity.openTasks), hint: "Assignments still needing attention." },
            ]}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <SectionCard
                eyebrow="Courses"
                title={selectedChild.name}
                icon="book"
                action={
                  !hasFullGenM(selectedChild) ? (
                    <Link
                      href={`/parent?child=${selectedChild.id}&enrollProgram=1`}
                      className="rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
                    >
                      Explore other programmes
                    </Link>
                  ) : null
                }
              >
                <CompactList
                  items={selectedChild.courses.map((course) => ({
                    label: course.title,
                    meta: `${course.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned teachers"} - ${course.meetingCount} weekly slots`,
                    icon: "book",
                  }))}
                  emptyLabel="Courses will appear here once enrollment is active."
                />
              </SectionCard>

              <SectionCard eyebrow="Learning tasks" title="Quizzes, homework, and journal" icon="sparkles">
                <div className={`grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                  <InfoList
                    items={selectedChild.quizzes.slice(0, 4).map((quiz) =>
                      quiz.latestSubmittedAt
                        ? `${quiz.title} - ${quiz.type} - ${quiz.latestScore ?? "Pending review"} pts`
                        : `${quiz.title} - ${quiz.type} - Not attempted yet`,
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

              <SectionCard eyebrow="Teacher updates" title="Recent lessons and weekly tasks" icon="pen">
                <div className={`grid gap-4 xl:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                  <InfoList
                    items={selectedChild.lessonUpdates.slice(0, 4).map((update) => {
                      const topic = update.topic.length > 58 ? `${update.topic.slice(0, 58)}...` : update.topic;
                      return `${update.programTitle}: ${topic} - ${formatWeekday(update.lessonDate.getDay())}`;
                    })}
                    emptyLabel="Teacher lesson updates will appear here once teachers publish them."
                  />
                  <InfoList
                    items={selectedChild.assignments.slice(0, 4).map((assignment) => {
                      const due = assignment.dueDate
                        ? `Due ${assignment.dueDate.toLocaleDateString("en-GB")}`
                        : "No due date yet";
                      return `${assignment.programTitle}: ${assignment.title} - ${due}`;
                    })}
                    emptyLabel="Weekly tasks and homework will appear here once teachers publish them."
                  />
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard eyebrow="Weekly feedback" title="Parent check-in" icon="journal">
                <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                  <p className="font-semibold text-[#22304a]">Review and support this week</p>
                  <p className="mt-1 leading-6">
                    See the student reflection, teacher comments, and progress trends before submitting parent feedback.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/parent/journal?child=${selectedChild.id}`} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                      Open journal
                    </Link>
                    <Link href={`/parent/progress?child=${selectedChild.id}`} className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
                      View progress
                    </Link>
                  </div>
                </div>
              </SectionCard>

              <SectionCard eyebrow="Progress" title="Attendance and reports" icon="chart">
                <CompactList
                  items={[
                    {
                      label: `${selectedChild.attendanceRate}% attendance`,
                      meta: "Overall attendance",
                      icon: "check",
                    },
                    ...selectedChild.progress.slice(0, 2).map((report) => ({
                      label: report.programTitle,
                      meta: `${report.reportPeriod} - ${report.grade ?? "Grade pending"}`,
                      icon: "chart" as const,
                    })),
                  ]}
                  emptyLabel="Progress reports will appear here after teachers publish them."
                />
              </SectionCard>
            </div>
          </div>
        </>
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
      {showProgramEnrollmentModal && selectedChild ? (
        <AddChildEnrollmentModal
          parent={{
            parentName: dashboard.parentName,
            parentEmail: dashboard.parentProfile.email,
            phoneCountryCode: dashboard.parentProfile.phoneCountryCode,
            phoneNumber: dashboard.parentProfile.phoneNumber,
            billingCountryCode: dashboard.parentProfile.billingCountryCode,
            billingCountryName: dashboard.parentProfile.billingCountryName,
          }}
          offers={programEnrollmentOffers}
          countries={options.countries}
          existingChild={{
            id: selectedChild.id,
            name: selectedChild.name,
            firstName: selectedChild.profile.firstName,
            lastName: selectedChild.profile.lastName,
            age: selectedChild.profile.age,
            gender: selectedChild.profile.gender,
          }}
          closePath={`/parent?child=${selectedChild.id}`}
        />
      ) : null}
    </FamilyDashboardFrame>
  );
}
