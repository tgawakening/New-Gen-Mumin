import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
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
      subtitle="Run a fair Kahoot-style quiz where every correct answer inside the answer window earns full points for the student's house."
      navItems={getTeacherNavItems()}
    >
      <meta httpEquiv="refresh" content="8" />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

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
          <div className="rounded-[22px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Status</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{live.session.status}</p>
          </div>
          <div className="rounded-[22px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Window</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{live.settings.responseWindowSeconds}s</p>
          </div>
          <div className="rounded-[22px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Current responses</p>
            <p className="mt-2 text-2xl font-semibold text-[#22304a]">{currentResponses.length}</p>
          </div>
          <div className="rounded-[22px] bg-[#fbf6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Started</p>
            <p className="mt-2 text-lg font-semibold text-[#22304a]">{formatTime(live.session.currentQuestionStartedAt)}</p>
          </div>
        </div>
      </TeacherSection>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <TeacherSection eyebrow="Teacher controls" title="Choose live question">
          <div className="space-y-3">
            {live.quiz.questions.map((question, index) => {
              const active = question.id === live.session.currentQuestionId;
              return (
                <form key={question.id} action={setQuestionAction} className={`rounded-[22px] border p-4 ${active ? "border-[#2f6b4b] bg-[#effaf3]" : "border-[#eadfce] bg-[#fbf6ef]"}`}>
                  <input type="hidden" name="questionId" value={question.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question {index + 1}</p>
                      <h3 className="mt-1 font-semibold text-[#22304a]">{question.prompt}</h3>
                      <p className="mt-1 text-sm text-[#617184]">{question.points} points - {question.type.replace(/_/g, " ")}</p>
                    </div>
                    <button disabled={live.session.status === "ENDED"} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                      {active ? "Restart question" : "Make live"}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-[#effaf3] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6b4b]">Correct answers</p>
                  <div className="mt-3 space-y-2">
                    {correctResponses.map((response) => <p key={response.id} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">{response.studentName} - {response.houseName} (+{response.housePointsAwarded})</p>)}
                    {!correctResponses.length ? <p className="text-sm text-[#617184]">Correct answers will appear here.</p> : null}
                  </div>
                </div>
                <div className="rounded-[24px] bg-[#fff7e6] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a5b11]">Good effort</p>
                  <div className="mt-3 space-y-2">
                    {effortResponses.map((response) => <p key={response.id} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">{response.studentName} - keep trying</p>)}
                    {!effortResponses.length ? <p className="text-sm text-[#617184]">Encouragement appears here after answers.</p> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] bg-[#22304a] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d7aa]">House leaderboard</p>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {live.leaderboard.map((house, index) => (
                    <div key={house.id} className="rounded-2xl bg-white/10 p-4">
                      <p className="text-sm font-semibold">#{index + 1} {house.name}</p>
                      <p className="mt-2 text-2xl font-semibold">{house.points}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#617184]">Select the first question when students are ready.</p>
          )}
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
