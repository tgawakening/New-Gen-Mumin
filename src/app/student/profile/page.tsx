import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, MetricGrid, SectionCard, InfoList } from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Profile"
      subtitle="Review your learner profile, timezone, country, and study identity information."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Display name", value: child.profile.displayName, hint: "Primary learner name." },
          { label: "Timezone", value: child.profile.timezone ?? "Europe/London", hint: "Class timezone preference." },
          { label: "Country", value: child.profile.countryName ?? "Pending", hint: "Learner country details." },
          { label: "Age", value: child.profile.age?.toString() ?? "Pending", hint: "Student age profile." },
        ]}
      />

      <SectionCard eyebrow="Student identity" title="Profile details">
        <InfoList
          items={[
            `Full name • ${child.profile.firstName} ${child.profile.lastName}`.trim(),
            `Display name • ${child.profile.displayName}`,
            `Email • ${child.profile.email}`,
            `Phone • ${child.profile.phone ?? "Pending"}`,
            `Timezone • ${child.profile.timezone ?? "Europe/London"}`,
            `Country • ${child.profile.countryName ?? "Pending"}`,
            `Age • ${child.profile.age ?? "Pending"}`,
            `Current grade • ${child.profile.currentGrade ?? "Pending"}`,
          ]}
          emptyLabel="Profile information will appear here."
        />
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
