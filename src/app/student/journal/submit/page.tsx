import { redirect } from "next/navigation";

import { StudentJournalSubmitForm } from "@/components/dashboard/family/StudentJournalSubmitForm";
import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";

export default async function StudentJournalSubmitPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const enrollments = child.courses.map((course) => ({
    id: course.id,
    title: course.title,
  }));

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Submit weekly journal"
      subtitle="Capture Islamic character, life skills, Arabic growth, and leadership action from this week's learning."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Weekly reflection" title="Journal submission">
        {child.accessLocked ? (
          <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#5f6b7a]">
            Journal submission will unlock once your enrollment access is fully confirmed.
          </p>
        ) : enrollments.length ? (
          <StudentJournalSubmitForm enrollments={enrollments} />
        ) : (
          <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#5f6b7a]">
            A program enrollment needs to be active before a weekly journal can be submitted.
          </p>
        )}
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
