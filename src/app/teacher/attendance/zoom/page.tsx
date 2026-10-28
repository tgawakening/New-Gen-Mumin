import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ZoomPresenceReport } from "@/components/dashboard/family/ZoomPresenceReport";
import { zoomPresenceEnabled } from "@/lib/live-classes/zoom-attendance-work";
export default async function Page({ searchParams }: { searchParams?: Promise<{ student?: string; month?: string }> }) {
  const session = await getCurrentSession(); if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const params = await searchParams ?? {};
  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const students = [...new Map(dashboard.rosters.flatMap(roster => roster.students).map(student => [student.id, student])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const selected = students.find(student => student.id === params.student) ?? students[0];
  return <TeacherDashboardFrame title="Zoom class-time reports" subtitle="Review programme completion, join/leave evidence and monthly connected time." navItems={getTeacherNavItems()}><Link href="/teacher/attendance" className="underline">Back to attendance</Link>{!zoomPresenceEnabled() ? <p className="rounded-2xl border bg-white p-5">The administrator is completing the Zoom attendance setup.</p> : <><form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5"><select name="student" defaultValue={selected?.id} className="rounded-xl border p-3">{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select><button className="rounded-full border px-5 py-3">View learner</button></form>{selected ? <ZoomPresenceReport user={session.user} studentId={selected.id} month={params.month} basePath="/teacher/attendance/zoom"/> : <p>No enrolled learners are assigned to your programmes.</p>}</>}</TeacherDashboardFrame>;
}
