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
  qabilas = [],
}: {
  dashboard: TeacherDashboardData;
  adminPreview?: boolean;
  qabilas?: Array<{ id: string; title: string; members: Array<{ id: string; name: string; role: string; active: boolean }>; recentActivity: number }>;
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

      {!adminPreview ? (
        <TeacherSection eyebrow="Start here" title="Main teaching workflow">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Set roster", href: "/teacher/roster", detail: "Confirm students for each programme." },
              { label: "Live sessions", href: "/teacher/live-sessions", detail: "Start or manage scheduled classes." },
              { label: "Curriculum builder", href: "/teacher/course-builder", detail: "Publish lessons, tasks, and weekly content." },
              { label: "Lesson log", href: "/teacher/lesson-log", detail: "Record what happened in class." },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[#dfe7ef] bg-[#fbf6ef] px-4 py-4 text-sm transition hover:border-[#f0b36f] hover:bg-[#fff8ef]"
              >
                <p className="font-semibold text-[#22304a]">{item.label}</p>
                <p className="mt-2 leading-6 text-[#617184]">{item.detail}</p>
              </Link>
            ))}
          </div>
        </TeacherSection>
      ) : null}

      {!adminPreview && qabilas.length ? <TeacherSection eyebrow="My Qabila" title="Team overview" action={<Link href="/teacher/community" className={linkClass}>Open Qabila community</Link>}>
        <div className="grid gap-4 lg:grid-cols-2">{qabilas.map((qabila) => { const active = qabila.members.filter((member) => member.active).length; return <Link key={qabila.id} href={`/teacher/community#${qabila.id}`} className="rounded-2xl border border-[#dfe7ef] bg-[#fbf6ef] p-4 transition hover:border-[#f0b36f]"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#22304a]">{qabila.title}</p><p className="mt-1 text-xs text-[#617184]">{qabila.members.length} learners · {active} recently active</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">View team</span></div><div className="mt-3 flex flex-wrap gap-2">{qabila.members.slice(0,8).map((member)=><span key={member.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#22304a]">{member.name}</span>)}</div>{qabila.members.length > 8 ? <p className="mt-2 text-xs text-[#617184]">+{qabila.members.length - 8} more learners</p> : null}</Link>; })}</div>
      </TeacherSection> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.75fr)]">
        <div className="space-y-6">
          <TeacherSection
            eyebrow="Teaching load"
            title="Upcoming classes"
            action={!adminPreview ? <Link href="/teacher/schedule" className={linkClass}>Open schedule</Link> : null}
          >
            {dashboard.classes.length ? (
              <div className="space-y-3">
                {dashboard.classes.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                    <p className="font-semibold text-[#22304a]">{entry.title}</p>
                    <p className="mt-1">
                      {formatWeekday(entry.weekday)} - {entry.startTime}-{entry.endTime} - {entry.activeEnrollments} active learners
                    </p>
                    {!adminPreview && entry.meetingUrl ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`/teacher/live-sessions/${entry.id}/start`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[#0f4d81] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Start as host
                        </a>
                        <a
                          href={`/teacher/live-sessions/${entry.id}/start?mode=member`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[#eef6ff] px-3 py-1.5 text-xs font-semibold text-[#0f4d81]"
                        >
                          Join as member
                        </a>
                        <Link
                          href={entry.meetingUrl}
                          target="_blank"
                          className="rounded-full border border-[#cdd9e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f4d81]"
                        >
                          Open Zoom link
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <TeacherInfoList items={[]} emptyLabel="Assigned classes will appear here after teacher onboarding." />
            )}
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
            eyebrow="Materials"
            title="Course resources"
            action={!adminPreview ? <Link href="/teacher/materials" className={linkClass}>Open materials</Link> : null}
          >
            <TeacherInfoList
              items={[
                "Upload worksheets, recordings, and revision files",
                "Organize resources by week or folder",
                "Admin approval publishes selected files to learners",
              ]}
              emptyLabel="Course materials will appear here."
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
