import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import { StudentQuestHub } from "@/components/dashboard/family/StudentQuestHub";
import {
  ChildSelector,
  CompactList,
  FamilyDashboardFrame,
  InfoList,
  SectionCard,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";

type ParentDashboard = NonNullable<Awaited<ReturnType<typeof getParentDashboardData>>>;
type ParentChild = ParentDashboard["children"][number];
type AvatarVariant = "boy" | "girl" | "neutral";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

function avatarVariantForGender(gender?: string | null): AvatarVariant {
  const normalized = gender?.trim().toLowerCase() ?? "";
  if (["female", "girl", "f"].includes(normalized)) return "girl";
  if (["male", "boy", "m"].includes(normalized)) return "boy";
  return "neutral";
}

function buildStudentStats(child: ParentChild) {
  const quizAttempts = child.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0);
  const submittedAssignments = child.assignments.filter((assignment) =>
    ["SUBMITTED", "REVIEWED"].includes(assignment.status),
  ).length;
  const earnedBadges = child.badges.filter((badge) => badge.status === "earned").length;
  const journalCount = child.journals.length;
  const totalQuizScore = child.quizzes.reduce((sum, quiz) => sum + (quiz.bestScore ?? quiz.latestScore ?? 0), 0);
  const completedMissions = quizAttempts + submittedAssignments + journalCount;
  const housePoints =
    child.attendanceRate * 5 +
    totalQuizScore * 4 +
    submittedAssignments * 45 +
    journalCount * 35 +
    earnedBadges * 90;

  return {
    completedMissions,
    earnedBadges,
    housePoints,
    level: Math.max(1, Math.floor(housePoints / 300) + 1),
    streak: completedMissions > 0 ? Math.min(30, Math.max(1, journalCount + quizAttempts)) : 0,
  };
}

function buildDailyMission(child: ParentChild) {
  const openQuiz = child.quizzes.find((quiz) => quiz.attempts.length === 0);
  if (openQuiz) {
    return {
      title: openQuiz.title,
      label: "Kahoot-style quiz mission",
      detail: `${openQuiz.questionCount} questions - ${openQuiz.totalPoints} points`,
      progress: 30,
    };
  }

  const openAssignment = child.assignments.find((assignment) => !["SUBMITTED", "REVIEWED"].includes(assignment.status));
  if (openAssignment) {
    return {
      title: openAssignment.title,
      label: "Team project task",
      detail: openAssignment.dueDate ? `Due ${openAssignment.dueDate.toLocaleDateString("en-GB")}` : "No due date yet",
      progress: 45,
    };
  }

  return {
    title: "Weekly reflection",
    label: "Adab and growth check-in",
    detail: "Review practice, confidence, and character growth for this week",
    progress: child.journals.length ? 80 : 20,
  };
}

function currentCircle(child: ParentChild) {
  return child.nextClass
    ? child.courses.find((course) => course.title === child.nextClass?.title)?.roomAssignment ?? null
    : child.courses[0]?.roomAssignment ?? null;
}

export default async function ParentStudentViewPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) redirect("/parent");

  const params = searchParams ? await searchParams : {};
  const selectedChild = dashboard.children.find((child) => child.id === params.child) ?? dashboard.children[0];
  const stats = buildStudentStats(selectedChild);
  const dailyMission = buildDailyMission(selectedChild);
  const classCircle = currentCircle(selectedChild);
  const projectTask = selectedChild.assignments[0] ?? null;
  const dashboardMetrics = [
    { label: "Daily streak", value: `${stats.streak} days`, hint: "Quiz, journal, and task activity." },
    { label: "Level", value: `Level ${stats.level}`, hint: "Grows with missions, attendance, and badges." },
    { label: "House points", value: String(stats.housePoints), hint: "Calculated from learning activity." },
    { label: "Attendance", value: `${selectedChild.attendanceRate}%`, hint: "Recent class presence." },
  ];
  const badgeItems = selectedChild.badges.length
    ? selectedChild.badges.slice(0, 4).map((badge, index) => ({
        label: badge.title,
        meta: badge.status === "earned" ? "Earned badge" : "In progress",
        tone: (["coral", "blue", "mint", "violet"] as const)[index % 4],
      }))
    : [
        { label: "Mission Starter", meta: "Complete the first quest", tone: "coral" as const },
        { label: "Circle Ready", meta: "Mentor-supervised spaces", tone: "blue" as const },
        { label: "Adab Builder", meta: "Weekly reflection", tone: "mint" as const },
      ];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent-supervised Student View"
      title={`${selectedChild.name}'s Gen Mu'min Hub`}
      subtitle="A child-specific dashboard opened from the parent account. Siblings stay separate by selecting a learner first."
      navItems={getParentNavItems(selectedChild.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard
        eyebrow="Learner switcher"
        title="Choose which student dashboard to view"
        icon="star"
        action={
          <Link
            href={`/parent?child=${selectedChild.id}`}
            className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
          >
            Back to parent dashboard
          </Link>
        }
      >
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild.id}
          basePath="/parent/student-view"
        />
      </SectionCard>

      <StudentQuestHub
        studentName={selectedChild.name}
        roleLabel="Student Home"
        mission={dailyMission}
        houseName="House path"
        houseVirtue="Amanah"
        metrics={dashboardMetrics}
        badges={badgeItems}
        actions={[
          { label: "Review missions", href: `/parent/quizzes?child=${selectedChild.id}` },
          { label: "Weekly feedback", href: `/parent/feedback?child=${selectedChild.id}`, variant: "secondary" },
        ]}
        nextClassLabel={
          selectedChild.nextClass
            ? `${selectedChild.nextClass.title} on ${formatWeekday(selectedChild.nextClass.weekday)}`
            : "Schedule appears once assigned."
        }
        circleLabel={classCircle?.roomName ?? "Age-aware class circle opening soon."}
        avatarVariant={avatarVariantForGender(selectedChild.profile.gender)}
      />

      <div className="sr-only">
        <ul>
          {dashboardMetrics.map((metric) => (
            <li key={metric.label}>
              {metric.label}: {metric.value}. {metric.hint}
            </li>
          ))}
        </ul>
      </div>

      <section className="hidden overflow-hidden rounded-[28px] border border-[#eadfce] bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="bg-[#17243a] p-5 text-white sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f]">Today&apos;s mission</p>
            <h2 className="mt-3 text-2xl font-semibold">{dailyMission.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              {dailyMission.label} - {dailyMission.detail}
            </p>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[#f39f5f]" style={{ width: `${dailyMission.progress}%` }} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/parent/quizzes?child=${selectedChild.id}`}
                className="rounded-full bg-[#f39f5f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
              >
                Review missions
              </Link>
              <Link
                href={`/parent/feedback?child=${selectedChild.id}`}
                className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Weekly feedback
              </Link>
            </div>
          </div>
          <div className="grid content-between gap-4 bg-[#fff9f2] p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Student mode</p>
              <h3 className="mt-2 text-xl font-semibold text-[#22304a]">Opened from parent account</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                No child password is needed for younger learners. Each sibling has a separate view, progress, classes, and feedback links.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Missions", stats.completedMissions],
                ["Badges", stats.earnedBadges],
                ["Courses", selectedChild.courses.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white px-3 py-3 text-center">
                  <p className="text-lg font-semibold text-[#22304a]">{value}</p>
                  <p className="mt-1 text-xs text-[#6d7785]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <div className="space-y-6">
          <SectionCard eyebrow="Community" title="Class circle and safe announcements" icon="sun">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-[22px] bg-[#fbf6ef] p-4">
                <p className="text-sm font-semibold text-[#22304a]">
                  {classCircle?.roomName ?? selectedChild.nextClass?.title ?? "Circle opening soon"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                  {classCircle
                    ? `Room code ${classCircle.roomCode ?? "pending"} - mentor supervised.`
                    : "The age-aware class circle will appear here once assigned."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">Supervised</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#245d85]">Age-aware</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8a6326]">Links filtered</span>
                </div>
              </div>
              <InfoList
                items={[
                  "Same-gender buddy rooms can be enabled later with parent consent.",
                  "Parent-supervised view keeps younger students inside the family account.",
                  "Older students can receive separate logins when you approve that flow.",
                ]}
                emptyLabel="Community guidance will appear here."
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Learning" title="Missions, courses, and current work" icon="book">
            <div className={`grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              <CompactList
                items={selectedChild.courses.slice(0, 4).map((course) => ({
                  label: course.title,
                  meta: `${course.meetingCount} weekly slots`,
                  icon: "book",
                }))}
                emptyLabel="Courses will appear here once enrollment is active."
              />
              <CompactList
                items={selectedChild.assignments.slice(0, 4).map((assignment) => {
                  const due = assignment.dueDate ? assignment.dueDate.toLocaleDateString("en-GB") : "No due date";
                  return { label: assignment.title, meta: `${assignment.status.replace(/_/g, " ")} - ${due}`, icon: "pen" };
                })}
                emptyLabel="Tasks will appear here."
              />
              <CompactList
                items={selectedChild.quizzes.slice(0, 4).map((quiz) => {
                  const score = quiz.latestScore === null ? "Awaiting score" : `${quiz.latestScore} pts`;
                  return { label: quiz.title, meta: score, icon: "sparkles" };
                })}
                emptyLabel="Quizzes will appear here."
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Team project" title={projectTask?.title ?? "Guided collaboration"} icon="gift">
            <div className={`grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              <div className="rounded-[22px] bg-[#fbf6ef] p-4">
                <p className="text-sm leading-6 text-[#5f6b7a]">
                  {projectTask?.instructions ??
                    "Team projects will collect guided tasks, mentor feedback, and approved showcase work as class activity grows."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {projectTask?.status.replace(/_/g, " ") ?? "Not started"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {projectTask?.dueDate ? `Due ${projectTask.dueDate.toLocaleDateString("en-GB")}` : "Deadline pending"}
                  </span>
                </div>
              </div>
              <CompactList
                items={[
                  { label: "Task list", meta: projectTask ? "Active" : "Opens with first project", icon: "check" },
                  { label: "Mentor feedback", meta: projectTask?.feedback ?? "Pending", icon: "pen" },
                  { label: "Showcase", meta: "Admin approved only", icon: "trophy" },
                ]}
                emptyLabel="Project details will appear here."
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Updates" title="Recent teacher activity" icon="pen">
            <div className={`grid gap-3 md:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.lessonUpdates.slice(0, 4).map((update) => (
                <div key={update.id} className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm">
                  <p className="font-semibold text-[#22304a]">{update.programTitle}</p>
                  <p className="mt-1 text-[#5f6b7a]">{update.topic}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6d7785]">{update.summary}</p>
                </div>
              ))}
              {!selectedChild.lessonUpdates.length ? (
                <p className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm text-[#5f6b7a]">
                  Teacher updates will appear here.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Next class" title="Weekly schedule" icon="calendar">
            {selectedChild.nextClass ? (
              <div className={`rounded-[22px] bg-[#22304a] p-5 text-white ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                <p className="text-base font-semibold">{selectedChild.nextClass.title}</p>
                <p className="mt-2 text-sm text-white/80">
                  {formatWeekday(selectedChild.nextClass.weekday)} - {selectedChild.nextClass.startTime}-{selectedChild.nextClass.endTime}
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
              <p className="text-sm leading-7 text-[#5f6b7a]">Class schedule will appear here once assigned.</p>
            )}
          </SectionCard>

          <SectionCard eyebrow="Weekly feedback" title="Reflection check-in" icon="journal">
            <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
              <p className="font-semibold text-[#22304a]">Review this week&apos;s progress</p>
              <p className="mt-1 leading-6">
                Parent and student feedback can stay attached to this selected learner, so siblings never mix responses.
              </p>
              <Link
                href={`/parent/feedback?child=${selectedChild.id}`}
                className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
              >
                Open feedback
              </Link>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Profile" title="Learner details" icon="profile">
            <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
              <p className="font-semibold text-[#22304a]">{selectedChild.profile.displayName}</p>
              <p className="break-all text-xs leading-5 text-[#617184]">{selectedChild.profile.email}</p>
              <p className="mt-2">Timezone - {selectedChild.profile.timezone ?? "Europe/London"}</p>
              <p>Country - {selectedChild.profile.countryName ?? "Pending"}</p>
              <p>Age - {selectedChild.profile.age ?? "Pending"}</p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Growth" title="Growth summary" icon="star">
            <CompactList
              items={[
                { label: selectedChild.journalMonthlySummary.mostConsistentTrait, meta: "Trait", icon: "star" },
                { label: selectedChild.journalMonthlySummary.strongestSkillArea, meta: "Skill", icon: "chart" },
                { label: `${selectedChild.journalMonthlySummary.leadershipDevelopmentScore}/5`, meta: "Leadership", icon: "sparkles" },
              ]}
              emptyLabel="Growth summary will appear here."
            />
          </SectionCard>

          <SectionCard eyebrow="Journal" title="Recent reflections" icon="journal">
            <CompactList
              items={selectedChild.journals.slice(0, 4).map((journal) => ({
                label: journal.template.weekLabel,
                meta: `${journal.practiceMinutes} min - ${formatGrade(journal.selfRating)}`,
                icon: "journal",
              }))}
              emptyLabel="Journal reflections will appear here."
            />
          </SectionCard>
        </div>
      </div>
    </FamilyDashboardFrame>
  );
}
