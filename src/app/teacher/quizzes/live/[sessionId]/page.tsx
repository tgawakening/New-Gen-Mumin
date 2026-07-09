import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { LiveQuizCelebrationClient } from "@/components/quizzes/LiveQuizCelebrationClient";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { endLiveQuizSession, getTeacherLiveQuizSession, setLiveQuizQuestion } from "@/lib/quizzes/live";
import { getTeacherNavItems } from "@/lib/teacher/nav";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function formatTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value) : "Not started";
}

export default async function TeacherLiveQuizPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const { sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  const live = await getTeacherLiveQuizSession(sessionId, session.user.id);
  if (!live) redirect("/teacher/quizzes?error=Live quiz session not found");

  const currentQuestion = live.quiz.questions.find((question) => question.id === live.session.currentQuestionId) ?? null;
  const currentResponses = currentQuestion ? live.responses.filter((response) => response.questionId === currentQuestion.id) : [];
  const correctResponses = currentResponses.filter((response) => response.isCorrect);
  const effortResponses = currentResponses.filter((response) => response.isCorrect === false);

  async function setQuestionAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const questionId = String(formData.get("questionId") || "");
    await setLiveQuizQuestion({ sessionId, teacherUserId: currentSession.user.id, questionId });
    revalidatePath(`/teacher/quizzes/live/${sessionId}`);
    revalidatePath("/student/quizzes");
    redirect(`/teacher/quizzes/live/${sessionId}?notice=Question is live`);
  }

  async function endSessionAction() {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    await endLiveQuizSession({ sessionId, teacherUserId: currentSession.user.id });
    revalidatePath(`/teacher/quizzes/live/${sessionId}`);
    revalidatePath("/student/quizzes");
    redirect(`/teacher/quizzes/live/${sessionId}?notice=Live quiz ended`);
  }

  return (
    <TeacherDashboardFrame
      title="Live Quiz Room"
      subtitle="Run a fair Kahoot-style quiz where children earn together by house, not by fastest clicks."
      navItems={getTeacherNavItems()}
    >
      <meta httpEquiv="refresh" content="8" />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

      <section className="overflow-hidden rounded-[34px] bg-[#10223d] text-white shadow-lg">
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f7c56f]">Teacher live control</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">A quiz room built for house spirit.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
              Open one question at a time. Children see colourful answer cards, and the recognition screen celebrates correct answers, effort, and house points.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold">No speed ranking</span>
              <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold">Full points inside answer window</span>
              <LiveQuizCelebrationClient tone="ready" label="Play room sound" />
            </div>
          </div>
          <div className="flex items-end justify-center gap-3 rounded-[28px] bg-white/8 px-4 pt-4">
            <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali Gen-Mumin character" className="h-44 w-36 rounded-3xl object-cover object-[50%_12%] sm:h-56 sm:w-44" />
            <img src="/gen-mumin-chars/rania-superhero.png" alt="Rania Gen-Mumin character" className="h-44 w-36 rounded-3xl object-cover object-[50%_12%] sm:h-56 sm:w-44" />
          </div>
        </div>
      </section>

      <TeacherSection
        eyebrow="Live mode"
        title={live.quiz.title}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/quizzes" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Back</Link>
            {live.session.status !== "ENDED" ? (
              <form action={endSessionAction}>
                <button className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">End quiz</button>
              </form>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Status</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{live.session.status}</p>
          </div>
          <div className="rounded-[24px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Answer window</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{live.settings.responseWindowSeconds}s</p>
          </div>
          <div className="rounded-[24px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Responses now</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{currentResponses.length}</p>
          </div>
          <div className="rounded-[24px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question started</p>
            <p className="mt-2 text-lg font-semibold text-[#22304a]">{formatTime(live.session.currentQuestionStartedAt)}</p>
          </div>
        </div>
      </TeacherSection>

      <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <TeacherSection eyebrow="Teacher controls" title="Open the next question">
          <div className="space-y-3">
            {live.quiz.questions.map((question, index) => {
              const active = question.id === live.session.currentQuestionId;
              return (
                <form key={question.id} action={setQuestionAction} className={`rounded-[26px] border-2 p-4 transition ${active ? "border-[#2f6b4b] bg-[#effaf3] shadow-sm" : "border-[#eadfce] bg-[#fbf6ef]"}`}>
                  <input type="hidden" name="questionId" value={question.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question {index + 1}</p>
                      <h3 className="mt-1 text-base font-semibold leading-6 text-[#22304a]">{question.prompt}</h3>
                      <p className="mt-1 text-sm text-[#617184]">{question.points} points - {question.type.replace(/_/g, " ")}</p>
                    </div>
                    <button disabled={live.session.status === "ENDED"} className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
                      {active ? "Restart" : "Make live"}
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </TeacherSection>

        <TeacherSection eyebrow="Recognition screen" title={currentQuestion ? currentQuestion.prompt : "Waiting to start"}>
          {currentQuestion ? (
            <div className="space-y-5">
              <div className="rounded-[30px] bg-[#10223d] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f7c56f]">Round recognition</p>
                    <h3 className="mt-2 text-2xl font-semibold">Celebrate the room, not only the fastest.</h3>
                  </div>
                  <LiveQuizCelebrationClient tone={correctResponses.length ? "success" : "ready"} label="Play recognition sound" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] bg-[#effaf3] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6b4b]">Correct answers ??</p>
                  <div className="mt-3 space-y-2">
                    {correctResponses.map((response) => (
                      <p key={response.id} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#22304a] shadow-sm">
                        {response.studentName} - {response.houseName} (+{response.housePointsAwarded})
                      </p>
                    ))}
                    {!correctResponses.length ? <p className="text-sm text-[#617184]">Correct answers will appear here as children submit.</p> : null}
                  </div>
                </div>
                <div className="rounded-[28px] bg-[#fff7e6] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a5b11]">Good effort ??</p>
                  <div className="mt-3 space-y-2">
                    {effortResponses.map((response) => (
                      <p key={response.id} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#22304a] shadow-sm">
                        {response.studentName} - keep trying, your house is cheering you on
                      </p>
                    ))}
                    {!effortResponses.length ? <p className="text-sm text-[#617184]">Encouragement appears here after answers.</p> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] bg-[#22304a] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d7aa]">House podium</p>
                    <p className="mt-1 text-sm text-white/70">This podium is for houses and effort, not individual speed.</p>
                  </div>
                  <div className="flex -space-x-3">
                    <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali avatar" className="h-14 w-14 rounded-2xl border-2 border-white object-cover object-[50%_12%]" />
                    <img src="/gen-mumin-chars/rania-superhero.png" alt="Rania avatar" className="h-14 w-14 rounded-2xl border-2 border-white object-cover object-[50%_12%]" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {live.leaderboard.map((house, index) => (
                    <div key={house.id} className={`rounded-[24px] p-4 ${index === 0 ? "bg-[#f7c56f] text-[#22304a]" : "bg-white/10"}`}>
                      <p className="text-sm font-semibold">#{index + 1} {house.name}</p>
                      <p className="mt-1 text-xs opacity-75">{house.virtue}</p>
                      <p className="mt-3 text-3xl font-semibold">{house.points}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 rounded-[30px] bg-[#10223d] p-6 text-white md:grid-cols-[1fr_220px] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f7c56f]">Waiting screen</p>
                <h3 className="mt-3 text-3xl font-semibold">Students are waiting for the first question.</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">Choose a question from the left. Their screens refresh automatically and will show colourful answer cards.</p>
              </div>
              <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali waiting mascot" className="mx-auto h-52 w-40 rounded-[28px] object-cover object-[50%_12%]" />
            </div>
          )}
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
