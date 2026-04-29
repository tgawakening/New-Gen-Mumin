import { redirect } from "next/navigation";

import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { genMPolicies } from "@/lib/genm/curriculum";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentPoliciesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard?.children.length) {
    if (dashboard?.pendingRegistrationId) {
      redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    }
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Parent Policies"
      subtitle="A compact guide to the routines, responsibilities, and class expectations that support your child's Gen-Mumins progress."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Learning agreement" title="What families need to keep in mind" icon="sun">
        <div className="grid gap-4 lg:grid-cols-2">
          {genMPolicies.map((policy) => (
            <div key={policy} className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#5f6b7a]">
              {policy}
            </div>
          ))}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
