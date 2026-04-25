import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  InfoList,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentProfilePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Profile"
      subtitle="Review guardian billing/profile details and the selected learner’s profile information."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/profile"
        />
      </SectionCard>

      <MetricGrid
        metrics={[
          { label: "Parent email", value: dashboard.parentProfile.email, hint: "Primary guardian account email." },
          { label: "Phone", value: dashboard.parentProfile.phone ?? "Pending", hint: "Guardian contact number." },
          { label: "Billing country", value: dashboard.parentProfile.billingCountryName ?? "Pending", hint: "Family billing location." },
          { label: "Preferred currency", value: dashboard.parentProfile.preferredCurrency ?? "GBP", hint: "Current billing currency." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Guardian" title="Parent details">
          <InfoList
            items={[
              `Name • ${dashboard.parentName}`,
              `Email • ${dashboard.parentProfile.email}`,
              `Phone • ${dashboard.parentProfile.phone ?? "Pending"}`,
              `Billing country • ${dashboard.parentProfile.billingCountryName ?? "Pending"}`,
              `Preferred currency • ${dashboard.parentProfile.preferredCurrency ?? "GBP"}`,
            ]}
            emptyLabel="Parent profile details will appear here."
          />
        </SectionCard>

        {selectedChild ? (
          <SectionCard eyebrow="Learner" title={`${selectedChild.name}'s details`}>
            <InfoList
              items={[
                `Display name • ${selectedChild.profile.displayName}`,
                `Email • ${selectedChild.profile.email}`,
                `Phone • ${selectedChild.profile.phone ?? "Pending"}`,
                `Timezone • ${selectedChild.profile.timezone ?? "Europe/London"}`,
                `Country • ${selectedChild.profile.countryName ?? "Pending"}`,
                `Age • ${selectedChild.profile.age ?? "Pending"}`,
                `Current grade • ${selectedChild.profile.currentGrade ?? "Pending"}`,
              ]}
              emptyLabel="Child profile details will appear here."
            />
          </SectionCard>
        ) : null}
      </div>
    </FamilyDashboardFrame>
  );
}
