import { db } from "@/lib/db";
import { AttendanceMonthlyReport } from "@/components/dashboard/family/AttendanceMonthlyReport";
import { attendanceTotals } from "@/lib/live-classes/attendance-summary";
import { ParentAttendanceRecovery } from "@/components/dashboard/family/ParentAttendanceRecovery";
import { getParentAttendanceRecovery } from "@/lib/live-classes/parent-attendance";
import { Suspense } from "react";
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
  const confirmedCount = history.filter((item) => item.status !== "NEEDS_CONFIRMATION").length;
  const reports = await db.adminAttendanceRecovery.findMany({ where: { studentId: child.id } });
  const attended = attendanceTotals(history, reports).present;
  const minutes = history.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  return <FamilyDashboardFrame roleLabel="Parent Dashboard" title="Attendance" subtitle="Review each child's session-by-session attendance and verified Zoom time." navItems={getParentNavItems(child.id)} pendingReason={dashboard.pendingReason}><SectionCard eyebrow="Learner" title="Choose a child"><ChildSelector learners={dashboard.children.map((item) => ({ id: item.id, name: item.name }))} selectedChildId={child.id} basePath="/parent/attendance" /></SectionCard><MetricGrid metrics={[{ label: "Sessions", value: String(history.length), hint: "Recorded classes." }, { label: "Attended", value: String(attended), hint: "Joined the class." }, { label: "Class time", value: `${minutes} min`, hint: "Verified Zoom time." }, { label: "Attendance", value: confirmedCount ? `${child.attendanceRate}%` : "Pending", hint: "Confirmed classes only." }]} /><Suspense fallback={<p role="status">Loading attendance corrections?</p>}><RecoverySection parentUserId={session.user.id} studentId={child.id} /></Suspense><AttendanceMonthlyReport records={history} reports={reports} /><SectionCard eyebrow="Session history" title={`${child.name}'s recent attendance`}><p className="mb-4 text-sm text-[#617184]">Seerah and Life Skills each count once per Pakistan calendar day. Attend either time slot; joining at any time counts as present. Connection time excludes recorded disconnect gaps.</p><AttendanceHistory records={history} /></SectionCard></FamilyDashboardFrame>;
}

async function RecoverySection({ parentUserId, studentId }: { parentUserId: string; studentId: string }) {
  let recovery;
  try {
    recovery = await getParentAttendanceRecovery(parentUserId, studentId);
  } catch (error) {
    console.error("Parent attendance recovery unavailable", error);
  }
  if (!recovery) {
    return <SectionCard eyebrow="Attendance corrections" title="Corrections temporarily unavailable"><p>Your attendance history is available below. Please try corrections again later.</p></SectionCard>;
  }
  return <ParentAttendanceRecovery key={studentId} studentId={studentId} rows={recovery.rows} audit={recovery.audit} />;
}
