import Link from "next/link";
import { publishedPayslips } from "@/lib/payroll/service";
import { PayslipCard } from "@/components/payroll/PayslipCard";
import { monthLabel, pounds, type PayrollSnapshot } from "@/lib/payroll/calculation";
import { ChevronDown } from "lucide-react";
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
  const latestPayslip = (await publishedPayslips(session.user.id, 1))[0];
  const payslipSnapshot = latestPayslip?.publishedData as unknown as PayrollSnapshot | undefined;
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
      {latestPayslip && payslipSnapshot && (
        <details className="group rounded-2xl border border-[#eadfce] bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a] sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#22304a]">{monthLabel(payslipSnapshot.month)} payslip</span>
              <span className="mt-1 block text-xs text-[#617184]"><span className="group-open:hidden">View payslip details</span><span className="hidden group-open:inline">Hide payslip details</span></span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="whitespace-nowrap text-sm font-semibold text-emerald-800">{pounds(payslipSnapshot.totals.totalPence)} paid</span>
              <ChevronDown aria-hidden="true" className="h-5 w-5 text-[#617184] transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-3 border-t border-[#eadfce] p-3 sm:p-4">
            <PayslipCard id={latestPayslip.id} snapshot={payslipSnapshot} />
            <Link href="/teacher/payroll" className="inline-block text-sm font-semibold underline">View all payslips</Link>
          </div>
        </details>
      )}
      <TeacherHomeDashboard dashboard={dashboard} leaderboard={<QabilaLeaderboardOverview audience="teacher" />} qabilas={qabilas.map(({ room }) => ({ id: room.id, title: room.title, members: room.memberships.map((member) => ({ id: member.student.id, name: member.student.displayName || "Learner", role: member.role, active: room.messages.some((message) => message.authorUserId === member.student.userId) })), recentActivity: room.messages.length }))} />
    </TeacherDashboardFrame>
  );
}
