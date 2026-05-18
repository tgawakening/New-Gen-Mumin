import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { ensureStudentLiveClassReminders, getUnreadNotifications } from "@/lib/live-classes/notifications";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import {
  FamilyDashboardFrame,
  CompactList,
  MetricGrid,
  SectionCard,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

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

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title={dashboard.studentName}
      subtitle="A clear overview of today’s class access, course activity, tasks, and growth."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Courses", value: String(child.courses.length), hint: "Enrolled programs." },
          { label: "Attendance", value: `${child.attendanceRate}%`, hint: "Recent class presence." },
          { label: "Quizzes", value: String(child.quizzes.length), hint: "Published assessments." },
          { label: "Assignments", value: String(child.assignments.length), hint: "Active coursework." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="space-y-6">
          {notifications.length ? (
            <SectionCard eyebrow="Alerts" title="Latest notifications" icon="calendar">
              <div className="grid gap-3 md:grid-cols-3">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href ?? "/student/schedule"}
                    className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[#22304a]">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5f6b7a]">{notification.body}</p>
                  </Link>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard eyebrow="Learning" title="Courses and current work" icon="book">
            <div className={`grid gap-4 lg:grid-cols-3 ${child.accessLocked ? "opacity-60" : ""}`}>
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
                      {nextClassRoom.roomCode
                        ? ` - ${nextClassRoom.roomCode}`
                        : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[#5f6b7a]">Your class schedule will appear here once assigned.</p>
            )}
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
              items={child.badges.slice(0, 2).map((badge) => ({
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
