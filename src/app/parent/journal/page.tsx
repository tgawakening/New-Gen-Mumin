import { redirect } from "next/navigation";

import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatSubmissionStatus,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";

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
      subtitle="See each child's weekly character growth, life skills, Arabic confidence, and leadership development in one family view."
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
              {
                label: "Leadership score",
                value: String(selectedChild.journalMonthlySummary.leadershipDevelopmentScore),
                hint: "Built from initiative, responsibility, and team contribution.",
              },
              {
                label: "Latest self-rating",
                value: selectedChild.journals[0]?.selfRating ? formatGrade(selectedChild.journals[0].selfRating) : "Pending",
                hint: "Most recent learner reflection.",
              },
            ]}
          />

          <SectionCard eyebrow="Monthly summary" title={`${selectedChild.name}'s growth summary`}>
            <div className={`grid gap-4 xl:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#4d5a6b]">
                <p><strong>Most consistent trait:</strong> {selectedChild.journalMonthlySummary.mostConsistentTrait}</p>
                <p className="mt-2"><strong>Strongest skill area:</strong> {selectedChild.journalMonthlySummary.strongestSkillArea}</p>
                <p className="mt-2"><strong>Arabic fluency trend:</strong> {selectedChild.journalMonthlySummary.arabicFluencyTrend}</p>
              </div>
              <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#4d5a6b]">
                <p><strong>Teacher summary:</strong> {selectedChild.journalMonthlySummary.teacherSummary}</p>
                <p className="mt-2"><strong>Certificates and badges:</strong> Recognition is now tied to weekly journal ratings, tasks, and attendance.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Reflection log" title={`${selectedChild.name}'s weekly journal`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.journals.map((entry) => (
                <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#22304a]">{entry.template.weekLabel}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                      {formatSubmissionStatus(entry.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Theme: {entry.template.theme} · Practice: {entry.practiceMinutes} min · Self-rating: {formatGrade(entry.selfRating)}
                  </p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                      <p><strong>Islamic trait improved:</strong> {entry.template.traitFocus}</p>
                      <p className="mt-2"><strong>Practiced:</strong> {entry.template.traitPractice}</p>
                      <p className="mt-2"><strong>Shown when:</strong> {entry.template.traitMoment}</p>
                      <p className="mt-2"><strong>Challenge:</strong> {entry.template.traitChallenge}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                      <p><strong>Life skill learned:</strong> {entry.template.lifeSkillFocus}</p>
                      <p className="mt-2"><strong>Demonstration:</strong> {entry.template.lifeSkillDemonstration}</p>
                      <p className="mt-2"><strong>Evidence:</strong> {entry.template.evidenceOption}</p>
                      <p className="mt-2"><strong>Skill rating:</strong> {entry.template.ratingSummary.skill}/5</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                      <p><strong>Arabic phrase mastered:</strong> {entry.template.arabicPhrase}</p>
                      <p className="mt-2"><strong>Usage check:</strong> {entry.template.arabicUsage}</p>
                      <p className="mt-2"><strong>Tajweed focus:</strong> {entry.template.tajweedFocus}</p>
                      <p className="mt-2"><strong>Pronunciation / fluency / confidence:</strong> {entry.template.ratingSummary.pronunciation}/5 · {entry.template.ratingSummary.fluency}/5 · {entry.template.ratingSummary.confidence}/5</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                      <p><strong>Leadership role:</strong> {entry.template.leadershipRole}</p>
                      <p className="mt-2"><strong>Leadership action:</strong> {entry.template.leadershipExample}</p>
                      <p className="mt-2"><strong>Initiative / responsibility / team:</strong> {entry.template.ratingSummary.initiative}/5 · {entry.template.ratingSummary.responsibility}/5 · {entry.template.ratingSummary.teamContribution}/5</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                    <p><strong>Strength this week:</strong> {entry.template.growthStrength}</p>
                    <p className="mt-2"><strong>Area to improve:</strong> {entry.template.growthImprove}</p>
                    <p className="mt-2"><strong>Next week focus:</strong> {entry.template.growthNextFocus}</p>
                    <p className="mt-2"><strong>Teacher encouragement:</strong> {entry.teacherFeedback ?? entry.template.encouragement}</p>
                  </div>
                </div>
              ))}
              {!selectedChild.journals.length ? (
                <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                  Weekly journal entries will appear here after reflection activities begin.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
