import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherHomeDashboard } from "@/components/dashboard/teacher/TeacherHomeDashboard";
import { FamilyJourneyLinks } from "@/components/dashboard/family/FamilyJourneyLinks";
import { db } from "@/lib/db";
import { syncAllQabilaRoomMemberships, syncQabilaSupervisors } from "@/lib/community/rooms";

export default async function TeacherDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  await syncQabilaSupervisors();
  await syncAllQabilaRoomMemberships();
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
      <TeacherHomeDashboard dashboard={dashboard} qabilas={qabilas.map(({ room }) => ({ id: room.id, title: room.title, members: room.memberships.map((member) => ({ id: member.student.id, name: member.student.displayName || "Learner", role: member.role, active: room.messages.some((message) => message.authorUserId === member.student.userId) })), recentActivity: room.messages.length }))} />
    </TeacherDashboardFrame>
  );
}
