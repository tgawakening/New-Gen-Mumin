import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import {
  FamilyDashboardFrame,
  InfoList,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentDashboardPage() {
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
      title={dashboard.studentName}
      subtitle="Your courses, assessment activity, weekly journal, progress reports, and class schedule all live in one learning dashboard."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          {
            label: "Courses",
            value: String(child.courses.length),
            hint: "Your enrolled programs and class status.",
          },
          {
            label: "Attendance",
            value: `${child.attendanceRate}%`,
            hint: "Present, late, absent, and excused tracking.",
          },
          {
            label: "Quizzes",
            value: String(child.quizzes.length),
            hint: "Pre-lesson and post-lesson assessments.",
          },
          {
            label: "Assignments",
            value: String(child.assignments.length),
            hint: "Submission tracking and teacher review.",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <SectionCard eyebrow="Courses" title="Your learning path" icon="book">
            <InfoList
              items={child.courses.map(
                (course) => `${course.title} - ${course.status} - ${course.meetingCount} weekly slots`,
              )}
              emptyLabel="Your courses will appear here once your enrollment is active."
            />
          </SectionCard>

          <SectionCard eyebrow="Assessment" title="Quizzes and assignments" icon="sparkles">
            <div className={`grid gap-4 xl:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
              <InfoList
                items={child.quizzes.slice(0, 4).map((quiz) => {
                  const score = quiz.latestScore === null ? "Awaiting score" : `${quiz.latestScore} pts`;
                  return `${quiz.title} - ${quiz.type} - ${score}`;
                })}
                emptyLabel="Published quizzes will appear after your teacher prepares the lessons."
              />
              <InfoList
                items={child.assignments.slice(0, 4).map((assignment) => {
                  const status = assignment.status.replace(/_/g, " ");
                  const score = assignment.score === null ? "Pending review" : `${assignment.score} pts`;
                  return `${assignment.title} - ${status} - ${score}`;
                })}
                emptyLabel="Assignments and homework submissions will appear here."
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Weekly content" title="Teacher updates and today's tasks" icon="pen">
            <div className={`grid gap-4 xl:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
              <InfoList
                items={child.lessonUpdates.slice(0, 5).map(
                  (update) =>
                    `${update.programTitle} - ${update.topic} - ${update.teacherName ?? "Teacher"} - ${update.summary}`,
                )}
                emptyLabel="Your teacher lesson updates will appear here after content is published."
              />
              <InfoList
                items={child.assignments.slice(0, 5).map((assignment) => {
                  const due = assignment.dueDate
                    ? `Due ${assignment.dueDate.toLocaleDateString("en-GB")}`
                    : "No due date set";
                  return `${assignment.title} - ${assignment.status.replace(/_/g, " ")} - ${due}`;
                })}
                emptyLabel="Tasks and homework will appear here when your teachers assign them."
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Reflection" title="Journal and progress" icon="chart">
            <div className={`grid gap-4 xl:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
              <InfoList
                items={child.journals.slice(0, 4).map(
                  (journal) =>
                    `${journal.template.weekLabel} - ${journal.practiceMinutes} min - ${formatGrade(journal.selfRating)}`,
                )}
                emptyLabel="Your journal entries will appear here once class reflection begins."
              />
              <InfoList
                items={child.progress.slice(0, 4).map(
                  (report) =>
                    `${report.programTitle} - ${formatGrade(report.grade)} - ${report.attendancePct ?? "Pending"}% attendance`,
                )}
                emptyLabel="Teacher reports will appear here once a reporting cycle is complete."
              />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Weekly growth"
            title="Journal summary"
            icon="star"
            action={
              !child.accessLocked ? (
                <Link
                  href="/student/journal/submit"
                  className="cursor-pointer rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
                >
                  Add weekly journal
                </Link>
              ) : null
            }
          >
            <div className={`grid gap-4 xl:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
              <InfoList
                items={[
                  `Most consistent trait - ${child.journalMonthlySummary.mostConsistentTrait}`,
                  `Strongest skill area - ${child.journalMonthlySummary.strongestSkillArea}`,
                  `Arabic fluency trend - ${child.journalMonthlySummary.arabicFluencyTrend}`,
                ]}
                emptyLabel="Monthly journal growth will appear here."
              />
              <InfoList
                items={[
                  `Leadership score - ${child.journalMonthlySummary.leadershipDevelopmentScore}/5`,
                  `Teacher summary - ${child.journalMonthlySummary.teacherSummary}`,
                ]}
                emptyLabel="Leadership and teacher summary will appear here."
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Next class" title="Weekly schedule" icon="calendar">
            {child.nextClass ? (
              <div className={`rounded-[24px] bg-[#22304a] p-5 text-white ${child.accessLocked ? "opacity-60" : ""}`}>
                <p className="text-lg font-semibold">{child.nextClass.title}</p>
                <p className="mt-2 text-sm text-white/80">
                  {formatWeekday(child.nextClass.weekday)} - {child.nextClass.startTime} - {child.nextClass.endTime}
                </p>
                <p className="mt-2 text-sm text-white/75">
                  {child.nextClass.provider ?? "Live class"} - {child.nextClass.timezone}
                </p>
                <p className="mt-2 text-sm text-white/75">
                  Teacher: {child.nextClass.teacherName ?? "Assigned soon"}
                </p>
                {child.nextClass.meetingUrl && !child.accessLocked ? (
                  <Link
                    href={child.nextClass.meetingUrl}
                    target="_blank"
                    className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
                  >
                    Open meeting link
                  </Link>
                ) : (
                  <p className="mt-4 text-sm text-white/70">
                    Meeting links become active once your access is fully unlocked.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[#5f6b7a]">
                Your class schedule will appear here once the weekly slot is assigned.
              </p>
            )}
          </SectionCard>

          <SectionCard eyebrow="Profile" title="Learner details" icon="profile">
            <InfoList
              items={[
                `Name - ${child.profile.displayName}`,
                `Email - ${child.profile.email}`,
                `Timezone - ${child.profile.timezone ?? "Europe/London"}`,
                `Country - ${child.profile.countryName ?? "Pending"}`,
              ]}
              emptyLabel="Profile details will appear here."
            />
          </SectionCard>

          <SectionCard eyebrow="Recognition" title="Badges and certificates" icon="trophy">
            <InfoList
              items={child.badges.map(
                (badge) =>
                  `${badge.title} - ${badge.status === "earned" ? "Earned" : "In progress"} - ${badge.description}`,
              )}
              emptyLabel="Badges, gem-of-the-week, and certificates will appear here as you complete more work."
            />
          </SectionCard>
        </div>
      </div>
    </FamilyDashboardFrame>
  );
}
