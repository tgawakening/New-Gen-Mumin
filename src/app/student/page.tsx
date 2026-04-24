import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";

function weekdayLabel(weekday: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    weekday
  ] ?? "Class day";
}

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
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff7ee_0%,#fffdf9_100%)]">
        <div className="section-container py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Student Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">
            {dashboard.studentName}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Your classes, quizzes, schedule, attendance, journal, and progress all live here.
          </p>
        </div>
      </div>

      <div className="section-container space-y-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Courses"
            value={`${child.courses.length}`}
            hint="Your enrolled programs and class status."
          />
          <MetricCard
            label="Attendance"
            value={`${child.attendanceRate}%`}
            hint="Present, late, absent, and excused tracking."
          />
          <MetricCard
            label="Access"
            value={dashboard.accessStateLabel}
            hint={
              dashboard.accessLocked
                ? "Lessons stay locked until payment is confirmed."
                : "Your learning area is fully unlocked."
            }
          />
          <MetricCard
            label="Practice log"
            value={`${child.journals[0]?.practiceMinutes ?? 0} min`}
            hint="Most recent journal practice entry."
          />
        </div>

        {dashboard.pendingReason ? (
          <section className="rounded-[26px] border border-[#f0d6b4] bg-[#fff7eb] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b56d1f]">
              Access pending
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
              {dashboard.accessStateLabel}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#6a5b49]">
              {dashboard.pendingReason}
            </p>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Courses
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                    Your learning path
                  </h2>
                </div>
                <span className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                  {child.statusLabel}
                </span>
              </div>

              <div className={`mt-6 grid gap-4 md:grid-cols-2 ${dashboard.accessLocked ? "opacity-60" : ""}`}>
                <PanelList
                  title="Courses"
                  items={child.courses.map((course) => `${course.title} • ${course.status}`)}
                  emptyLabel="Courses will appear here soon."
                />
                <PanelList
                  title="Attendance"
                  items={child.attendanceBreakdown.map((entry) => `${entry.label}: ${entry.value}`)}
                  emptyLabel="Attendance will appear after classes begin."
                />
              </div>
            </section>

            <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                    Learning activity
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                    Quizzes, journal, and progress
                  </h2>
                </div>
                {dashboard.accessLocked ? (
                  <span className="rounded-full bg-[#fff7eb] px-3 py-1 text-xs font-semibold text-[#a36f2a]">
                    Unlocks after payment confirmation
                  </span>
                ) : null}
              </div>

              <div className={`mt-6 grid gap-4 xl:grid-cols-3 ${dashboard.accessLocked ? "opacity-55" : ""}`}>
                <PanelList
                  title="Quizzes"
                  items={child.quizzes.map((quiz) => {
                    const score = quiz.score === null ? "Awaiting score" : `${quiz.score} pts`;
                    return `${quiz.title} • ${score}`;
                  })}
                  emptyLabel="Quizzes will appear after your lessons are published."
                />
                <PanelList
                  title="Progress"
                  items={child.progress.map((report) => {
                    const grade = report.grade ? report.grade.replace(/_/g, " ") : "Pending";
                    return `${report.programTitle} • ${grade}`;
                  })}
                  emptyLabel="Teacher reports will appear here."
                />
                <PanelList
                  title="Journal"
                  items={child.journals.map(
                    (journal) => `${journal.title} • ${journal.practiceMinutes} min`,
                  )}
                  emptyLabel="Your journal entries will appear here."
                />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                Next class
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                Weekly schedule
              </h2>
              {child.nextClass ? (
                <div className={`mt-5 rounded-[24px] bg-[#22304a] p-5 text-white ${dashboard.accessLocked ? "opacity-60" : ""}`}>
                  <p className="text-lg font-semibold">{child.nextClass.title}</p>
                  <p className="mt-2 text-sm text-white/75">
                    {weekdayLabel(child.nextClass.weekday)} • {child.nextClass.startTime}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Teacher: {child.nextClass.teacherName ?? "Assigned soon"}
                  </p>
                  {child.nextClass.meetingUrl && !dashboard.accessLocked ? (
                    <Link
                      href={child.nextClass.meetingUrl}
                      target="_blank"
                      className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
                    >
                      Open meeting link
                    </Link>
                  ) : (
                    <p className="mt-4 text-sm text-white/70">
                      Meeting links become available when your access is unlocked.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[#5f6b7a]">
                  Your class schedule will appear here once a teacher assigns the weekly slot.
                </p>
              )}
            </section>

            <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                Profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                Learner details
              </h2>
              <div className="mt-5 space-y-3 text-sm text-[#4d5a6b]">
                <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                  <strong className="text-[#22304a]">Name</strong>: {child.name}
                </div>
                <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                  <strong className="text-[#22304a]">Attendance</strong>: {child.attendanceRate}%
                </div>
                <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                  <strong className="text-[#22304a]">Dashboard state</strong>: {dashboard.accessStateLabel}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#6d7785]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#22304a]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#8a94a3]">{hint}</p>
    </div>
  );
}

function PanelList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#fcf8f2] p-4">
      <p className="text-sm font-semibold text-[#22304a]">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-[#4d5a6b]">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-[#7d8795]">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
