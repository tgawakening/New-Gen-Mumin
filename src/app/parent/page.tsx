import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

function weekdayLabel(weekday: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    weekday
  ] ?? "Class day";
}

export default async function ParentDashboardPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (session.user.role !== "PARENT") {
    redirect(getDashboardHome(session.user.role));
  }

  const dashboard = await getParentDashboardData(session.user.id);

  if (!dashboard) {
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff7ee_0%,#fffdf9_100%)]">
        <div className="section-container py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Parent Dashboard
          </p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-[#22304a]">
                Assalamu alaikum, {dashboard.parentName}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
                Switch between your children, track class access, and follow attendance,
                progress, quizzes, schedule, and payment state from one family view.
              </p>
            </div>
            <Link
              href="/registration"
              className="inline-flex items-center justify-center rounded-full bg-[#f39f5f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
            >
              Add another child
            </Link>
          </div>
        </div>
      </div>

      <div className="section-container space-y-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Children"
            value={`${dashboard.children.length}`}
            hint="Switch each child to see courses, quizzes, journal, and schedule."
          />
          <MetricCard
            label="Access state"
            value={dashboard.accessStateLabel}
            hint={
              dashboard.accessLocked
                ? "Core learning areas stay locked until payment is confirmed."
                : "Classes, schedule, quizzes, and progress are fully available."
            }
          />
          <MetricCard
            label="Latest order"
            value={dashboard.latestOrder?.orderNumber ?? "No order yet"}
            hint={
              dashboard.latestOrder
                ? `${dashboard.latestOrder.gateway} • ${dashboard.latestOrder.currency} ${dashboard.latestOrder.totalAmount}`
                : "Create or complete an enrollment to begin."
            }
          />
          <MetricCard
            label="Selected child"
            value={selectedChild?.name ?? "No child yet"}
            hint={
              selectedChild
                ? `${selectedChild.courses.length} courses • ${selectedChild.attendanceRate}% attendance`
                : "Your learners will appear here after registration."
            }
          />
        </div>

        {dashboard.pendingReason ? (
          <section className="rounded-[26px] border border-[#f0d6b4] bg-[#fff7eb] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b56d1f]">
              Enrollment status
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
              {dashboard.accessStateLabel}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#6a5b49]">
              {dashboard.pendingReason}
            </p>
          </section>
        ) : null}

        <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                Child selector
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                Select a child
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {dashboard.children.map((child) => {
                const isActive = child.id === selectedChild?.id;
                return (
                  <Link
                    key={child.id}
                    href={`/parent?child=${child.id}`}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-[#22304a] text-white"
                        : "border border-[#e1d4c2] bg-[#fff9f2] text-[#4f5d71] hover:bg-[#fbf1e5]"
                    }`}
                  >
                    {child.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {selectedChild ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                      Child overview
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold text-[#22304a]">
                      {selectedChild.name}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[#5f6b7a]">
                      {selectedChild.statusLabel}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    {selectedChild.attendanceRate}% attendance
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Courses"
                    subtitle="Active and pending programs"
                    muted={selectedChild.accessLocked}
                    items={selectedChild.courses.map((course) => `${course.title} • ${course.status}`)}
                    emptyLabel="No enrolled programs yet."
                  />
                  <InfoCard
                    title="Attendance"
                    subtitle="Present, late, absent, excused"
                    muted={false}
                    items={selectedChild.attendanceBreakdown.map(
                      (entry) => `${entry.label}: ${entry.value}`,
                    )}
                    emptyLabel="No attendance records yet."
                  />
                </div>
              </section>

              <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                      Learning flow
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                      Quizzes, progress, and journals
                    </h2>
                  </div>
                  {selectedChild.accessLocked ? (
                    <span className="rounded-full bg-[#fff7eb] px-3 py-1 text-xs font-semibold text-[#a36f2a]">
                      Unlocks after payment confirmation
                    </span>
                  ) : null}
                </div>

                <div className={`mt-6 grid gap-4 xl:grid-cols-3 ${selectedChild.accessLocked ? "opacity-55" : ""}`}>
                  <InfoCard
                    title="Quizzes"
                    subtitle="Latest attempts"
                    muted={selectedChild.accessLocked}
                    items={selectedChild.quizzes.map((quiz) => {
                      const scoreLabel =
                        quiz.score === null ? "Awaiting score" : `${quiz.score} pts`;
                      return `${quiz.title} • ${quiz.type} • ${scoreLabel}`;
                    })}
                    emptyLabel="Quizzes will appear here once classes begin."
                  />
                  <InfoCard
                    title="Progress"
                    subtitle="Recent teacher reports"
                    muted={selectedChild.accessLocked}
                    items={selectedChild.progress.map((report) => {
                      const grade = report.grade ? report.grade.replace(/_/g, " ") : "Pending";
                      const attendance =
                        report.attendancePct === null ? "Attendance pending" : `${report.attendancePct}% attendance`;
                      return `${report.programTitle} • ${grade} • ${attendance}`;
                    })}
                    emptyLabel="Progress reports will appear here."
                  />
                  <InfoCard
                    title="Journal"
                    subtitle="Recent reflections"
                    muted={selectedChild.accessLocked}
                    items={selectedChild.journals.map(
                      (journal) =>
                        `${journal.title} • ${journal.practiceMinutes} min • ${journal.selfRating ?? "Pending review"}`,
                    )}
                    emptyLabel="Journal submissions will appear here."
                  />
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                  Weekly schedule
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                  Next class
                </h2>
                {selectedChild.nextClass ? (
                  <div className={`mt-5 rounded-[24px] bg-[#22304a] p-5 text-white ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
                    <p className="text-lg font-semibold">{selectedChild.nextClass.title}</p>
                    <p className="mt-2 text-sm text-white/75">
                      {weekdayLabel(selectedChild.nextClass.weekday)} • {selectedChild.nextClass.startTime}
                    </p>
                    <p className="mt-2 text-sm text-white/75">
                      Teacher: {selectedChild.nextClass.teacherName ?? "Assigned soon"}
                    </p>
                    {selectedChild.nextClass.meetingUrl && !selectedChild.accessLocked ? (
                      <Link
                        href={selectedChild.nextClass.meetingUrl}
                        target="_blank"
                        className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
                      >
                        Open meeting link
                      </Link>
                    ) : (
                      <p className="mt-4 text-sm text-white/70">
                        Meeting links become active when the enrollment is fully unlocked.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[#5f6b7a]">
                    Schedule details will appear here once class times are assigned.
                  </p>
                )}
              </section>

              <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
                  Payments
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                  Enrollment billing
                </h2>
                {dashboard.latestOrder ? (
                  <div className="mt-5 space-y-3 text-sm text-[#4d5a6b]">
                    <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                      <strong className="text-[#22304a]">Order</strong>: {dashboard.latestOrder.orderNumber}
                    </div>
                    <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                      <strong className="text-[#22304a]">Gateway</strong>: {dashboard.latestOrder.gateway}
                    </div>
                    <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                      <strong className="text-[#22304a]">Status</strong>: {dashboard.latestOrder.status.replace(/_/g, " ")}
                    </div>
                    <div className="rounded-2xl bg-[#22304a] px-4 py-4 text-white">
                      {dashboard.latestOrder.currency} {dashboard.latestOrder.totalAmount}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[#5f6b7a]">
                    Payment details will appear here after the first enrollment checkout.
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <section className="rounded-[30px] border border-[#eadfce] bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-[#22304a]">No children linked yet</h2>
            <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">
              Complete an enrollment to see child profiles, learning progress, and course access here.
            </p>
          </section>
        )}
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

function InfoCard({
  title,
  subtitle,
  items,
  emptyLabel,
  muted,
}: {
  title: string;
  subtitle: string;
  items: string[];
  emptyLabel: string;
  muted: boolean;
}) {
  return (
    <div className="rounded-[24px] bg-[#fcf8f2] p-4">
      <p className="text-sm font-semibold text-[#22304a]">{title}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#b17f3a]">{subtitle}</p>
      <div className={`${muted ? "pointer-events-none" : ""}`}>
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
    </div>
  );
}
