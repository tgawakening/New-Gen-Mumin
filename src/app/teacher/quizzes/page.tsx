import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatDate } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherQuizzesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Quizzes"
      subtitle="Manage published quizzes, review attempts, and prepare the next assessment cycle."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Quiz library", value: String(dashboard.quizzes.length), hint: "Quizzes across assigned programmes." },
          { label: "To review", value: String(dashboard.metrics.quizzesToReview), hint: "Attempts awaiting manual review." },
          { label: "Attempts", value: String(dashboard.quizReviewQueue.length), hint: "Recent submitted attempts." },
          { label: "Question types", value: "5", hint: "Objective and written question support." },
        ]}
      />

      <TeacherSection
        eyebrow="Assessment library"
        title="Quiz management"
        action={
          <Link href="/teacher/quizzes/create" className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
            Create quiz
          </Link>
        }
      >
        <div className="space-y-4">
          {dashboard.quizzes.map((quiz) => (
            <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.type} • {quiz.questionCount} questions • {quiz.attempts} attempts
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {quiz.published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Pending manual review: {quiz.pendingManualReview}
              </p>
            </div>
          ))}
        </div>
      </TeacherSection>

      <TeacherSection eyebrow="Review queue" title="Recent quiz attempts">
        <div className="space-y-3">
          {dashboard.quizReviewQueue.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm text-[#4d5a6b]">
              <div className="font-semibold text-[#22304a]">{entry.studentName}</div>
              <div className="mt-1">{entry.quizTitle}</div>
              <div className="mt-1">
                {entry.score ?? "Pending"} pts • {formatDate(entry.submittedAt)}
              </div>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
