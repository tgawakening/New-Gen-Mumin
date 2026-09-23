"use client";

import { useActionState, useState } from "react";
import { saveAttendanceConfirmations, type AttendanceConfirmationState } from "@/app/parent/attendance/actions";

type RecoveryRow = { key: string; day: string; title: string; teacherNames: string[]; status: string; locked: boolean; alternatives: number };
type AuditEntry = { id: string; title: string; confirmedBy: string; day: string; status: string; pointsDelta: number; createdAt: string };
const PAGE_SIZE = 20;

async function saveWithoutLeavingPage(previous: AttendanceConfirmationState, form: FormData): Promise<AttendanceConfirmationState> {
  try {
    return await saveAttendanceConfirmations(previous, form);
  } catch (error) {
    console.error("Attendance save request failed", error);
    return { message: "", error: "The save request was interrupted. Your selections are still here. Please try saving again. If this continues, refresh the page and check your attendance before retrying; points will not be duplicated." };
  }
}

export function ParentAttendanceRecovery({ studentId, rows, audit }: { studentId: string; rows: RecoveryRow[]; audit: AuditEntry[] }) {
  const [state, action, pending] = useActionState(saveWithoutLeavingPage, { message: "", error: "" });
  const [changes, setChanges] = useState<Record<string, "PRESENT" | "ABSENT">>({});
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const filtered = rows.filter((row) => !month || row.day.startsWith(month));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selections = Object.entries(changes).filter(([key, status]) => rows.some((row) => row.key === key && !row.locked && row.status !== status)).map(([key, status]) => ({ key, status }));
  return <section id="confirm-attendance" className="scroll-mt-24 rounded-[26px] border border-[#eadfce] bg-white p-5">
    <h2 className="text-xl font-semibold text-[#22304a]">Confirm past attendance</h2>
    <p className="mt-2 text-sm text-[#617184]">Review completed classes from 1 September 2026. Each newly confirmed attended class earns 5 points unless attendance points were already awarded. Same-day Seerah and Life Skills alternatives count once. Unconfirmed dates do not lower attendance.</p>
    <p className="mt-2 text-sm text-[#617184]">Confirm only classes your child attended. Changing your confirmation to Absent reverses its points. Verified attendance is protected. Joining times and minutes remain unrecorded unless Zoom captured them.</p>
    {state.message ? <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{state.message}</p> : null}
    {state.error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
    <label className="my-4 block text-sm font-semibold">Filter by month <input type="month" min="2026-09" value={month} onChange={(event) => { setMonth(event.target.value); setPage(0); }} className="ml-2 rounded-lg border p-2" /></label>
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="changes" value={JSON.stringify(selections)} />
      <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">
        {visible.map((row) => <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fbf6ef] p-4">
          <div><p className="font-semibold text-[#22304a]">{row.title}</p><p className="text-sm text-[#617184]">Teacher: {row.teacherNames?.length ? row.teacherNames.join(", ") : "Not recorded"}</p><p className="text-sm text-[#617184]">{row.day} (PKT){row.alternatives > 1 ? " · Attend either time slot" : ""}</p><p className="text-xs text-[#617184]">{row.locked ? "Verified present" : row.status === "NEEDS_CONFIRMATION" ? "Needs confirmation" : `Currently ${row.status.toLowerCase()}`}</p></div>
          {row.locked ? <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">Present · verified</span> : <label className="text-sm">Attendance <select aria-label={`Attendance for ${row.title} on ${row.day}`} value={changes[row.key] ?? (["PRESENT", "ABSENT"].includes(row.status) ? row.status : "")} onChange={(event) => { const value = event.target.value; setChanges((current) => { const next = { ...current }; if (value === "PRESENT" || value === "ABSENT") next[row.key] = value; else delete next[row.key]; return next; }); }} className="ml-2 rounded-lg border bg-white p-2"><option value="">Choose…</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select></label>}
        </div>)}
        {!visible.length ? <p className="rounded-xl bg-[#fbf6ef] p-4 text-sm">No completed class dates are available for this selection. If a date is missing, please ask the teacher to check the session record.</p> : null}
        {pageCount > 1 ? <div className="flex items-center justify-between gap-3 text-sm"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border p-2 disabled:opacity-40">Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border p-2 disabled:opacity-40">Next</button></div> : null}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />I confirm these selections reflect my child’s attendance.</label>
        <button type="submit" disabled={!selections.length || selections.length > 100} className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{pending ? "Saving…" : `Save ${selections.length} date(s)`}</button>
        {selections.length > 100 ? <p className="text-sm text-red-700">Save up to 100 dates at a time.</p> : null}
      </fieldset>
    </form>
    {audit.length ? <details className="mt-5 rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Recent parent confirmation history</summary><ul className="mt-3 space-y-2 text-sm">{audit.map((entry) => <li key={entry.id}>{entry.day} ? {entry.title}: {entry.status.toLowerCase()} ? {entry.confirmedBy} · {entry.pointsDelta > 0 ? "+" : ""}{entry.pointsDelta} points · saved {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(entry.createdAt))} PKT</li>)}</ul></details> : null}
  </section>;
}
