export const dynamic = "force-dynamic";

import Link from "next/link";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { getCurrentSession } from "@/lib/auth/session";
import { formatHoursMinutes, getAdminTeacherHoursLogData, parseHoursMonth } from "@/lib/teacher/hours-log";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-[#fff7eb] text-[#8a6326]",
  SUBMITTED: "bg-[#effaf3] text-[#2f6b4b]",
};

type PageProps = {
  searchParams?: Promise<{ month?: string; start?: string; end?: string; notice?: string; tone?: string }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

function monthOptions() {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    return parseHoursMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  });
}

function totalSubmittedCount(reports: Awaited<ReturnType<typeof getAdminTeacherHoursLogData>>["reports"]) {
  return reports.reduce((sum, report) => sum + report.submissions.length, 0);
}

export default async function AdminHoursLogPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  const params = searchParams ? await searchParams : {};

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Gen-Mumins Admin</p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Teacher Hours Log</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617184]">Review submitted teacher hours after logging in.</p>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  const data = await getAdminTeacherHoursLogData(params);
  const totalMinutes = data.reports.reduce((sum, report) => sum + report.totalMinutes, 0);
  const submittedMinutes = data.reports.reduce((sum, report) => sum + report.submittedMinutes, 0);
  const rowCount = data.reports.reduce((sum, report) => sum + report.entries.length, 0);

  return (
    <div className="bg-[#edf2f6] py-8">
      <div className="section-container space-y-6">
        <div className="rounded-[32px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Payroll</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Teacher Hours Log</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-[#617184]">
                Website-tracked classes and teacher-added outside sessions are grouped here for monthly or weekly payroll review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin" className="rounded-full border border-[#cbd9e8] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Admin home</Link>
              <Link href="/admin?tab=teacher-reports" className="rounded-full border border-[#cbd9e8] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Monthly reports</Link>
            </div>
          </div>
        </div>

        <ActionToast message={params.notice} tone={params.tone} />

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Total hours</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{formatHoursMinutes(totalMinutes)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Submitted</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{formatHoursMinutes(submittedMinutes)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Teacher submissions</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{totalSubmittedCount(data.reports)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Rows</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{rowCount}</p></div>
        </section>

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-2">
            <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbfdff] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Monthly view
                <select name="month" defaultValue={params.month || data.period.key} className="rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm text-[#22304a]">
                  {monthOptions().map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
                </select>
              </label>
              <button className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">View month</button>
            </form>
            <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbfdff] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                From
                <input name="start" type="date" defaultValue={data.period.startInput} className="rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm text-[#22304a]" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                To
                <input name="end" type="date" defaultValue={data.period.endInput} className="rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm text-[#22304a]" />
              </label>
              <button className="rounded-full bg-[#2f6b4b] px-5 py-3 text-sm font-semibold text-white">View selected dates</button>
            </form>
          </div>
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#617184]">Showing: {data.period.label}</p>
        </section>

        <div className="space-y-5">
          {data.reports.map((report) => (
            <section key={report.teacherId} className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Teacher</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{report.teacherName}</h2>
                  <p className="mt-1 text-sm text-[#617184]">{report.teacherEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-[#fbf6ef] px-4 py-2 font-semibold text-[#22304a]">Total {report.totalLabel}</span>
                  <span className="rounded-full bg-[#effaf3] px-4 py-2 font-semibold text-[#2f6b4b]">Submitted {report.submittedLabel}</span>
                  <span className="rounded-full bg-[#eef2f6] px-4 py-2 font-semibold text-[#556274]">{report.entries.length} rows</span>
                </div>
              </div>

              {report.submissions.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {report.submissions.map((submission) => (
                    <div key={submission.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#22304a]">
                      <p className="font-semibold">Submitted {formatDate(submission.submittedAt)} - {formatHoursMinutes(submission.totalMinutes)}</p>
                      <p className="mt-1 text-[#617184]">{formatDate(submission.periodStart)} to {formatDate(new Date(submission.periodEnd.getTime() - 86400000))} - {submission.entryCount} rows</p>
                      {submission.note ? <p className="mt-2 text-[#617184]">{submission.note}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 overflow-x-auto rounded-[22px] border border-[#e6edf4]">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-[#fbfdff] text-xs uppercase tracking-[0.14em] text-[#6f7d8f]">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Length</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-[#e6edf4] align-top">
                        <td className="px-4 py-3 text-[#22304a]">{formatDate(entry.sessionDate)}<br /><span className="text-xs text-[#617184]">{entry.startTime ?? "Time not set"}</span></td>
                        <td className="px-4 py-3"><span className="font-semibold text-[#22304a]">{entry.title}</span><br /><span className="text-xs text-[#617184]">{entry.programTitle ?? "Programme not set"}</span></td>
                        <td className="px-4 py-3 text-[#617184]">{entry.mode}<br /><span className="text-xs">{entry.source}</span></td>
                        <td className="px-4 py-3 font-semibold text-[#22304a]">{formatHoursMinutes(entry.durationMinutes)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[entry.status] ?? "bg-[#eef2f6] text-[#556274]"}`}>{entry.status}</span></td>
                        <td className="px-4 py-3 text-[#617184]">{entry.notes ?? "-"}</td>
                      </tr>
                    ))}
                    {!report.entries.length ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-[#617184]">No rows for this teacher in {data.period.label}.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
