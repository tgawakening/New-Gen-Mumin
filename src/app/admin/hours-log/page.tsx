export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteAdminHoursEntry,
  formatHoursMinutes,
  getAdminTeacherHoursLogData,
  MIN_PAYABLE_TRACKED_SESSION_MINUTES,
  parseHoursMonth,
  reassignAdminHoursEntry,
  updateAdminHoursEntry,
} from "@/lib/teacher/hours-log";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-[#fff7eb] text-[#8a6326]",
  SUBMITTED: "bg-[#effaf3] text-[#2f6b4b]",
  PUBLISHED: "bg-[#eef7ff] text-[#0f4d81]",
};

type PageProps = {
  searchParams?: Promise<{ month?: string; start?: string; end?: string; teacherId?: string; notice?: string; tone?: string }>;
};

type AdminHoursData = Awaited<ReturnType<typeof getAdminTeacherHoursLogData>>;
type AdminHoursReport = AdminHoursData["reports"][number];
type AdminHoursEntry = AdminHoursReport["entries"][number];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(text + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function adminHoursHref(formData: FormData, message: string, tone: "success" | "error" = "success") {
  return "/admin/hours-log" + queryString({
    month: String(formData.get("month") || ""),
    start: String(formData.get("filterStart") || ""),
    end: String(formData.get("filterEnd") || ""),
    teacherId: String(formData.get("teacherId") || ""),
    notice: message,
    tone,
  });
}

function monthOptions() {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    return parseHoursMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  });
}

function totalSubmittedCount(reports: AdminHoursReport[]) {
  return reports.reduce((sum, report) => sum + report.submissions.length, 0);
}

function queryString(params: Record<string, string | undefined | null>, overrides: Record<string, string | undefined | null> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value) query.set(key, value);
  }
  const built = query.toString();
  return built ? `?${built}` : "";
}

function statusLabel(entry: AdminHoursEntry) {
  if (entry.source === "TRACKED" && entry.status === "DRAFT") return "PUBLISHED";
  return entry.status;
}

function isEditedTrackedEntry(entry: AdminHoursEntry) {
  return Boolean(entry.notes?.includes("Teacher edited from original:"));
}

function sourceLabel(entry: AdminHoursEntry) {
  if (entry.source === "MANUAL") return "Manual / outside website";
  if (isEditedTrackedEntry(entry)) return "Website tracked - edited by teacher";
  return "Website tracked";
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
  const selectedTeacherId = params.teacherId || "all";
  const visibleReports = selectedTeacherId === "all" ? data.reports : data.reports.filter((report) => report.teacherId === selectedTeacherId);
  const totalMinutes = visibleReports.reduce((sum, report) => sum + report.totalMinutes, 0);
  const submittedMinutes = visibleReports.reduce((sum, report) => sum + report.submittedMinutes, 0);
  const rowCount = visibleReports.reduce((sum, report) => sum + report.entries.length, 0);
  const filterParams = { month: params.month || data.period.key, start: params.start, end: params.end };
  const selectedExportQuery = queryString(filterParams, selectedTeacherId === "all" ? {} : { teacherId: selectedTeacherId });

  async function amendEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");
    const sessionDate = parseDate(formData.get("sessionDate"));
    const durationMinutes = Math.round(Number(formData.get("durationMinutes") || 0));
    if (!sessionDate || durationMinutes <= 0) redirect(adminHoursHref(formData, "Choose a valid date and duration.", "error"));
    try {
      await updateAdminHoursEntry({
        adminUserId: currentSession.user.id,
        entryId: String(formData.get("entryId") || ""),
        sessionDate,
        startTime: String(formData.get("startTime") || ""),
        durationMinutes,
      });
      revalidatePath("/admin/hours-log");
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(adminHoursHref(formData, error instanceof Error ? error.message : "Unable to amend session.", "error"));
    }
    redirect(adminHoursHref(formData, "Session timing updated."));
  }

  async function removeEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");
    try {
      await deleteAdminHoursEntry(currentSession.user.id, String(formData.get("entryId") || ""));
      revalidatePath("/admin/hours-log");
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(adminHoursHref(formData, error instanceof Error ? error.message : "Unable to remove session.", "error"));
    }
    redirect(adminHoursHref(formData, "Session removed from hours log."));
  }

  async function reassignEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");
    try {
      await reassignAdminHoursEntry({
        adminUserId: currentSession.user.id,
        entryId: String(formData.get("entryId") || ""),
        targetTeacherId: String(formData.get("targetTeacherId") || ""),
      });
      revalidatePath("/admin/hours-log");
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(adminHoursHref(formData, error instanceof Error ? error.message : "Unable to reassign session.", "error"));
    }
    redirect(adminHoursHref(formData, "Session moved to the selected teacher."));
  }

  return (
    <div className="bg-[#edf2f6] py-8">
      <div className="section-container space-y-6">
        <div className="rounded-[32px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Payroll</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Teacher Hours Log</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-[#617184]">
                Website-tracked payable classes and teacher-added outside sessions are grouped by teacher for payroll. Website sessions under {MIN_PAYABLE_TRACKED_SESSION_MINUTES} minutes are excluded automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin" className="rounded-full border border-[#cbd9e8] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Admin home</Link>
              <Link href="/admin?tab=teacher-reports" className="rounded-full border border-[#cbd9e8] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Monthly reports</Link>
              <Link href={`/api/admin/hours-log/export${selectedExportQuery}`} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">Export current view</Link>
              <Link href={`/api/admin/hours-log/export${queryString(filterParams)}`} className="rounded-full border border-[#cbd9e8] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Export all teachers</Link>
            </div>
          </div>
        </div>

        <ActionToast message={params.notice} tone={params.tone} />

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Total hours</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{formatHoursMinutes(totalMinutes)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Submitted</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{formatHoursMinutes(submittedMinutes)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Teacher submissions</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{totalSubmittedCount(visibleReports)}</p></div>
          <div className="rounded-[24px] border border-[#dce4ed] bg-white p-5 shadow-sm"><p className="text-sm text-[#617184]">Payable rows</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{rowCount}</p></div>
        </section>

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-2">
            <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbfdff] p-4">
              <input type="hidden" name="teacherId" value={selectedTeacherId} />
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Monthly view
                <select name="month" defaultValue={params.month || data.period.key} className="rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm text-[#22304a]">
                  {monthOptions().map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
                </select>
              </label>
              <button className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">View month</button>
            </form>
            <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbfdff] p-4">
              <input type="hidden" name="teacherId" value={selectedTeacherId} />
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

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Teacher tabs</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Link href={`/admin/hours-log${queryString(filterParams, { teacherId: "all" })}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedTeacherId === "all" ? "bg-[#22304a] text-white" : "border border-[#cbd9e8] bg-white text-[#22304a]"}`}>All teachers</Link>
            {data.reports.map((report) => (
              <Link key={report.teacherId} href={`/admin/hours-log${queryString(filterParams, { teacherId: report.teacherId })}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedTeacherId === report.teacherId ? "bg-[#22304a] text-white" : "border border-[#cbd9e8] bg-white text-[#22304a]"}`}>
                {report.teacherName} ({formatHoursMinutes(report.totalMinutes)})
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          {visibleReports.map((report) => (
            <section key={report.teacherId} className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Teacher hours</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{report.teacherName}</h2>
                  <p className="mt-1 text-sm text-[#617184]">{report.teacherEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-[#fbf6ef] px-4 py-2 font-semibold text-[#22304a]">Total {report.totalLabel}</span>
                  <span className="rounded-full bg-[#effaf3] px-4 py-2 font-semibold text-[#2f6b4b]">Submitted {report.submittedLabel}</span>
                  <span className="rounded-full bg-[#eef2f6] px-4 py-2 font-semibold text-[#556274]">{report.entries.length} rows</span>
                  <Link href={`/api/admin/hours-log/export${queryString(filterParams, { teacherId: report.teacherId })}`} className="rounded-full bg-[#22304a] px-4 py-2 font-semibold text-white">Export teacher</Link>
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
                <table className="min-w-[1120px] w-full text-left text-sm">
                  <thead className="bg-[#fbfdff] text-xs uppercase tracking-[0.14em] text-[#6f7d8f]">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Length</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => {
                      const label = statusLabel(entry);
                      return (
                        <tr key={entry.id} className="border-t border-[#e6edf4] align-top">
                          <td className="px-4 py-3 text-[#22304a]">{formatDate(entry.sessionDate)}<br /><span className="text-xs text-[#617184]">{entry.startTime ?? "Time not set"}</span></td>
                          <td className="px-4 py-3"><span className="font-semibold text-[#22304a]">{entry.title}</span><br /><span className="text-xs text-[#617184]">{entry.programTitle ?? "Programme not set"}</span></td>
                          <td className="px-4 py-3 text-[#617184]">{entry.mode}<br /><span className="text-xs">{sourceLabel(entry)}</span></td>
                          <td className="px-4 py-3 font-semibold text-[#22304a]">{formatHoursMinutes(entry.durationMinutes)}</td>
                          <td className="px-4 py-3 text-[#9aa6b5]">Client fill</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[label] ?? "bg-[#eef2f6] text-[#556274]"}`}>{label}</span></td>
                          <td className="px-4 py-3 text-[#617184]">{entry.notes ?? (entry.source === "TRACKED" ? "Published auto-tracked website session." : "-")}</td>
                          <td className="px-4 py-3">
                            <details>
                              <summary className="cursor-pointer rounded-full border border-[#cbd9e8] px-3 py-1.5 text-xs font-semibold text-[#0f4d81]">Edit / remove</summary>
                              <form action={amendEntry} className="mt-2 grid min-w-[260px] gap-2 rounded-2xl bg-[#fbf6ef] p-3">
                                <input type="hidden" name="entryId" value={entry.id} />
                                <input type="hidden" name="month" value={filterParams.month ?? ""} />
                                <input type="hidden" name="filterStart" value={filterParams.start ?? ""} />
                                <input type="hidden" name="filterEnd" value={filterParams.end ?? ""} />
                                <input type="hidden" name="teacherId" value={selectedTeacherId} />
                                <input name="sessionDate" type="date" defaultValue={formatDateInput(entry.sessionDate)} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                                <input name="startTime" type="time" defaultValue={entry.startTime ?? ""} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                                <input name="durationMinutes" type="number" min="1" defaultValue={entry.durationMinutes} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                                <button className="rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white">Save timing</button>
                              </form>
                              <form action={removeEntry} className="mt-2">
                                <input type="hidden" name="entryId" value={entry.id} />
                                <input type="hidden" name="month" value={filterParams.month ?? ""} />
                                <input type="hidden" name="filterStart" value={filterParams.start ?? ""} />
                                <input type="hidden" name="filterEnd" value={filterParams.end ?? ""} />
                                <input type="hidden" name="teacherId" value={selectedTeacherId} />
                                <button className="rounded-full border border-[#efb3b3] px-3 py-1.5 text-xs font-semibold text-[#b24646]">Remove session</button>
                              </form>
                              <form action={reassignEntry} className="mt-2 grid min-w-[260px] gap-2 rounded-2xl bg-[#eef6ff] p-3">
                                <input type="hidden" name="entryId" value={entry.id} />
                                <input type="hidden" name="month" value={filterParams.month ?? ""} />
                                <input type="hidden" name="filterStart" value={filterParams.start ?? ""} />
                                <input type="hidden" name="filterEnd" value={filterParams.end ?? ""} />
                                <input type="hidden" name="teacherId" value={selectedTeacherId} />
                                <select name="targetTeacherId" required defaultValue="" className="rounded-xl border border-[#cbd9e8] bg-white px-3 py-2 text-xs text-[#22304a]">
                                  <option value="" disabled>Move to teacher...</option>
                                  {data.reports.filter((teacher) => teacher.teacherId !== report.teacherId).map((teacher) => (
                                    <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.teacherName}</option>
                                  ))}
                                </select>
                                <button className="rounded-full bg-[#0f4d81] px-4 py-2 text-xs font-semibold text-white">Move session</button>
                              </form>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                    {!report.entries.length ? (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-[#617184]">No payable rows for this teacher in {data.period.label}.</td></tr>
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
