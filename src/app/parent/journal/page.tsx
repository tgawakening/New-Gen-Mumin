import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatSubmissionStatus,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentJournalPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const totalPractice = selectedChild?.journals.reduce((sum, entry) => sum + entry.practiceMinutes, 0) ?? 0;

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Journal"
      subtitle="See weekly reflections, practice time, self-rating, and teacher feedback for each child."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/journal"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Entries", value: String(selectedChild.journals.length), hint: "Weekly journal submissions." },
              { label: "Practice minutes", value: String(totalPractice), hint: "Total logged practice time." },
              { label: "Self-rating", value: selectedChild.journals[0]?.selfRating ? formatGrade(selectedChild.journals[0].selfRating) : "Pending", hint: "Latest learner reflection." },
              { label: "Teacher feedback", value: selectedChild.journals.some((entry) => entry.teacherFeedback) ? "Available" : "Pending", hint: "Teacher review visibility." },
            ]}
          />

          <SectionCard eyebrow="Reflection log" title={`${selectedChild.name}'s journal`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.journals.map((entry) => (
                <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                      {formatSubmissionStatus(entry.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#5f6b7a]">
                    Practice: {entry.practiceMinutes} min • Self-rating: {formatGrade(entry.selfRating)}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">{entry.reflection}</p>
                  {entry.teacherFeedback ? (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-[#4d5a6b]">
                      <strong>Teacher feedback:</strong> {entry.teacherFeedback}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
