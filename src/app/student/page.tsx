import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentQuestData } from "@/lib/community/quest";
import { db } from "@/lib/db";
import { ensureStudentLiveClassReminders, getUnreadNotifications } from "@/lib/live-classes/notifications";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import { StudentQuestHub } from "@/components/dashboard/family/StudentQuestHub";
import {
  FamilyDashboardFrame,
  CompactList,
  SectionCard,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type StudentDashboard = NonNullable<Awaited<ReturnType<typeof getStudentDashboardData>>>;
type StudentChild = StudentDashboard["child"];

function buildStudentQuestStats(child: StudentChild) {
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

function buildDailyMission(child: StudentChild, persistentMission?: { title: string; description: string | null; questions: unknown[]; basePoints: number }) {
  if (persistentMission) {
    return {
      title: persistentMission.title,
      label: "Daily mission",
      detail: `${persistentMission.questions.length} question(s) - ${persistentMission.basePoints} base points`,
      href: "/student/missions",
      progress: 35,
      action: "Open mission",
    };
  }

  const openQuiz = child.quizzes.find((quiz) => quiz.attempts.length === 0);
  if (openQuiz) {
    return {
      title: openQuiz.title,
      label: "Kahoot-style quiz mission",
      detail: `${openQuiz.questionCount} questions - ${openQuiz.totalPoints} points`,
      href: "/student/quizzes",
      progress: 30,
      action: "Start mission",
    };
  }

  const openAssignment = child.assignments.find((assignment) => !["SUBMITTED", "REVIEWED"].includes(assignment.status));
  if (openAssignment) {
    return {
      title: openAssignment.title,
      label: "Team project task",
      detail: openAssignment.dueDate ? `Due ${openAssignment.dueDate.toLocaleDateString("en-GB")}` : "No due date yet",
      href: "/student/courses",
      progress: 45,
      action: "Open task",
    };
  }

  return {
    title: "Weekly reflection",
    label: "Adab and growth check-in",
    detail: "Log practice, confidence, and one character win",
    href: "/student/journal/submit",
    progress: child.journals.length ? 80 : 20,
    action: "Submit reflection",
  };
}

export default async function StudentDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  await ensureStudentLiveClassReminders(session.user.id);
  const notifications = await getUnreadNotifications(session.user.id, 3);
  const child = dashboard.child;
  const nextClassRoom = child.nextClass
    ? child.courses.find((course) => course.title === child.nextClass?.title)?.roomAssignment ?? null
    : null;
  const stats = buildStudentQuestStats(child);
  const profile = await db.studentProfile.findUnique({
    where: { id: child.id },
    include: { enrollments: { select: { programId: true } } },
  });
  const quest = await getStudentQuestData(child.id, profile?.enrollments.map((enrollment) => enrollment.programId) ?? []);
  const house = quest.membership.house;
  const dailyMission = buildDailyMission(child, quest.missions[0]);
  const projectTask = child.assignments[0] ?? null;
  const classCircle = nextClassRoom ?? child.courses[0]?.roomAssignment ?? null;
  const dashboardMetrics = [
    { label: "Daily streak", value: `${stats.streak} days`, hint: "Quiz, journal, and task activity." },
    { label: "Level", value: `Level ${stats.level}`, hint: "Grows with missions, attendance, and badges." },
    { label: "House points", value: String(quest.studentTotal || stats.housePoints), hint: `${house.name} contribution.` },
    { label: "Attendance", value: `${child.attendanceRate}%`, hint: "Recent class presence." },
  ];
  const badgeItems = child.badges.length
    ? child.badges.slice(0, 4).map((badge, index) => ({
        label: badge.title,
        meta: badge.status === "earned" ? "Earned badge" : "In progress",
        tone: (["coral", "blue", "mint", "violet"] as const)[index % 4],
      }))
    : [
        { label: "Mission Starter", meta: "Complete your first quest", tone: "coral" as const },
        { label: "Circle Ready", meta: "Join supervised spaces", tone: "blue" as const },
        { label: "Adab Builder", meta: "Reflect weekly", tone: "mint" as const },
      ];
  const announcements = notifications.length
    ? notifications
    : [
        {
          id: "safe-community",
          title: "Safe community spaces",
          body: "Class circles stay supervised and age-aware. Mentor-led spaces will appear as your group opens.",
          href: "/student/schedule",
        },
        {
          id: "weekly-feedback",
          title: "Weekly feedback",
          body: "Use your journal reflection to share progress, questions, and confidence for this week.",
          href: "/student/journal/submit",
        },
      ];

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title={`Assalamu alaikum, ${dashboard.studentName}`}
      subtitle="Your Gen Mu'min Hub for missions, class circles, projects, badges, schedule, and weekly growth."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <StudentQuestHub
        studentName={dashboard.studentName}
        roleLabel="Student Home"
        mission={dailyMission}
        houseName={house.name}
        houseVirtue={house.virtue}
        metrics={dashboardMetrics}
        badges={badgeItems}
        actions={[
          { label: dailyMission.action, href: dailyMission.href },
          { label: "Ask mentor", href: "/student/journal/submit", variant: "secondary" },
        ]}
        nextClassLabel={
          child.nextClass
            ? `${child.nextClass.title} on ${formatWeekday(child.nextClass.weekday)}`
            : "Schedule appears once assigned."
        }
        circleLabel={classCircle?.roomName ?? "Age-aware class circle opening soon."}
        avatarVariant={child.profile.age && child.profile.age < 9 ? "neutral" : "boy"}
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f]">Today&apos;s mission</p>
                <h2 className="mt-3 text-2xl font-semibold">{dailyMission.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                  {dailyMission.label} - {dailyMission.detail}
                </p>
              </div>
              <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#245d85]">{house.name}</span>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[#f39f5f]" style={{ width: `${dailyMission.progress}%` }} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={dailyMission.href}
                className="rounded-full bg-[#f39f5f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
              >
                {dailyMission.action}
              </Link>
              <Link
                href="/student/journal/submit"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Ask mentor
              </Link>
            </div>
          </div>
          <div className="grid content-between gap-4 bg-[#fff9f2] p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Quest identity</p>
              <h3 className="mt-2 text-xl font-semibold text-[#22304a]">{house.virtue} path</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                Complete missions, reflections, classes, and projects to build your rank.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Missions", quest.missions.length],
                ["Badges", stats.earnedBadges],
                ["Courses", child.courses.length],
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
                  {classCircle?.roomName ?? child.nextClass?.title ?? "Circle opening soon"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                  {classCircle
                    ? `Room code ${classCircle.roomCode ?? "pending"} - mentor supervised.`
                    : "Your age-aware class circle will appear here once the room is assigned."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">Supervised</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#245d85]">Age-aware</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8a6326]">Links filtered</span>
                </div>
              </div>
              <div className="grid gap-3">
                {announcements.slice(0, 2).map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href ?? "/student/schedule"}
                    className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3 transition hover:bg-[#fff9f2]"
                  >
                    <p className="text-sm font-semibold text-[#22304a]">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5f6b7a]">{notification.body}</p>
                  </Link>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Learning" title="Missions, courses, and current work" icon="book">
            <div className={`grid gap-4 xl:grid-cols-3 ${child.accessLocked ? "opacity-60" : ""}`}>
              <CompactList
                items={child.courses.slice(0, 4).map((course) => ({
                  label: course.title,
                  meta: `${course.meetingCount} weekly slots`,
                  icon: "book",
                }))}
                emptyLabel="Courses will appear here once enrollment is active."
              />
              <CompactList
                items={child.assignments.slice(0, 4).map((assignment) => {
                  const due = assignment.dueDate ? assignment.dueDate.toLocaleDateString("en-GB") : "No due date";
                  return { label: assignment.title, meta: `${assignment.status.replace(/_/g, " ")} - ${due}`, icon: "pen" };
                })}
                emptyLabel="Tasks will appear here."
              />
              <CompactList
                items={child.quizzes.slice(0, 4).map((quiz) => {
                  const score = quiz.latestScore === null ? "Awaiting score" : `${quiz.latestScore} pts`;
                  return { label: quiz.title, meta: score, icon: "sparkles" };
                })}
                emptyLabel="Quizzes will appear here."
              />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Team project"
            title={projectTask?.title ?? "Guided collaboration"}
            icon="gift"
            action={<Link href="/student/courses" className="text-sm font-semibold text-[#2a76aa]">Open projects</Link>}
          >
            <div className={`grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] ${child.accessLocked ? "opacity-60" : ""}`}>
              <div className="rounded-[22px] bg-[#fbf6ef] p-4">
                <p className="text-sm leading-6 text-[#5f6b7a]">
                  {projectTask?.instructions ??
                    "Team projects will collect guided tasks, mentor feedback, and approved showcase work as your class progresses."}
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
            <div className={`grid gap-3 md:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
              {child.lessonUpdates.slice(0, 4).map((update) => (
                <div key={update.id} className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm">
                  <p className="font-semibold text-[#22304a]">{update.programTitle}</p>
                  <p className="mt-1 text-[#5f6b7a]">{update.topic}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6d7785]">{update.summary}</p>
                </div>
              ))}
              {!child.lessonUpdates.length ? (
                <p className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm text-[#5f6b7a]">
                  Teacher updates will appear here.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Next class" title="Weekly schedule" icon="calendar">
            {child.nextClass ? (
              <div className={`rounded-[22px] bg-[#22304a] p-5 text-white ${child.accessLocked ? "opacity-60" : ""}`}>
                <p className="text-base font-semibold">{child.nextClass.title}</p>
                <p className="mt-2 text-sm text-white/80">
                  {formatWeekday(child.nextClass.weekday)} - {child.nextClass.startTime}-{child.nextClass.endTime}
                </p>
                <p className="mt-2 text-sm text-white/75">
                  {child.nextClass.provider ?? "Live class"} - {child.nextClass.timezone}
                </p>
                <LiveClassCountdown
                  startsAt={child.nextClass.nextStartsAt.toISOString()}
                  meetingUrl={child.nextClass.meetingUrl}
                  accessLocked={child.accessLocked}
                />
                {nextClassRoom ? (
                  <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm">
                    <p className="font-semibold">Room/group</p>
                    <p className="mt-1 text-white/80">
                      {nextClassRoom.roomName}
                      {nextClassRoom.roomCode ? ` - ${nextClassRoom.roomCode}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[#5f6b7a]">Your class schedule will appear here once assigned.</p>
            )}
          </SectionCard>

          <SectionCard eyebrow="Weekly feedback" title="Reflection check-in" icon="journal">
            <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
              <p className="font-semibold text-[#22304a]">Share this week&apos;s progress</p>
              <p className="mt-1 leading-6">Submit practice minutes, confidence, adab growth, and questions for your mentor.</p>
              <Link
                href="/student/journal/submit"
                className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
              >
                Open feedback form
              </Link>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Profile" title="Learner details" icon="profile">
            <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
              <p className="font-semibold text-[#22304a]">{child.profile.displayName}</p>
              <p className="break-all text-xs leading-5 text-[#617184]">{child.profile.email}</p>
              <p className="mt-2">Timezone - {child.profile.timezone ?? "Europe/London"}</p>
              <p>Country - {child.profile.countryName ?? "Pending"}</p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Growth" title="Growth summary" icon="star">
            <CompactList
              items={[
                { label: child.journalMonthlySummary.mostConsistentTrait, meta: "Trait", icon: "star" },
                { label: child.journalMonthlySummary.strongestSkillArea, meta: "Skill", icon: "chart" },
                { label: `${child.journalMonthlySummary.leadershipDevelopmentScore}/5`, meta: "Leadership", icon: "sparkles" },
              ]}
              emptyLabel="Growth summary will appear here."
            />
          </SectionCard>

          <SectionCard eyebrow="Recognition" title="Badges" icon="trophy">
            <CompactList
              items={child.badges.slice(0, 3).map((badge) => ({
                label: badge.title,
                meta: badge.status === "earned" ? "Earned" : "In progress",
                icon: "trophy",
              }))}
              emptyLabel="Badges will appear here."
            />
          </SectionCard>
        </div>
      </div>
    </FamilyDashboardFrame>
  );
}
