import { redirect } from "next/navigation";
import { AttendanceHistory } from "@/components/dashboard/family/AttendanceHistory";
import { ChildSelector, FamilyDashboardFrame, MetricGrid, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { listParentChildAttendance } from "@/lib/live-classes/attendance-reports";

type PageProps = { searchParams?: Promise<{ child?: string }> };
export default async function ParentAttendancePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));
  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard?.children.length) redirect("/registration");
  const params = searchParams ? await searchParams : {};
  const child = dashboard.children.find((item) => item.id === params.child) ?? dashboard.children[0];
  const history = await listParentChildAttendance(session.user.id, child.id);
  const attended = history.filter((item) => item.status === "PRESENT" || item.status === "LATE").length;
  const minutes = history.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  return <FamilyDashboardFrame roleLabel="Parent Dashboard" title="Attendance" subtitle="Review each child's session-by-session attendance and verified Zoom time." navItems={getParentNavItems(child.id)} pendingReason={dashboard.pendingReason}><SectionCard eyebrow="Learner" title="Choose a child"><ChildSelector learners={dashboard.children.map((item) => ({ id: item.id, name: item.name }))} selectedChildId={child.id} basePath="/parent/attendance" /></SectionCard><MetricGrid metrics={[{ label: "Sessions", value: String(history.length), hint: "Recorded classes." }, { label: "Attended", value: String(attended), hint: "Present or late." }, { label: "Class time", value: `${minutes} min`, hint: "Verified Zoom time." }, { label: "Attendance", value: `${child.attendanceRate}%`, hint: "Current attendance rate." }]} /><SectionCard eyebrow="Session history" title={`${child.name}'s recent attendance`}><AttendanceHistory records={history} /></SectionCard></FamilyDashboardFrame>;
}
