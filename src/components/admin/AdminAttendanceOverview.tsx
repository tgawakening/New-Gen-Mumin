import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { listAttendanceForStudents } from "@/lib/live-classes/attendance-reports";
import { attendanceTotals } from "@/lib/live-classes/attendance-summary";
import { AttendanceHistory } from "@/components/dashboard/family/AttendanceHistory";
import { AttendanceMonthlyReport } from "@/components/dashboard/family/AttendanceMonthlyReport";

type Learner = { id: string; name: string; parents: string; teachers: string[] };
export async function AdminAttendanceOverview({ learners, search = "", page = "1", student }: { learners: Learner[]; search?: string; page?: string; student?: string }) {
  if ((await getCurrentSession())?.user.role !== "ADMIN") return null;
  const filtered = learners.filter(item => `${item.name} ${item.parents} ${item.teachers.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(pages, Math.max(1, Number.parseInt(page, 10) || 1));
  const visible = filtered.slice((current - 1) * 20, current * 20);
  const selected = learners.find(item => item.id === student);
  const ids = [...new Set([...visible.map(item => item.id), ...(selected ? [selected.id] : [])])];
  const [history, reports] = await Promise.all([
    listAttendanceForStudents(ids),
    db.adminAttendanceRecovery.findMany({ where: { studentId: { in: ids } }, orderBy: { updatedAt: 'desc' }, select: { studentId: true, fromDay: true, toDay: true, missedCount: true, parentName: true, updatedAt: true } }),
  ]);
  const url = (pageNumber: number, child?: string) => `/admin/attendance?${new URLSearchParams({ search, page: String(pageNumber), ...(child ? { student: child } : {}) })}#attendance-overview`;
  return <section id="attendance-overview" className="space-y-4 rounded-xl border bg-white p-5">
    <h2 className="text-2xl font-bold">Student attendance overview</h2>
    <p>Saved records using the same attendance calculation as family portals. Corrections appear here after saving. Alternative Seerah and Life Skills slots count once per day; unconfirmed sessions are excluded from the percentage.</p>
    <form action="/admin/attendance" className="flex flex-wrap gap-2"><input aria-label="Search attendance by learner, parent or teacher" name="search" defaultValue={search} placeholder="Learner, parent or teacher" className="min-w-0 flex-1 rounded border p-2"/><button className="rounded bg-slate-800 px-4 py-2 text-white">Search / refresh</button></form>
    <p className="text-sm">{filtered.length} learners. All-time totals. Open a learner for monthly and session details.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Learner / parent', 'Present', 'Absent', 'Unconfirmed', 'Attendance', 'Last admin correction', 'Details'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{visible.map(learner => {
      const ownReports = reports.filter(report => report.studentId === learner.id);
      const totals = attendanceTotals(history.get(learner.id) ?? [], ownReports);
      return <tr key={learner.id} className="border-t"><td className="p-2 font-semibold">{learner.name}<span className="block font-normal text-slate-500">{learner.parents}</span></td><td className="p-2">{totals.present}</td><td className="p-2">{totals.absent}</td><td className="p-2">{totals.pending}</td><td className="p-2">{totals.rate === null ? 'No confirmed records' : `${totals.rate}%`}</td><td className="p-2">{ownReports[0] ? ownReports[0].updatedAt.toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) + ' PKT' : 'None'}</td><td className="p-2"><Link className="underline" href={url(current, learner.id)}>View attendance</Link></td></tr>;
    })}</tbody></table></div>
    {!visible.length ? <p>No learners match your search.</p> : null}
    <nav aria-label="Attendance pages" className="flex gap-4">{current > 1 ? <Link href={url(current - 1)}>Previous</Link> : null}<span>Page {current} of {pages}</span>{current < pages ? <Link href={url(current + 1)}>Next</Link> : null}</nav>
    {selected ? <section className="space-y-4 border-t pt-4"><h3 className="text-xl font-bold">{selected.name}: saved attendance</h3><AttendanceMonthlyReport records={history.get(selected.id) ?? []} reports={reports.filter(report => report.studentId === selected.id)}/><details><summary className="cursor-pointer font-semibold">Session dates, teachers and recorded status</summary><AttendanceHistory records={history.get(selected.id) ?? []}/></details></section> : null}
  </section>;
}
