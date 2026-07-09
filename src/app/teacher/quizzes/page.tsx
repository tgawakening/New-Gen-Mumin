import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getHouseLeaderboard } from "@/lib/community/house-points";
import { createLiveQuizSession } from "@/lib/quizzes/live";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, formatDate } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ reviewed?: string; created?: string; updated?: string; deleted?: string; error?: string }>;
};

export default async function TeacherQuizzesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const assignedProgramIds = dashboard.rosters.map((roster) => roster.programId);
  const houseLeaderboard = await getHouseLeaderboard();
  const quizLibrary = await db.quiz.findMany({
    where: { programId: { in: assignedProgramIds } },
    include: {
      questions: true,
      attempts: true,
      program: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const reviewAttempts = await db.quizAttempt.findMany({
    where: {
      submittedAt: { not: null },
      quiz: { programId: { in: assignedProgramIds } },
    },
    include: {
      answers: true,
      quiz: {
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
      student: {
        include: {
          user: true,
        },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  async function reviewQuizAttemptAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const attemptId = String(formData.get("attemptId") || "");
    const manualScoreValue = String(formData.get("manualScore") || "").trim();
    const feedback = String(formData.get("feedback") || "").trim();
    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { include: { user: true } },
        quiz: { include: { questions: true } },
      },
    });
    if (!attempt || !teacher.programAssignments.some((assignment) => assignment.programId === attempt.quiz.programId)) {
      throw new Error("Quiz attempt is not available for this teacher.");
    }

    const maxScore = attempt.quiz.questions.reduce((sum, question) => sum + question.points, 0);
    const parsedScore = manualScoreValue ? Number(manualScoreValue) : attempt.autoScore ?? 0;
    const manualScore = Number.isFinite(parsedScore)
      ? Math.min(Math.max(Math.round(parsedScore), 0), maxScore)
      : attempt.autoScore ?? 0;

    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        manualScore,
        feedback: feedback || null,
        teacherUserId: currentSession.user.id,
      },
    });

    await db.notification.create({
      data: {
        userId: attempt.student.user.id,
        title: "Quiz reviewed",
        body: `${attempt.quiz.title} has been reviewed. Score: ${manualScore}/${maxScore}.`,
        href: "/student/quizzes",
      },
    });

    revalidatePath("/teacher/quizzes");
    revalidatePath("/student/quizzes");
    redirect("/teacher/quizzes?reviewed=1");
  }

  async function startLiveQuizAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const quizId = String(formData.get("quizId") || "");
    const liveSession = await createLiveQuizSession({ quizId, teacherUserId: currentSession.user.id });
    revalidatePath("/teacher/quizzes");
    revalidatePath("/student/quizzes");
    redirect(`/teacher/quizzes/live/${liveSession.id}`);
  }
  async function deleteQuizAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const quizId = String(formData.get("quizId") || "");
    const quiz = await db.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || !teacher.programAssignments.some((assignment) => assignment.programId === quiz.programId)) {
      throw new Error("Quiz is not available for this teacher.");
    }

    await db.quiz.delete({ where: { id: quiz.id } });
    revalidatePath("/teacher/quizzes");
    revalidatePath("/student/quizzes");
    revalidatePath("/parent/quizzes");
    redirect("/teacher/quizzes?deleted=1");
  }

  return (
    <TeacherDashboardFrame
      title="Quizzes"
      subtitle="Manage published quizzes, review attempts, and prepare the next assessment cycle."
      navItems={getTeacherNavItems()}
    >
      <ActionToast
        message={
          params.reviewed
            ? "Quiz review saved and student notified."
            : params.created
              ? "Quiz created successfully."
              : params.updated
                ? "Quiz updated successfully."
                : params.deleted
                  ? "Quiz deleted successfully."
                  : params.error
        }
        tone={params.error ? "error" : "success"}
      />

      <TeacherSection eyebrow="House system" title="Live house leaderboard">
        <div className="grid gap-3 md:grid-cols-5">
          {houseLeaderboard.map((house, index) => (
            <div key={house.id} className="rounded-[22px] border border-[#eadfce] bg-[#fbf6ef] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="h-8 w-8 rounded-full border border-[#d8e3ed]" style={{ backgroundColor: house.color ?? "#f8fafc" }} />
                <span className="text-xs font-semibold text-[#617184]">#{index + 1}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[#22304a]">{house.name}</h3>
              <p className="mt-1 text-2xl font-semibold text-[#0f4d81]">{house.points}</p>
              <p className="text-xs text-[#617184]">{house.virtue}</p>
            </div>
          ))}
        </div>
      </TeacherSection>

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
          {quizLibrary.map((quiz) => (
            <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.program.title} - {quiz.type.replace(/_/g, " ")} - {quiz.questions.length} questions - {quiz.attempts.length} attempts
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {quiz.isPublished ? "Published" : "Draft"}
                  </span>
                  <form action={startLiveQuizAction}>
                    <input type="hidden" name="quizId" value={quiz.id} />
                    <button className="rounded-full bg-[#2f6b4b] px-3 py-1.5 text-xs font-semibold text-white">
                      Start live
                    </button>
                  </form>
                  <Link href={`/teacher/quizzes/create?editId=${quiz.id}`} className="rounded-full bg-[#22304a] px-3 py-1.5 text-xs font-semibold text-white">
                    Edit
                  </Link>
                  <form action={deleteQuizAction}>
                    <input type="hidden" name="quizId" value={quiz.id} />
                    <button className="rounded-full border border-[#d8a6a6] bg-white px-3 py-1.5 text-xs font-semibold text-[#a94444]">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Pending manual review: {quiz.attempts.filter((attempt) => attempt.submittedAt && attempt.manualScore === null).length}
              </p>
            </div>
          ))}
          {!quizLibrary.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Create the first quiz for your assigned programme.
            </p>
          ) : null}
        </div>
      </TeacherSection>

      <TeacherSection eyebrow="Review queue" title="Recent quiz attempts">
        <div className="space-y-4">
          {reviewAttempts.map((attempt) => {
            const studentName =
              attempt.student.displayName ||
              `${attempt.student.user.firstName} ${attempt.student.user.lastName}`.trim();
            const answerByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
            const maxScore = attempt.quiz.questions.reduce((sum, question) => sum + question.points, 0);

            return (
              <div key={attempt.id} className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#4d5a6b]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#22304a]">{studentName}</div>
                    <div className="mt-1">{attempt.quiz.title}</div>
                    <div className="mt-1">
                      {attempt.manualScore ?? attempt.autoScore ?? "Pending"} / {maxScore} pts - {formatDate(attempt.submittedAt)}
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {attempt.manualScore === null ? "Needs review" : "Reviewed"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {attempt.quiz.questions.map((question) => {
                    const answer = answerByQuestion.get(question.id);
                    const answerValue = answer?.answer as { value?: string } | null;

                    return (
                      <div key={question.id} className="rounded-2xl bg-white p-4">
                        <p className="font-semibold text-[#22304a]">{question.prompt}</p>
                        <p className="mt-2 text-[#5f6b7a]">Answer: {answerValue?.value || "No answer"}</p>
                        <p className="mt-1 text-xs font-semibold text-[#748094]">
                          Auto score: {answer?.earnedPoints ?? "Manual"} / {question.points}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <form action={reviewQuizAttemptAction} className="mt-4 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-[160px_1fr_auto]">
                  <input type="hidden" name="attemptId" value={attempt.id} />
                  <label className="grid gap-2 text-xs font-semibold text-[#22304a]">
                    Score
                    <input
                      name="manualScore"
                      type="number"
                      min="0"
                      max={maxScore}
                      defaultValue={attempt.manualScore ?? attempt.autoScore ?? 0}
                      className="rounded-2xl border border-[#d8e3ed] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-[#22304a]">
                    Feedback
                    <textarea
                      name="feedback"
                      rows={2}
                      defaultValue={attempt.feedback ?? ""}
                      className="rounded-2xl border border-[#d8e3ed] px-3 py-2 text-sm"
                      placeholder="Short feedback for the student"
                    />
                  </label>
                  <button className="self-end rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    Save review
                  </button>
                </form>
              </div>
            );
          })}
          {!reviewAttempts.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Student quiz attempts will appear here after they submit assessments.
            </p>
          ) : null}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
