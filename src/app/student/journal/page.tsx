import Link from "next/link";
import { redirect } from "next/navigation";

import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatGrade,
  formatSubmissionStatus,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";

export default async function StudentJournalPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const totalPractice = child.journals.reduce((sum, entry) => sum + entry.practiceMinutes, 0);
  const latest = child.journals[0];

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Journal"
      subtitle="Track your weekly character growth, life skills, Arabic progress, and leadership moments in one place."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Entries", value: String(child.journals.length), hint: "Weekly journal submissions." },
          { label: "Practice minutes", value: String(totalPractice), hint: "Total logged practice time." },
          {
            label: "Leadership score",
            value: String(child.journalMonthlySummary.leadershipDevelopmentScore),
            hint: "Monthly score built from initiative, responsibility, and team contribution.",
          },
          {
            label: "Latest self-rating",
            value: latest?.selfRating ? formatGrade(latest.selfRating) : "Pending",
            hint: "Most recent learner reflection.",
          },
        ]}
      />

      <SectionCard
        eyebrow="Weekly action"
        title="Submit this week's journal"
        action={
          !child.accessLocked ? (
            <Link
              href="/student/journal/submit"
              className="cursor-pointer rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2537]"
            >
              Add weekly journal
            </Link>
          ) : null
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#4d5a6b]">
            Use the weekly journal to log Islamic trait growth, life-skill evidence, Arabic phrase practice, leadership action, and your next focus.
          </div>
          <div className="rounded-[24px] bg-[#fff7eb] p-5 text-sm leading-7 text-[#6a5b49]">
            Parents can see this journal too, so the same weekly reflection becomes part of the family dashboard and monthly growth summary.
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Monthly summary" title="Growth dashboard">
        <div className={`grid gap-4 xl:grid-cols-2 ${child.accessLocked ? "opacity-60" : ""}`}>
          <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#4d5a6b]">
            <p><strong>Most consistent trait:</strong> {child.journalMonthlySummary.mostConsistentTrait}</p>
            <p className="mt-2"><strong>Strongest skill area:</strong> {child.journalMonthlySummary.strongestSkillArea}</p>
            <p className="mt-2"><strong>Arabic fluency trend:</strong> {child.journalMonthlySummary.arabicFluencyTrend}</p>
          </div>
          <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#4d5a6b]">
            <p><strong>Teacher summary:</strong> {child.journalMonthlySummary.teacherSummary}</p>
            <p className="mt-2"><strong>Recognition:</strong> Badges unlock through your journal ratings, task completion, and attendance consistency.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Weekly reflections" title="Journal log">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.journals.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.template.weekLabel}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {formatSubmissionStatus(entry.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Theme: {entry.template.theme} · Practice: {entry.practiceMinutes} minutes · Self-rating: {formatGrade(entry.selfRating)}
              </p>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                  <p><strong>Islamic trait:</strong> {entry.template.traitFocus}</p>
                  <p className="mt-2"><strong>What I practiced:</strong> {entry.template.traitPractice}</p>
                  <p className="mt-2"><strong>When I showed it:</strong> {entry.template.traitMoment}</p>
                  <p className="mt-2"><strong>What was difficult:</strong> {entry.template.traitChallenge}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                  <p><strong>Life skill:</strong> {entry.template.lifeSkillFocus}</p>
                  <p className="mt-2"><strong>Demonstration:</strong> {entry.template.lifeSkillDemonstration}</p>
                  <p className="mt-2"><strong>Evidence:</strong> {entry.template.evidenceOption}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
                  <p><strong>Arabic phrase:</strong> {entry.template.arabicPhrase}</p>
                  <p className="mt-2"><strong>Usage check:</strong> {entry.template.arabicUsage}</p>
                  <p className="mt-2"><strong>Tajweed focus:</strong> {entry.template.tajweedFocus}</p>
                  <p className="mt-2"><strong>Fluency rating:</strong> {entry.template.ratingSummary.fluency}/5</p>
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
                <p className="mt-2"><strong>Encouragement:</strong> {entry.teacherFeedback ?? entry.template.encouragement}</p>
              </div>
            </div>
          ))}
          {!child.journals.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Weekly journal entries will appear here after reflection activities begin.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
