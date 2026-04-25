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

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const totalAttempts = selectedChild?.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0) ?? 0;

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
          children={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
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
              { label: "Best score", value: selectedChild.quizzes.find((quiz) => quiz.bestScore !== null)?.bestScore?.toString() ?? "Pending", hint: "Highest recorded score." },
              { label: "Question types", value: "5", hint: "MCQ, multiple select, true/false, short answer, fill-in-blank." },
            ]}
          />

          <SectionCard eyebrow="Assessment overview" title={`${selectedChild.name}'s quiz activity`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {selectedChild.quizzes.map((quiz) => (
                <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.type} • {quiz.questionCount} questions • {quiz.totalPoints} total points
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    Latest: {quiz.latestScore ?? "Pending"} pts • {formatDate(quiz.latestSubmittedAt)}
                  </p>
                  <div className="mt-4 space-y-2">
                    {quiz.attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                        Attempt {attempt.attemptNumber} • {attempt.score ?? "Pending"} pts • {formatDate(attempt.submittedAt)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
