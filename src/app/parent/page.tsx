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
  const earnedBadges = child.badges.filter((badge) => badge.status === "earned").length;
  const openTasks = child.assignments.filter((assignment) => !["SUBMITTED", "REVIEWED"].includes(assignment.status)).length;

  return {
    quizAttempts,
    submittedAssignments,
    earnedBadges,
    openTasks,
    weeklyMissions: quizAttempts + submittedAssignments + child.journals.length,
    safetyFlags: 0,
  };
}

function currentCircle(child: ParentChild) {
  return child.nextClass
    ? child.courses.find((course) => course.title === child.nextClass?.title)?.roomAssignment ?? null
    : child.courses[0]?.roomAssignment ?? null;
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
  const circle = selectedChild ? currentCircle(selectedChild) : null;
  const latestProject = selectedChild?.assignments[0] ?? null;

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
      subtitle="A family command center for learning progress, safety visibility, feedback, classes, missions, and mentor updates."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Children", value: String(dashboard.children.length), hint: "Linked learner profiles in your family account." },
          { label: "Access", value: dashboard.accessStateLabel, hint: "Payment status controls learning access." },
          { label: "Missions", value: String(activity?.weeklyMissions ?? 0), hint: "Quizzes, tasks, and reflections completed." },
          { label: "Safety alerts", value: String(activity?.safetyFlags ?? 0), hint: "Flagged community activity visible to parents." },
        ]}
      />

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
          <section className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_380px]">
              <div className="bg-[#17243a] p-5 text-white sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f]">Family overview</p>
                <h2 className="mt-3 text-2xl font-semibold">{selectedChild.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                  {selectedChild.courses.length} courses - {selectedChild.attendanceRate}% attendance - {activity.openTasks} open tasks.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Missions", activity.weeklyMissions],
                    ["Badges", activity.earnedBadges],
                    ["Quiz attempts", activity.quizAttempts],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-white/10 px-4 py-3">
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="mt-1 text-xs text-white/70">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid content-between gap-4 bg-[#fff9f2] p-5 sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Trust and safety</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#22304a]">
                    {activity.safetyFlags === 0 ? "No active safety alerts" : `${activity.safetyFlags} safety alerts`}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                    Community spaces are designed for supervised, age-aware participation. Parent-visible alerts will appear here.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">Mentor supervised</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#245d85]">Private data protected</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8a6326]">Parent aware</span>
                </div>
              </div>
            </div>
          </section>

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

              <SectionCard eyebrow="Community participation" title="Circle, missions, and safe activity" icon="sun">
                <div className={`grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                  <div className="rounded-2xl bg-[#fbf6ef] p-4 text-sm">
                    <p className="font-semibold text-[#22304a]">{circle?.roomName ?? "Circle pending"}</p>
                    <p className="mt-2 leading-6 text-[#5f6b7a]">
                      {circle ? `Room code ${circle.roomCode ?? "pending"} - supervised class grouping.` : "Community room assignment will appear here."}
                    </p>
                  </div>
                  <InfoList
                    items={[
                      `${activity.weeklyMissions} mission activities recorded`,
                      `${activity.openTasks} open tasks need attention`,
                      `${activity.earnedBadges} badges earned`,
                    ]}
                    emptyLabel="Community activity will appear here."
                  />
                  <InfoList
                    items={[
                      "No uncontrolled private messaging",
                      "No student external links in MVP",
                      "Mentor escalation visible when needed",
                    ]}
                    emptyLabel="Safety rules will appear here."
                  />
                </div>
              </SectionCard>

              <SectionCard eyebrow="Learning" title="Quizzes, assignments, and journal" icon="sparkles">
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

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <SectionCard eyebrow="Teacher updates" title="Daily work and weekly tasks" icon="pen">
                  <div className={`grid gap-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                    <InfoList
                      items={selectedChild.lessonUpdates.slice(0, 3).map((update) => {
                        const topic = update.topic.length > 58 ? `${update.topic.slice(0, 58)}...` : update.topic;
                        return `${update.programTitle}: ${topic} - ${formatWeekday(update.lessonDate.getDay())}`;
                      })}
                      emptyLabel="Teacher lesson updates will appear here once daily content starts being posted."
                    />
                    <InfoList
                      items={selectedChild.assignments.slice(0, 3).map((assignment) => {
                        const due = assignment.dueDate
                          ? `Due ${assignment.dueDate.toLocaleDateString("en-GB")}`
                          : "No due date yet";
                        return `${assignment.programTitle}: ${assignment.title} - ${due}`;
                      })}
                      emptyLabel="Weekly tasks and homework will appear here once teachers publish them."
                    />
                  </div>
                </SectionCard>

                <SectionCard eyebrow="Weekly journal" title="Growth summary" icon="chart">
                  <CompactList
                    items={[
                      { label: selectedChild.journalMonthlySummary.mostConsistentTrait, meta: "Most consistent trait", icon: "star" },
                      { label: selectedChild.journalMonthlySummary.strongestSkillArea, meta: "Strongest skill area", icon: "chart" },
                      { label: `${selectedChild.journalMonthlySummary.leadershipDevelopmentScore}/5`, meta: "Leadership score", icon: "sparkles" },
                    ]}
                    emptyLabel="Monthly journal growth will appear here."
                  />
                </SectionCard>
              </div>
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
                    <LiveClassCountdown
                      startsAt={selectedChild.nextClass.nextStartsAt.toISOString()}
                      meetingUrl={selectedChild.nextClass.meetingUrl}
                      accessLocked={selectedChild.accessLocked}
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-7 text-[#5f6b7a]">
                    Weekly schedule details will appear after class times are assigned.
                  </p>
                )}
              </SectionCard>

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

              <SectionCard eyebrow="Team project" title={latestProject?.title ?? "Project visibility"} icon="gift">
                <CompactList
                  items={[
                    {
                      label: latestProject?.status.replace(/_/g, " ") ?? "Project pending",
                      meta: latestProject?.dueDate ? `Due ${latestProject.dueDate.toLocaleDateString("en-GB")}` : "Deadline pending",
                      icon: "check",
                    },
                    {
                      label: latestProject?.feedback ?? "Mentor feedback pending",
                      meta: "Parent-visible summary",
                      icon: "pen",
                    },
                    { label: "Showcase is approval-only", meta: "Admin moderated", icon: "trophy" },
                  ]}
                  emptyLabel="Project activity will appear here."
                />
              </SectionCard>

              <SectionCard eyebrow="Recognition" title="Badges and certificates" icon="trophy">
                <CompactList
                  items={selectedChild.badges.slice(0, 3).map((badge) => ({
                    label: badge.title,
                    meta: badge.status === "earned" ? "Earned" : "In progress",
                    icon: "trophy",
                  }))}
                  emptyLabel="Badges, gem-of-the-week, and certificates will appear here as student activity grows."
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
