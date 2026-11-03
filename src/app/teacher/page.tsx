import { TeacherTeachingTools } from "@/components/dashboard/teacher/TeacherTeachingTools";
import { canAwardWeeklyCertificates } from "@/lib/teacher/recognition-permissions";
import { Suspense } from "react";
import { TeacherBadgeOverview } from "@/components/dashboard/teacher/TeacherBadgeOverview";

import { publishedPayslips } from "@/lib/payroll/service";
import { PayrollOverview } from "@/components/payroll/PayrollOverview";
import { payslipInitiallyOpen } from "@/lib/payroll/presentation";
import { type PayrollSnapshot } from "@/lib/payroll/calculation";

import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherHomeDashboard } from "@/components/dashboard/teacher/TeacherHomeDashboard";
import { FamilyJourneyLinks } from "@/components/dashboard/family/FamilyJourneyLinks";
import { QabilaLeaderboardOverview } from "@/components/dashboard/family/QabilaLeaderboardOverview";
import { db } from "@/lib/db";

export default async function TeacherDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const payslips = (await publishedPayslips(session.user.id, 120)).map(slip => ({id:slip.id,month:slip.month,publishedAt:slip.publishedAt!.toISOString(),snapshot:slip.publishedData as unknown as PayrollSnapshot}));
  const qabilas = await db.communityRoomSupervisor.findMany({
    where: { userId: session.user.id, room: { isActive: true, type: "PROJECT_TEAM" } },
    orderBy: { room: { title: "asc" } },
    include: { room: { include: { memberships: { include: { student: true } }, messages: { where: { status: "VISIBLE" }, orderBy: { createdAt: "desc" }, take: 100 } } } },
  });

  return (
    <TeacherDashboardFrame
      title={dashboard.teacherName}
      subtitle="Run live classes, follow student rosters, review assessments, and prepare course delivery from one teaching workspace."
      navItems={getTeacherNavItems()}
    >
      <FamilyJourneyLinks role="teacher" />
      {payslips.length > 0 && <PayrollOverview userId={session.user.id} slips={payslips} initiallyOpen={payslipInitiallyOpen(payslips[0].publishedAt,null)}/>}
      <TeacherTeachingTools canAwardCertificates={canAwardWeeklyCertificates(session.user)} />
      <TeacherBadgeOverview canAwardCertificates={canAwardWeeklyCertificates(session.user)} />
      <TeacherHomeDashboard dashboard={dashboard} leaderboard={<Suspense fallback={<p className="text-sm text-slate-500">Loading community overview...</p>}><QabilaLeaderboardOverview audience="teacher" /></Suspense>} qabilas={qabilas.map(({ room }) => ({ id: room.id, title: room.title, members: room.memberships.map((member) => ({ id: member.student.id, name: member.student.displayName || "Learner", role: member.role, active: room.messages.some((message) => message.authorUserId === member.student.userId) })), recentActivity: room.messages.length }))} />
    </TeacherDashboardFrame>
  );
}
