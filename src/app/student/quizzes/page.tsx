import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import {
  QUIZ_CORRECT_MESSAGE,
  QUIZ_INCORRECT_MESSAGE,
  QUIZ_PARTICIPATION_MESSAGE,
  awardHousePointsForQuizAttempt,
  ensureStudentHouseMembership,
  getHouseLeaderboard,
} from "@/lib/community/house-points";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ submitted?: string; result?: string }>;
};

export default async function StudentQuizzesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const params = searchParams ? await searchParams : {};
  const totalAttempts = child.quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0);
  const [houseMembership, houseLeaderboard] = await Promise.all([
    ensureStudentHouseMembership(child.id),
    getHouseLeaderboard(),
  ]);
  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      enrollments: {
        include: {
          program: {
            include: {
              quizzes: {
                where: { isPublished: true },
                include: {
                  questions: { orderBy: { sortOrder: "asc" } },
                  attempts: {
                    where: { studentId: child.id },
                    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const resultAttempt = params.result
    ? await db.quizAttempt.findFirst({
        where: { id: params.result, studentId: child.id },
        include: {
          quiz: { include: { questions: { orderBy: { sortOrder: "asc" } }, program: true } },
          answers: true,
        },
      })
    : null;
  const resultHousePoints = resultAttempt
    ? await db.housePointLedger.findFirst({ where: { sourceType: "QUIZ", sourceId: resultAttempt.id, studentId: child.id } })
    : null;

  const quizForms = student?.enrollments.flatMap((enrollment) =>
    enrollment.program.quizzes.map((quiz) => ({
      ...quiz,
      programTitle: displayProgramTitle(enrollment.program.title),
    })),
  ) ?? [];

  async function submitQuizAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");
    const currentStudent = await db.studentProfile.findUnique({ where: { userId: currentSession.user.id } });
    if (!currentStudent) redirect("/auth/login");

    const quizId = String(formData.get("quizId") || "");
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { sortOrder: "asc" } }, program: true },
    });
    if (!quiz || !quiz.isPublished) throw new Error("Quiz is not available.");

    const enrollment = await db.enrollment.findUnique({
      where: { studentId_programId: { studentId: currentStudent.id, programId: quiz.programId } },
    });
    if (!enrollment) throw new Error("You are not enrolled in this quiz program.");

    const attemptCount = await db.quizAttempt.count({ where: { quizId, studentId: currentStudent.id } });
    let autoScore = 0;
    let hasManual = false;
    let correctCount = 0;
    let objectiveQuestionCount = 0;
    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        studentId: currentStudent.id,
        attemptNumber: attemptCount + 1,
        submittedAt: new Date(),
      },
    });

    for (const question of quiz.questions) {
      const answer = String(formData.get(`answer-${question.id}`) || "").trim();
      const answerKey = question.answerKey as { answer?: string } | null;
      const correctAnswer = answerKey?.answer?.trim().toLowerCase();
      const isObjective = ["MCQ", "TRUE_FALSE", "FILL_IN_BLANK"].includes(question.type);
      const isCorrect = Boolean(isObjective && correctAnswer && answer.toLowerCase() === correctAnswer);
      if (isObjective) objectiveQuestionCount += 1;
      if (isObjective && isCorrect) {
        autoScore += question.points;
        correctCount += 1;
      }
      if (!isObjective) hasManual = true;

      await db.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          answer: { value: answer },
          isCorrect: isObjective ? isCorrect : null,
          earnedPoints: isObjective ? (isCorrect ? question.points : 0) : null,
        },
      });
    }

    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: { autoScore, manualScore: hasManual ? null : autoScore },
    });

    await awardHousePointsForQuizAttempt({
      attemptId: attempt.id,
      studentId: currentStudent.id,
      quizTitle: quiz.title,
      objectiveScore: autoScore,
      correctCount,
      totalObjectiveQuestions: objectiveQuestionCount,
    });

    const teachers = await db.teacherProgram.findMany({
      where: { programId: quiz.programId },
      include: { teacher: { include: { user: true } } },
    });
    if (teachers.length) {
      await db.notification.createMany({
        data: teachers.map(({ teacher }) => ({
          userId: teacher.user.id,
          title: "Quiz submitted",
          body: `${currentStudent.displayName ?? currentSession.user.firstName} submitted ${quiz.title}.`,
          href: "/teacher/quizzes",
        })),
      });
    }

    revalidatePath("/student/quizzes");
    revalidatePath("/teacher/quizzes");
    redirect(`/student/quizzes?submitted=1&result=${attempt.id}`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Quizzes"
      subtitle="Review pre-lesson and post-lesson quizzes, attempt history, question totals, and scoring."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.submitted ? "Quiz submitted successfully. Your teacher has been notified." : undefined} />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Your house</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 rounded-full border border-[#d8e3ed]" style={{ backgroundColor: houseMembership.house.color ?? "#f8fafc" }} />
            <div>
              <h2 className="text-2xl font-semibold text-[#22304a]">{houseMembership.house.name}</h2>
              <p className="text-sm text-[#617184]">{houseMembership.house.virtue} team points grow when you learn and take part.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">House leaderboard</p>
          <div className="mt-3 space-y-2">
            {houseLeaderboard.map((house, index) => (
              <div key={house.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-2 text-sm">
                <span className="font-semibold text-[#22304a]">{index + 1}. {house.name}</span>
                <span className="font-semibold text-[#0f4d81]">{house.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {resultAttempt ? (
        <SectionCard eyebrow="Quiz recognition" title="Well done for taking part">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-[24px] bg-[#fbf6ef] p-5">
              <h3 className="text-xl font-semibold text-[#22304a]">{resultAttempt.quiz.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#5f6b7a]">{QUIZ_PARTICIPATION_MESSAGE}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {resultAttempt.answers.map((answer, index) => (
                  <div key={answer.id} className="rounded-2xl bg-white p-4 text-sm">
                    <p className="font-semibold text-[#22304a]">Question {index + 1}</p>
                    <p className="mt-2 text-[#5f6b7a]">{answer.isCorrect ? QUIZ_CORRECT_MESSAGE : answer.isCorrect === false ? QUIZ_INCORRECT_MESSAGE : "Your teacher will review this answer."}</p>
                    <p className="mt-2 text-xs font-semibold text-[#0f4d81]">{answer.earnedPoints ?? 0} quiz points</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] bg-[#22304a] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d7aa]">House points earned</p>
              <p className="mt-3 text-5xl font-semibold">+{resultHousePoints?.points ?? 0}</p>
              <p className="mt-3 text-sm leading-6 text-white/80">Added to {houseMembership.house.name}. Correct answers earn full points; speed does not decide the winner.</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <MetricGrid
        metrics={[
          { label: "Published quizzes", value: String(child.quizzes.length), hint: "Pre-lesson and post-lesson assessments." },
          { label: "Attempts", value: String(totalAttempts), hint: "Total quiz attempt history." },
          { label: "Best score", value: child.quizzes.find((quiz) => quiz.bestScore !== null)?.bestScore?.toString() ?? "Pending", hint: "Highest recorded objective/manual score." },
          { label: "House", value: houseMembership.house.name.replace(" House", ""), hint: "Quiz points support your house team." },
        ]}
      />

      <SectionCard eyebrow="Assessment system" title="Quiz activity">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {quizForms.map((quiz) => {
            const latestAttempt = quiz.attempts[0] ?? null;
            return (
            <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {quiz.programTitle} - {quiz.type.replace(/_/g, " ")} - {quiz.questions.length} questions
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {quiz.timeLimitSeconds ? `${Math.round(quiz.timeLimitSeconds / 60)} min` : "No timer"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Latest score: {latestAttempt?.manualScore ?? latestAttempt?.autoScore ?? "Not attempted"}
              </p>
              <details className="group mt-4 rounded-[18px] bg-white p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#22304a]">
                  <span>Start quiz</span>
                  <span className="rounded-full bg-[#22304a] px-3 py-1.5 text-xs text-white group-open:hidden">Open</span>
                  <span className="hidden rounded-full border border-[#d8e3ed] px-3 py-1.5 text-xs group-open:inline">Close</span>
                </summary>
                <div className="mt-4 rounded-2xl border border-[#eadfce] bg-[#fff9f2] p-4 text-sm leading-6 text-[#5f6b7a]">
                  Questions are shown only after you start this quiz. Answer carefully, then submit once; your teacher will be notified automatically.
                </div>
                <form action={submitQuizAction} className="mt-4 space-y-3">
                  <input type="hidden" name="quizId" value={quiz.id} />
                  {quiz.questions.map((question) => {
                    const meta = question.meta as { choices?: string[] } | null;
                    return (
                      <label key={question.id} className="grid gap-2 text-sm font-semibold text-[#22304a]">
                        {question.prompt}
                        {question.type === "MCQ" && meta?.choices?.length ? (
                          <select name={`answer-${question.id}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                            <option value="">Select answer</option>
                            {meta.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                          </select>
                        ) : question.type === "TRUE_FALSE" ? (
                          <select name={`answer-${question.id}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                            <option value="">Select answer</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <input name={`answer-${question.id}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Type your answer" />
                        )}
                      </label>
                    );
                  })}
                  <button disabled={child.accessLocked} className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit quiz</button>
                </form>
              </details>
            </div>
          )})}
          {!quizForms.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Quiz activity will appear here after your programmes publish their assessments.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
