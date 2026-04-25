import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentQuizzesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const totalAttempts = child.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0);

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Quizzes"
      subtitle="Review pre-lesson and post-lesson quizzes, attempt history, question totals, and scoring."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Published quizzes", value: String(child.quizzes.length), hint: "Pre-lesson and post-lesson assessments." },
          { label: "Attempts", value: String(totalAttempts), hint: "Total quiz attempt history." },
          { label: "Best score", value: child.quizzes.find((quiz) => quiz.bestScore !== null)?.bestScore?.toString() ?? "Pending", hint: "Highest recorded objective/manual score." },
          { label: "Question types", value: "5", hint: "MCQ, multiple select, true/false, short answer, fill-in-blank." },
        ]}
      />

      <SectionCard eyebrow="Assessment system" title="Quiz activity">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.quizzes.map((quiz) => (
            <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.type} • {quiz.questionCount} questions • {quiz.totalPoints} total points
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {quiz.timeLimitSeconds ? `${Math.round(quiz.timeLimitSeconds / 60)} min` : "No timer"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Best score: {quiz.bestScore === null ? "Pending" : `${quiz.bestScore} pts`}
              </p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                Latest submission: {formatDate(quiz.latestSubmittedAt)}
              </p>
              <div className="mt-4 space-y-2">
                {quiz.attempts.length ? (
                  quiz.attempts.map((attempt) => (
                    <div key={attempt.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      Attempt {attempt.attemptNumber} • {attempt.score === null ? "Awaiting score" : `${attempt.score} pts`} • {formatDate(attempt.submittedAt)}
                      {attempt.feedback ? <div className="mt-1 text-[#6a7380]">{attempt.feedback}</div> : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#6a7380]">
                    No attempts yet. Published quizzes will appear here after lessons go live.
                  </p>
                )}
              </div>
            </div>
          ))}
          {!child.quizzes.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Quiz activity will appear here after your programmes publish their assessments.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
