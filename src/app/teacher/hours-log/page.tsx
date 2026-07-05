import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import {
  addTeacherHoursEntry,
  deleteTeacherHoursEntry,
  formatHoursMinutes,
  getTeacherHoursLogData,
  parseHoursMonth,
  submitTeacherHours,
  updateTeacherHoursEntry,
} from "@/lib/teacher/hours-log";

type PageProps = {
  searchParams?: Promise<{ month?: string; start?: string; end?: string; notice?: string; tone?: string }>;
};

function noticeHref(filter: { month?: string; start?: string; end?: string }, message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  if (filter.month) params.set("month", filter.month);
  if (filter.start) params.set("start", filter.start);
  if (filter.end) params.set("end", filter.end);
  return `/teacher/hours-log?${params.toString()}`;
}

function filterFromForm(formData: FormData) {
  return {
    month: String(formData.get("month") || ""),
    start: String(formData.get("filterStart") || ""),
    end: String(formData.get("filterEnd") || ""),
  };
}

function HiddenFilterFields({ month, start, end }: { month: string; start: string; end: string }) {
  return (
    <>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="filterStart" value={start} />
      <input type="hidden" name="filterEnd" value={end} />
    </>
  );
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addOneDay(value: Date) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function asNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "0"));
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export default async function TeacherHoursLogPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const params = searchParams ? await searchParams : {};
  const data = await getTeacherHoursLogData(session.user.id, params);
  if (!data) redirect("/teacher-registration");

  async function addManualEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const filter = filterFromForm(formData);
    const sessionDate = parseDate(formData.get("sessionDate"));
    const title = String(formData.get("title") || "").trim();
    const durationMinutes = asNumber(formData.get("durationMinutes"));
    if (!sessionDate || !title || durationMinutes <= 0) redirect(noticeHref(filter, "Add title, date, and duration before saving.", "error"));

    try {
      await addTeacherHoursEntry({
        teacherUserId: currentSession.user.id,
        title,
        programTitle: String(formData.get("programTitle") || "").trim(),
        sessionDate,
        startTime: String(formData.get("startTime") || "").trim(),
        durationMinutes,
        mode: String(formData.get("mode") || "Outside website").trim(),
        notes: String(formData.get("notes") || "").trim(),
      });
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(noticeHref(filter, error instanceof Error ? error.message : "Unable to add hours row.", "error"));
    }
    redirect(noticeHref(filter, "Hours row added."));
  }

  async function updateEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const filter = filterFromForm(formData);
    const sessionDate = parseDate(formData.get("sessionDate"));
    const title = String(formData.get("title") || "").trim();
    const durationMinutes = asNumber(formData.get("durationMinutes"));
    if (!sessionDate || !title) redirect(noticeHref(filter, "Title and date are required.", "error"));

    try {
      await updateTeacherHoursEntry({
        teacherUserId: currentSession.user.id,
        entryId: String(formData.get("entryId") || ""),
        title,
        programTitle: String(formData.get("programTitle") || "").trim(),
        sessionDate,
        startTime: String(formData.get("startTime") || "").trim(),
        durationMinutes,
        mode: String(formData.get("mode") || "").trim(),
        notes: String(formData.get("notes") || "").trim(),
      });
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(noticeHref(filter, error instanceof Error ? error.message : "Unable to update row.", "error"));
    }
    redirect(noticeHref(filter, "Hours row updated."));
  }

  async function deleteEntry(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const filter = filterFromForm(formData);
    try {
      await deleteTeacherHoursEntry(currentSession.user.id, String(formData.get("entryId") || ""));
      revalidatePath("/teacher/hours-log");
    } catch (error) {
      redirect(noticeHref(filter, error instanceof Error ? error.message : "Unable to delete row.", "error"));
    }
    redirect(noticeHref(filter, "Manual hours row deleted."));
  }

  async function submitHoursAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const filter = filterFromForm(formData);
    const periodStart = parseDate(formData.get("periodStart"));
    const periodEndInput = parseDate(formData.get("periodEnd"));
    if (!periodStart || !periodEndInput) redirect(noticeHref(filter, "Choose period start and end dates.", "error"));

    try {
      await submitTeacherHours({
        teacherUserId: currentSession.user.id,
        periodStart,
        periodEnd: addOneDay(periodEndInput),
        note: String(formData.get("note") || "").trim(),
      });
      revalidatePath("/teacher/hours-log");
      revalidatePath("/admin/hours-log");
    } catch (error) {
      redirect(noticeHref(filter, error instanceof Error ? error.message : "Unable to submit hours.", "error"));
    }
    redirect(noticeHref(filter, "Hours submitted to admin."));
  }

  const currentFilter = {
    month: params.month || data.period.key,
    start: params.start || "",
    end: params.end || "",
  };
  const monthOptions = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    return parseHoursMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  });

  return (
    <TeacherDashboardFrame
      title="Hours Log"
      subtitle="Review website-tracked teaching hours, add outside-link classes, and submit weekly/monthly totals for payroll review."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.notice} tone={params.tone} />

      <TeacherMetricGrid
        metrics={[
          { label: "Total", value: data.totals.totalLabel, hint: data.period.label },
          { label: "Submitted", value: data.totals.submittedLabel, hint: "Locked rows sent to admin." },
          { label: "Draft", value: data.totals.draftLabel, hint: "Rows still editable." },
          { label: "Rows", value: String(data.entries.length), hint: "Tracked + manual sessions." },
        ]}
      />

      <TeacherSection eyebrow="Period" title="Choose monthly or weekly hours">
        <div className="grid gap-4 xl:grid-cols-2">
          <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbf6ef] p-4">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Monthly view
              <select name="month" defaultValue={currentFilter.month} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                {monthOptions.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
              </select>
            </label>
            <button className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">View month</button>
          </form>
          <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#fbf6ef] p-4">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              From
              <input name="start" type="date" defaultValue={data.period.startInput} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              To
              <input name="end" type="date" defaultValue={data.period.endInput} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <button className="rounded-full bg-[#2f6b4b] px-5 py-3 text-sm font-semibold text-white">View selected dates</button>
          </form>
        </div>
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#617184]">Showing: {data.period.label}</p>
      </TeacherSection>

      <TeacherSection eyebrow="Spreadsheet" title="Teaching hours rows">
        <div className="overflow-x-auto rounded-[24px] border border-[#eadfce] bg-white">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-[#fbf6ef] text-xs uppercase tracking-[0.12em] text-[#8a6326]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Length</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Edit</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-[#f0e6d8] align-top">
                  <td className="px-4 py-3">{formatDate(entry.sessionDate)}<br /><span className="text-xs text-[#6d7785]">{entry.startTime ?? "Time not set"}</span></td>
                  <td className="px-4 py-3"><span className="font-semibold text-[#22304a]">{entry.title}</span><br /><span className="text-xs text-[#6d7785]">{entry.programTitle ?? "Programme not set"}</span></td>
                  <td className="px-4 py-3">{entry.mode}<br /><span className="text-xs text-[#6d7785]">{entry.source}</span></td>
                  <td className="px-4 py-3 font-semibold text-[#22304a]">{formatHoursMinutes(entry.durationMinutes)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-semibold text-[#22304a]">{entry.status}</span></td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer rounded-full border border-[#cdd9e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f4d81]">Edit row</summary>
                      <form action={updateEntry} className="mt-3 grid min-w-[320px] gap-2 rounded-2xl bg-[#fbf6ef] p-3">
                        <HiddenFilterFields month={currentFilter.month} start={currentFilter.start} end={currentFilter.end} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input name="title" defaultValue={entry.title} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                        <input name="programTitle" defaultValue={entry.programTitle ?? ""} placeholder="Programme" className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                        <div className="grid grid-cols-3 gap-2">
                          <input name="sessionDate" type="date" defaultValue={formatDateInput(entry.sessionDate)} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                          <input name="startTime" type="time" defaultValue={entry.startTime ?? ""} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                          <input name="durationMinutes" type="number" min="0" defaultValue={entry.durationMinutes} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                        </div>
                        <input name="mode" defaultValue={entry.mode} className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                        <textarea name="notes" rows={2} defaultValue={entry.notes ?? ""} placeholder="Notes" className="rounded-xl border border-[#d8e3ed] px-3 py-2" />
                        <button className="w-fit rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white">Save</button>
                      </form>
                      {entry.source === "MANUAL" && entry.status === "DRAFT" ? (
                        <form action={deleteEntry} className="mt-2">
                          <HiddenFilterFields month={currentFilter.month} start={currentFilter.start} end={currentFilter.end} />
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-full border border-[#efb3b3] bg-white px-3 py-1.5 text-xs font-semibold text-[#b24646]">Delete manual row</button>
                        </form>
                      ) : null}
                    </details>
                  </td>
                </tr>
              ))}
              {!data.entries.length ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[#617184]">No hours rows yet for {data.period.label}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TeacherSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <TeacherSection eyebrow="Manual row" title="Add outside website class">
          <form action={addManualEntry} className="grid gap-3">
            <HiddenFilterFields month={currentFilter.month} start={currentFilter.start} end={currentFilter.end} />
            <input name="title" placeholder="Session title" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            <input name="programTitle" placeholder="Programme / student group" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            <div className="grid gap-3 md:grid-cols-3">
              <input name="sessionDate" type="date" defaultValue={formatDateInput(new Date())} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <input name="startTime" type="time" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <input name="durationMinutes" type="number" min="1" placeholder="Minutes" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </div>
            <select name="mode" defaultValue="Outside website / TGA Zoom" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
              <option>Outside website / TGA Zoom</option>
              <option>Personal Zoom</option>
              <option>Google Meet</option>
              <option>Make-up class</option>
              <option>Parent session</option>
            </select>
            <textarea name="notes" rows={3} placeholder="Notes / WhatsApp evidence / student names" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Add hours row</button>
          </form>
        </TeacherSection>

        <TeacherSection eyebrow="Submit" title="Send hours to admin">
          <form action={submitHoursAction} className="grid gap-3">
            <HiddenFilterFields month={currentFilter.month} start={currentFilter.start} end={currentFilter.end} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Start date<input name="periodStart" type="date" defaultValue={data.period.startInput} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">End date<input name="periodEnd" type="date" defaultValue={data.period.endInput} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></label>
            </div>
            <textarea name="note" rows={3} placeholder="Any note for admin/payroll" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            <button className="w-fit rounded-full bg-[#2f6b4b] px-5 py-3 text-sm font-semibold text-white">Submit selected period</button>
          </form>
          <div className="mt-5 space-y-2 text-sm text-[#617184]">
            {data.submissions.map((submission) => (
              <p key={submission.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                Submitted {formatDate(submission.submittedAt)} - {formatHoursMinutes(submission.totalMinutes)} - {submission.entryCount} rows
              </p>
            ))}
          </div>
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}