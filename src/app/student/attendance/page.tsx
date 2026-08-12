import { redirect } from "next/navigation";
import { AttendanceHistory } from "@/components/dashboard/family/AttendanceHistory";
import { FamilyDashboardFrame, MetricGrid, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { listStudentAttendanceByUser } from "@/lib/live-classes/attendance-reports";

export default async function StudentAttendancePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));
  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");
  const history = await listStudentAttendanceByUser(session.user.id);
  const attended = history.filter((item) => item.status === "PRESENT" || item.status === "LATE").length;
  const minutes = history.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  return <FamilyDashboardFrame roleLabel="Student Dashboard" title="Attendance" subtitle="Review every class and your verified Zoom participation time." navItems={getStudentNavItems()} pendingReason={dashboard.pendingReason}><MetricGrid metrics={[{ label: "Sessions", value: String(history.length), hint: "Recorded classes." }, { label: "Attended", value: String(attended), hint: "Present or late." }, { label: "Class time", value: `${minutes} min`, hint: "Verified Zoom time." }, { label: "Attendance", value: `${dashboard.child.attendanceRate}%`, hint: "Current attendance rate." }]} /><SectionCard eyebrow="Session history" title="My recent attendance"><AttendanceHistory records={history} /></SectionCard></FamilyDashboardFrame>;
}
