import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import {
  TeacherDashboardFrame,
  TeacherInfoList,
  TeacherMetricGrid,
  TeacherSection,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title={dashboard.teacherName}
      subtitle="Run live classes, follow student rosters, review assessments, and prepare course delivery from one teaching workspace."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Assigned classes", value: String(dashboard.metrics.assignedClasses), hint: "Weekly teaching timetable." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Active learners across assigned programmes." },
          { label: "Quizzes to review", value: String(dashboard.metrics.quizzesToReview), hint: "Pending assessment marking queue." },
          { label: "Journal reviews", value: String(dashboard.metrics.journalReviews), hint: "Reflection entries awaiting feedback." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <TeacherSection
            eyebrow="Teaching load"
            title="Upcoming classes"
            action={
              <Link href="/teacher/schedule" className="text-sm font-semibold text-[#2a76aa]">
                Open schedule
              </Link>
            }
          >
            <TeacherInfoList
              items={dashboard.classes.slice(0, 6).map(
                (entry) =>
                  `${entry.title} • ${formatWeekday(entry.weekday)} • ${entry.startTime}-${entry.endTime} • ${entry.activeEnrollments} active learners`,
              )}
              emptyLabel="Assigned classes will appear here after teacher onboarding."
            />
          </TeacherSection>

          <TeacherSection
            eyebrow="Assessment"
            title="Quiz and journal review queue"
            action={
              <Link href="/teacher/quizzes" className="text-sm font-semibold text-[#2a76aa]">
                Open quizzes
              </Link>
            }
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <TeacherInfoList
                items={dashboard.quizReviewQueue.slice(0, 6).map(
                  (entry) =>
                    `${entry.studentName} • ${entry.quizTitle} • ${entry.score ?? "Pending"} pts`,
                )}
                emptyLabel="Submitted quiz attempts will appear here."
              />
              <TeacherInfoList
                items={dashboard.journals.slice(0, 6).map(
                  (entry) =>
                    `${entry.studentName} • ${entry.title} • ${entry.practiceMinutes} min • ${formatGrade(entry.selfRating)}`,
                )}
                emptyLabel="Journal reviews will appear here."
              />
            </div>
          </TeacherSection>

          <TeacherSection
            eyebrow="Published work"
            title="Weekly content and assigned tasks"
            action={
              <Link href="/teacher/course-builder" className="text-sm font-semibold text-[#2a76aa]">
                Open builder
              </Link>
            }
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <TeacherInfoList
                items={dashboard.lessonLogs.slice(0, 6).map(
                  (entry) => `${entry.title} • ${entry.topic} • ${entry.lessonDate.toLocaleDateString("en-GB")}`,
                )}
                emptyLabel="Lesson updates you publish will appear here."
              />
              <TeacherInfoList
                items={dashboard.assignments.slice(0, 6).map((task) => {
                  const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
                  return `${task.programTitle} • ${task.title} • ${task.submissions} submissions • ${due}`;
                })}
                emptyLabel="Published tasks and homework will appear here."
              />
            </div>
          </TeacherSection>
        </div>

        <div className="space-y-6">
          <TeacherSection eyebrow="Course builder" title="Lesson delivery">
            <TeacherInfoList
              items={[
                "Create weekly lesson updates by class and date",
                "Attach drive links, PDFs, worksheets, and homework guidance",
                "Publish tasks so parents and students see them on their dashboards",
              ]}
              emptyLabel="Course builder setup will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Profile" title="Teaching profile">
            <TeacherInfoList
              items={[
                `Email • ${dashboard.profile.email}`,
                `Phone • ${dashboard.profile.phone ?? "Pending"}`,
                `Timezone • ${dashboard.profile.timezone ?? "Europe/London"}`,
                `Specialties • ${dashboard.profile.specialties.length ? dashboard.profile.specialties.join(", ") : "Pending"}`,
              ]}
              emptyLabel="Teacher profile details will appear here."
            />
          </TeacherSection>
        </div>
      </div>
    </TeacherDashboardFrame>
  );
}
