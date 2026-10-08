import { hasScheduleEnded } from "@/lib/live-classes/schedule-lifecycle";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cleanLiveClassTitle, getLiveClassAccessState } from "@/lib/live-classes/service";
import { sharedJoinStudents } from "@/lib/live-classes/shared-join";
import { SharedClassJoinForm } from "@/components/dashboard/family/SharedClassJoinForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Join your class | Gen-Mumin", robots: { index: false, follow: false } };
export default async function SharedJoinPage({ params, searchParams }: { params: Promise<{ scheduleId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { scheduleId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(scheduleId)) notFound();
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login?next=" + encodeURIComponent("/join/" + scheduleId));
  const schedule = await db.classSchedule.findUnique({ where: { id: scheduleId }, select: { title: true, endsOn: true, programId: true, teacher: { select: { user: { select: { firstName: true, lastName: true } } } } } });
  if (!schedule) notFound();
  const [students, state, query] = await Promise.all([sharedJoinStudents(scheduleId, schedule.programId, session.user), getLiveClassAccessState(scheduleId), searchParams]);
  return <main className="min-h-[75vh] bg-[#f7f4eb] px-4 py-10"><section className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#c27a2c]">Gen-Mumin family portal</p>
    <h1 className="text-2xl font-semibold text-[#22304a]">Join your class</h1>
    {students.length ? <><h2 className="text-lg font-semibold">{cleanLiveClassTitle(schedule.title)}</h2><p>Teacher: {schedule.teacher.user.firstName} {schedule.teacher.user.lastName}</p>
      {query.error && <p role="alert" className="rounded-xl bg-amber-50 p-3">Your join could not be completed. Please try again. If the class has ended, return to your timetable.</p>}
      {state === "ended" && <p>{hasScheduleEnded(schedule) ? "This recurring class has been stopped. Past recordings remain in your portal." : "This class has ended. This same link can be used when the teacher starts the next session."}</p>}
      <SharedClassJoinForm scheduleId={scheduleId} students={students.map(s => ({ id: s.id, name: s.displayName || [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") }))} live={state === "live"} />
    </> : <p>No learner on this account is assigned to this class. Check that you are using the correct family account, or ask your teacher to check the roster.</p>}
    <Link href={getDashboardHome(session.user.role)} className="inline-block text-sm underline">Open my dashboard</Link>
  </section></main>;
}
