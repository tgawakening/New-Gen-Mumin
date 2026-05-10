import Link from "next/link";

import {
  TeacherInfoList,
  TeacherMetricGrid,
  TeacherSection,
  formatGrade,
  formatWeekday,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";
import type { TeacherDashboardData } from "@/lib/teacher/dashboard";

export function TeacherHomeDashboard({
  dashboard,
  adminPreview = false,
}: {
  dashboard: TeacherDashboardData;
  adminPreview?: boolean;
}) {
  const linkClass = "text-sm font-semibold text-[#2a76aa]";

  return (
    <>
      <TeacherMetricGrid
        metrics={[
          { label: "Assigned classes", value: String(dashboard.metrics.assignedClasses), hint: "Weekly teaching timetable." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Active learners across assigned programmes." },
          { label: "Quizzes to review", value: String(dashboard.metrics.quizzesToReview), hint: "Pending assessment marking queue." },
          { label: "Journal reviews", value: String(dashboard.metrics.journalReviews), hint: "Reflection entries awaiting feedback." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.75fr)]">
        <div className="space-y-6">
          <TeacherSection
            eyebrow="Teaching load"
            title="Upcoming classes"
            action={!adminPreview ? <Link href="/teacher/schedule" className={linkClass}>Open schedule</Link> : null}
          >
            <TeacherInfoList
              items={dashboard.classes.slice(0, 5).map(
                (entry) =>
                  `${entry.title} - ${formatWeekday(entry.weekday)} - ${entry.startTime}-${entry.endTime} - ${entry.activeEnrollments} active learners`,
              )}
              emptyLabel="Assigned classes will appear here after teacher onboarding."
            />
          </TeacherSection>

          <TeacherSection
            eyebrow="Assessment"
            title="Quiz and journal review queue"
            action={!adminPreview ? <Link href="/teacher/quizzes" className={linkClass}>Open quizzes</Link> : null}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <TeacherInfoList
                items={dashboard.quizReviewQueue.slice(0, 4).map(
                  (entry) => `${entry.studentName} - ${entry.quizTitle} - ${entry.score ?? "Pending"} pts`,
                )}
                emptyLabel="Submitted quiz attempts will appear here."
              />
              <TeacherInfoList
                items={dashboard.journals.slice(0, 4).map(
                  (entry) =>
                    `${entry.studentName} - ${entry.title} - ${entry.practiceMinutes} min - ${formatGrade(entry.selfRating)}`,
                )}
                emptyLabel="Journal reviews will appear here."
              />
            </div>
          </TeacherSection>

          <TeacherSection
            eyebrow="Published work"
            title="Lesson and task overview"
            action={!adminPreview ? <Link href="/teacher/course-builder" className={linkClass}>Open builder</Link> : null}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <TeacherInfoList
                items={dashboard.lessonLogs.slice(0, 3).map(
                  (entry) => `${entry.title} - ${entry.topic} - ${entry.lessonDate.toLocaleDateString("en-GB")}`,
                )}
                emptyLabel="Lesson updates you publish will appear here."
              />
              <TeacherInfoList
                items={dashboard.assignments.slice(0, 3).map((task) => {
                  const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
                  return `${task.programTitle} - ${task.title} - ${task.submissions} submissions - ${due}`;
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
                `Classes - ${dashboard.classes.length}`,
                `Lesson updates - ${dashboard.lessonLogs.length}`,
                `Assigned tasks - ${dashboard.assignments.length}`,
              ]}
              emptyLabel="Course builder setup will appear here."
            />
          </TeacherSection>

          <TeacherSection
            eyebrow="Profile"
            title="Teaching profile"
            action={!adminPreview ? <Link href="/teacher/profile" className={linkClass}>Open profile</Link> : null}
          >
            <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
              <p className="font-semibold text-[#22304a]">{dashboard.teacherName}</p>
              <p className="break-all text-xs text-[#617184]">{dashboard.profile.email}</p>
              <p className="mt-2">Phone - {dashboard.profile.phone ?? "Pending"}</p>
              <p>Timezone - {dashboard.profile.timezone ?? "Europe/London"}</p>
              <p>Specialties - {dashboard.profile.specialties.length ? dashboard.profile.specialties.slice(0, 3).join(", ") : "Pending"}</p>
            </div>
          </TeacherSection>
        </div>
      </div>
    </>
  );
}
