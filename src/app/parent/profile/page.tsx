import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
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
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Profile"
      subtitle="Review guardian billing details and the selected learner profile in a more compact layout."
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
          {
            label: "Parent email",
            value: dashboard.parentProfile.email,
            hint: "Primary guardian account email.",
          },
          {
            label: "Phone",
            value: dashboard.parentProfile.phone ?? "Pending",
            hint: "Guardian contact number.",
          },
          {
            label: "Billing country",
            value: dashboard.parentProfile.billingCountryName ?? "Pending",
            hint: "Family billing location.",
          },
          {
            label: "Preferred currency",
            value: dashboard.parentProfile.preferredCurrency ?? "GBP",
            hint: "Current billing currency.",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Guardian" title="Parent details">
          <CompactDetailGrid
            items={[
              { label: "Name", value: dashboard.parentName },
              { label: "Email", value: dashboard.parentProfile.email },
              { label: "Phone", value: dashboard.parentProfile.phone ?? "Pending" },
              {
                label: "Billing country",
                value: dashboard.parentProfile.billingCountryName ?? "Pending",
              },
              {
                label: "Preferred currency",
                value: dashboard.parentProfile.preferredCurrency ?? "GBP",
              },
            ]}
          />
        </SectionCard>

        {selectedChild ? (
          <SectionCard eyebrow="Learner" title={`${selectedChild.name}'s details`}>
            <CompactDetailGrid
              items={[
                { label: "Display name", value: selectedChild.profile.displayName },
                { label: "Email", value: selectedChild.profile.email },
                { label: "Phone", value: selectedChild.profile.phone ?? "Pending" },
                {
                  label: "Timezone",
                  value: selectedChild.profile.timezone ?? "Europe/London",
                },
                { label: "Country", value: selectedChild.profile.countryName ?? "Pending" },
                { label: "Age", value: String(selectedChild.profile.age ?? "Pending") },
                {
                  label: "Current grade",
                  value: selectedChild.profile.currentGrade ?? "Pending",
                },
              ]}
            />
          </SectionCard>
        ) : null}
      </div>
    </FamilyDashboardFrame>
  );
}

function CompactDetailGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-[#fbf6ef] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b7a68]">
            {item.label}
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-[#22304a]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
