import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

export default async function ParentQuizzesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const totalAttempts = selectedChild?.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0) ?? 0;
  const bestScore = selectedChild?.quizzes.find((quiz) => quiz.bestScore !== null)?.bestScore;

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Quizzes"
      subtitle="Monitor assessments, attempt history, scoring, and quiz readiness for each child."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/quizzes"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Quizzes", value: String(selectedChild.quizzes.length), hint: "Published assessments for the learner." },
              { label: "Attempts", value: String(totalAttempts), hint: "Total attempt history recorded." },
              { label: "Best score", value: bestScore === undefined ? "Pending" : String(bestScore), hint: "Highest recorded score." },
              { label: "Question types", value: "4", hint: "MCQ, true/false, short answer, and fill-in-blank." },
            ]}
          />

          <SectionCard eyebrow="Assessment overview" title={`${selectedChild.name}'s quiz activity`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.quizzes.map((quiz) => (
                <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.type} - {quiz.questionCount} questions - {quiz.totalPoints} total points
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.latestSubmittedAt
                      ? `Latest score: ${quiz.latestScore ?? "Pending review"} pts - ${formatDate(quiz.latestSubmittedAt)}`
                      : "Published and ready. Not attempted yet."}
                  </p>
                  <div className="mt-4 space-y-2">
                    {quiz.attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                        Attempt {attempt.attemptNumber} - {attempt.score ?? "Pending review"} pts - {formatDate(attempt.submittedAt)}
                      </div>
                    ))}
                    {!quiz.attempts.length ? (
                      <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#617184]">
                        Attempts will appear here after the student submits this quiz.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {!selectedChild.quizzes.length ? (
                <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                  Published quizzes will appear here.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
