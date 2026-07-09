import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { listStudentActiveLiveQuizzesByStudentId } from "@/lib/quizzes/live";
import {
  awardHousePointsForQuizAttempt,
  ensureStudentHouseMembership,
  getHouseLeaderboard,
} from "@/lib/community/house-points";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; submitted?: string }>;
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
  const [houseMembership, houseLeaderboard, activeLiveQuizzes] = selectedChild
    ? await Promise.all([ensureStudentHouseMembership(selectedChild.id), getHouseLeaderboard(), listStudentActiveLiveQuizzesByStudentId(selectedChild.id)])
    : [null, [], []];
  const quizForms = selectedChild
    ? await db.quiz.findMany({
        where: {
          isPublished: true,
          program: {
            enrollments: {
              some: {
                studentId: selectedChild.id,
                status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
              },
            },
          },
        },
        include: {
          program: true,
          questions: { orderBy: { sortOrder: "asc" } },
          attempts: {
            where: { studentId: selectedChild.id },
            orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  async function submitParentQuizAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "PARENT") redirect("/auth/login");
    const parent = await db.parentProfile.findUnique({ where: { userId: currentSession.user.id } });
    if (!parent) redirect("/registration");

    const childId = String(formData.get("childId") || "");
    const parentChild = await db.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: parent.id, studentId: childId } },
      include: { student: { include: { user: true } } },
    });
    if (!parentChild) throw new Error("This learner is not linked to your parent dashboard.");

    const quizId = String(formData.get("quizId") || "");
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { sortOrder: "asc" } }, program: true },
    });
    if (!quiz || !quiz.isPublished) throw new Error("Quiz is not available.");

    const enrollment = await db.enrollment.findUnique({
      where: { studentId_programId: { studentId: childId, programId: quiz.programId } },
    });
    if (!enrollment || !["ACTIVE", "CONFIRMED", "COMPLETED"].includes(enrollment.status)) {
      throw new Error("This learner is not enrolled in this quiz programme.");
    }

    const attemptCount = await db.quizAttempt.count({ where: { quizId, studentId: childId } });
    let autoScore = 0;
    let hasManual = false;
    let correctCount = 0;
    let objectiveQuestionCount = 0;
    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        studentId: childId,
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
      studentId: childId,
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
          body: `${parentChild.student.displayName ?? parentChild.student.user.firstName} submitted ${quiz.title}.`,
          href: "/teacher/quizzes",
        })),
      });
    }

    revalidatePath("/parent/quizzes");
    revalidatePath("/student/quizzes");
    revalidatePath("/teacher/quizzes");
    redirect(`/parent/quizzes?child=${childId}&submitted=1`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Quizzes"
      subtitle="Monitor assessments, attempt history, scoring, and quiz readiness for each child."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params?.submitted ? "Quiz submitted successfully. Teacher has been notified." : undefined} />

      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/quizzes"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          {houseMembership ? (
            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Learner house</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-12 w-12 rounded-full border border-[#d8e3ed]" style={{ backgroundColor: houseMembership.house.color ?? "#f8fafc" }} />
                  <div>
                    <h2 className="text-2xl font-semibold text-[#22304a]">{houseMembership.house.name}</h2>
                    <p className="text-sm text-[#617184]">Quiz points, attendance, homework, and future Sunnah tracker points can feed this house total.</p>
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
          ) : null}

          <MetricGrid
            metrics={[
              { label: "Quizzes", value: String(selectedChild.quizzes.length), hint: "Published assessments for the learner." },
              { label: "Attempts", value: String(totalAttempts), hint: "Total attempt history recorded." },
              { label: "Best score", value: bestScore === undefined ? "Pending" : String(bestScore), hint: "Highest recorded score." },
              { label: "House", value: houseMembership?.house.name.replace(" House", "") ?? "Pending", hint: "Quiz points support the learner house." },
            ]}
          />

          {activeLiveQuizzes.length ? (
            <SectionCard eyebrow="Live now" title={`Live quiz started for ${selectedChild.name}`}>
              <div className="grid gap-4 md:grid-cols-2">
                {activeLiveQuizzes.map((liveQuiz) => (
                  <div key={liveQuiz.id} className="overflow-hidden rounded-[30px] bg-[#0b1630] text-white shadow-lg">
                    <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_150px] lg:items-center">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f7c56f]">Teacher opened the game</p>
                        <h3 className="mt-3 text-2xl font-semibold">{liveQuiz.quiz?.title ?? "Live quiz"}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/75">
                          The child should open the student dashboard quiz screen to answer. Questions appear one by one during the live class.
                        </p>
                      </div>
                      <img src="/gen-mumin-chars/rania-superhero.png" alt="Gen-Mumin live quiz character" className="mx-auto h-44 w-32 rounded-[26px] object-cover object-[50%_12%]" />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard eyebrow="Assessment overview" title={`${selectedChild.name}'s quiz activity`}>
            <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
              {quizForms.map((quiz) => {
                const summary = selectedChild.quizzes.find((item) => item.id === quiz.id);
                const latestAttempt = quiz.attempts[0] ?? null;
                const latestScore = latestAttempt?.manualScore ?? latestAttempt?.autoScore ?? null;
                return (
                <div key={quiz.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {displayProgramTitle(quiz.program.title)} - {quiz.type.replace(/_/g, " ")} - {quiz.questions.length} questions - {quiz.questions.reduce((sum, question) => sum + question.points, 0)} total points
                  </p>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {latestAttempt?.submittedAt
                      ? `Latest score: ${latestScore ?? "Pending review"} pts - ${formatDate(latestAttempt.submittedAt)}`
                      : "Published and ready. Not attempted yet."}
                  </p>
                  <div className="mt-4 space-y-2">
                    {summary?.attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                        Attempt {attempt.attemptNumber} - {attempt.score ?? "Pending review"} pts - {formatDate(attempt.submittedAt)}
                      </div>
                    ))}
                    {!summary?.attempts.length ? (
                      <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#617184]">
                        Attempts will appear here after the student submits this quiz.
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-[18px] border border-[#eadfce] bg-white p-4 text-sm leading-6 text-[#5f6b7a]">
                    Questions stay hidden from the dashboard until the teacher runs the quiz live. Live quizzes appear above when the class game starts.
                  </div>
                </div>
              )})}
              {!quizForms.length ? (
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
