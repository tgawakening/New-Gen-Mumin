import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { processZoomAttendanceWork, seedZoomAttendanceDiscovery, zoomPresenceEnabled, zoomAttendanceBackfillDays } from "@/lib/live-classes/zoom-attendance-work";
import { ZoomPresenceReport } from "@/components/dashboard/family/ZoomPresenceReport";
export default async function Page({ searchParams }: { searchParams?: Promise<{ student?: string; month?: string; search?: string }> }) {
  const session = await getCurrentSession(); if (session?.user.role !== "ADMIN") redirect("/auth/login");
  const params = await searchParams ?? {};
  async function retry(form: FormData) {
    "use server";
    const current = await getCurrentSession(); if (current?.user.role !== "ADMIN") redirect("/auth/login");
    if (!zoomPresenceEnabled()) return;
    const id = String(form.get("workId") ?? "");
    if (id) await db.zoomAttendanceWork.updateMany({ where: { id, status: "FAILED" }, data: { status: "PENDING", attempts: 0, availableAt: new Date(), lastError: null, lockedAt: null, lockToken: null } });
    await seedZoomAttendanceDiscovery(); await processZoomAttendanceWork(2);
    revalidatePath("/admin/attendance/zoom");
  }
  if (!zoomPresenceEnabled()) return <main className="mx-auto max-w-4xl space-y-4 p-6"><Link href="/admin/attendance" className="underline">Back to attendance</Link><h1 className="text-2xl font-bold">Zoom attendance setup pending</h1><p>Apply the durable Zoom attendance migration, configure the participant webhooks and every-minute worker, then enable ZOOM_ATTENDANCE_PIPELINE_ENABLED. Existing attendance continues separately.</p></main>;
  const [queue, jobs, unmatched, students] = await Promise.all([
    db.zoomAttendanceWork.groupBy({ by: ["status"], _count: { _all: true } }),
    db.zoomAttendanceWork.findMany({ where: { status: { in: ["FAILED", "PENDING", "PROCESSING"] } }, take: 40, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, kind: true, meetingId: true, meetingUuid: true, lastError: true, attempts: true, updatedAt: true } }),
    db.zoomAttendanceInterval.findMany({ where: { studentId: null, parentId: null, joinedAt: { gte: new Date(new Date().getTime() - zoomAttendanceBackfillDays() * 86400000) } }, take: 100, orderBy: { joinedAt: "desc" }, select: { id: true, participantName: true, participantEmail: true, joinedAt: true, leftAt: true, meetingId: true } }),
    db.studentProfile.findMany({ where: params.search ? { OR: [{ displayName: { contains: params.search.slice(0, 100) } }, { user: { firstName: { contains: params.search.slice(0, 100) } } }] } : {}, take: 100, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } } }),
  ]);
  return <main className="mx-auto max-w-7xl space-y-6 p-6 text-[#22304a]"><Link href="/admin/attendance" className="underline">Back to attendance</Link><h1 className="text-3xl font-bold">Zoom attendance control room</h1><p>Unmatched names are retained as evidence, not guessed or counted as confirmed absences. Failed report jobs require attention; changing an attendance mark does not fix Zoom identity.</p><div className="flex flex-wrap gap-3">{queue.map(row => <p key={row.status} className="rounded-xl border bg-white p-4">{row.status}: <strong>{row._count._all}</strong></p>)}</div><form action={retry}><button className="rounded-full bg-[#22304a] px-5 py-3 font-bold text-white">Discover meetings and process pending evidence</button></form>
    <form className="flex gap-3"><input name="search" defaultValue={params.search} placeholder="Find learner" className="rounded-xl border p-3"/><button className="rounded-full border px-4">Search</button></form><form className="flex flex-wrap gap-3"><input type="hidden" name="search" value={params.search ?? ""}/><select name="student" defaultValue={params.student} className="rounded-xl border p-3"><option value="">Choose learner (first 100 matches)</option>{students.map(student => <option key={student.id} value={student.id}>{student.displayName || [student.user.firstName, student.user.lastName].filter(Boolean).join(" ")}</option>)}</select><button className="rounded-full border px-4">View learner report</button></form>
    {params.student && <ZoomPresenceReport user={session.user} studentId={params.student} month={params.month} basePath="/admin/attendance/zoom"/>}
    <section className="space-y-3"><h2 className="text-xl font-bold">Queue health</h2>{jobs.map(job => <article key={job.id} className="rounded-xl border bg-white p-4"><p>{job.kind} · {job.status} · Meeting {job.meetingId} · {job.attempts} failures</p><p className="mt-2 break-words text-sm text-red-800">{job.lastError}</p>{job.status === "FAILED" && <form action={retry}><input type="hidden" name="workId" value={job.id}/><button className="mt-2 rounded-full border px-4 py-2">Retry after resolving cause</button></form>}</article>)}</section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Unmatched Zoom connections (latest 100)</h2>{unmatched.map(row => <article key={row.id} className="rounded-xl border bg-white p-3 text-sm"><p>{row.participantName || "No name supplied"} · {row.participantEmail || "No email supplied"}</p><p>Meeting {row.meetingId} · {row.joinedAt.toISOString()} to {row.leftAt?.toISOString() ?? "leave pending"}</p></article>)}</section>
  </main>;
}
