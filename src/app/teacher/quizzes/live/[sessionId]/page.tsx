import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { LiveQuizAutoRefresh } from "@/components/quizzes/LiveQuizAutoRefresh";
import { LiveQuizCelebrationClient } from "@/components/quizzes/LiveQuizCelebrationClient";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { QUIZ_CORRECT_MESSAGE, QUIZ_INCORRECT_MESSAGE } from "@/lib/community/house-points";
import { endLiveQuizSession, getTeacherLiveQuizSession, setLiveQuizQuestion } from "@/lib/quizzes/live";
import { getTeacherNavItems } from "@/lib/teacher/nav";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

const choiceStyles = [
  "bg-[#f97316] text-white",
  "bg-[#2563eb] text-white",
  "bg-[#16a34a] text-white",
  "bg-[#a855f7] text-white",
];
const choiceLabels = ["A", "B", "C", "D"];

function choicesFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const choices = (meta as { choices?: unknown }).choices;
  return Array.isArray(choices) ? choices.filter((choice): choice is string => typeof choice === "string") : [];
}

function avatarForGender(gender?: string | null) {
  const normalized = gender?.toLowerCase() ?? "";
  return normalized.includes("female") || normalized.includes("girl") || normalized === "f"
    ? "/gen-mumin-chars/rania-superhero.png"
    : "/gen-mumin-chars/ali-superhero.png";
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
  const currentQuestionIndex = currentQuestion ? live.quiz.questions.findIndex((question) => question.id === currentQuestion.id) + 1 : 0;
  const currentResponses = currentQuestion ? live.responses.filter((response) => response.questionId === currentQuestion.id) : [];
  const correctResponses = currentResponses.filter((response) => response.isCorrect);
  const effortResponses = currentResponses.filter((response) => response.isCorrect === false);
  const answeredStudentIds = new Set(currentResponses.map((response) => response.studentId));
  const totalLearners = Math.max(live.roster.length, currentResponses.length, 1);
  const answeredPercent = Math.min(100, Math.round((currentResponses.length / totalLearners) * 100));
  const choices = currentQuestion ? choicesFromMeta(currentQuestion.meta) : [];

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
      title="Live Quiz Host"
      subtitle="Project this screen in class. Students answer from their dashboards while houses earn points together."
      navItems={getTeacherNavItems()}
    >
      <LiveQuizAutoRefresh intervalMs={2500} enabled={live.session.status !== "ENDED"} />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

      <section className="overflow-hidden rounded-[34px] bg-[#0b1630] text-white shadow-lg">
        <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1fr_320px] xl:items-stretch">
          <div className="rounded-[30px] bg-white/8 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f7c56f]">Gen-Mumin Live Quiz</p>
              <div className="flex flex-wrap gap-2">
                <LiveQuizCelebrationClient tone={correctResponses.length ? "success" : "ready"} label="Sound" />
                <Link href="/teacher/quizzes" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white">Back</Link>
                {live.session.status !== "ENDED" ? (
                  <form action={endSessionAction}>
                    <button className="rounded-full bg-[#b24646] px-4 py-2 text-sm font-semibold text-white">End quiz</button>
                  </form>
                ) : null}
              </div>
            </div>

            {currentQuestion ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#f7c56f] px-4 py-2 text-sm font-bold text-[#22304a]">Question {currentQuestionIndex}/{live.quiz.questions.length}</span>
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">{currentQuestion.points} points</span>
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">Full points within {live.settings.responseWindowSeconds}s</span>
                </div>
                <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">{currentQuestion.prompt}</h2>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {(choices.length ? choices : ["True", "False"]).map((choice, index) => (
                    <div key={`${choice}-${index}`} className={`min-h-[110px] rounded-[28px] p-5 text-2xl font-bold shadow-lg ${choiceStyles[index % choiceStyles.length]}`}>
                      <span className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">{choiceLabels[index] ?? index + 1}</span>
                      {choice}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-[1fr_240px] md:items-center">
                <div>
                  <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">Waiting for the first question.</h2>
                  <p className="mt-4 text-base leading-8 text-white/75">Choose a question below. Students will see colourful answer cards on their own screens.</p>
                </div>
                <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali mascot" className="mx-auto h-60 w-48 rounded-[30px] object-cover object-[50%_12%]" />
              </div>
            )}
          </div>

          <aside className="rounded-[30px] bg-white p-5 text-[#22304a]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Live answers</p>
            <p className="mt-3 text-5xl font-semibold">{currentResponses.length}/{totalLearners}</p>
            <p className="mt-1 text-sm text-[#617184]">students answered</p>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-[#ece3d5]">
              <div className="h-full rounded-full bg-[#2f6b4b]" style={{ width: `${answeredPercent}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {live.roster.slice(0, 16).map((student) => (
                <div key={student.id} className={`rounded-2xl border p-2 text-center ${answeredStudentIds.has(student.id) ? "border-[#2f6b4b] bg-[#effaf3]" : "border-[#eadfce] bg-[#fbf6ef]"}`}>
                  <img src={avatarForGender(student.gender)} alt="Student avatar" className="mx-auto h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
                  <p className="mt-1 truncate text-[10px] font-semibold">{student.name}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <TeacherSection eyebrow="Teacher controls" title="Choose the next question">
          <div className="space-y-3">
            {live.quiz.questions.map((question, index) => {
              const active = question.id === live.session.currentQuestionId;
              return (
                <form key={question.id} action={setQuestionAction} className={`rounded-[24px] border-2 p-4 ${active ? "border-[#2f6b4b] bg-[#effaf3]" : "border-[#eadfce] bg-[#fbf6ef]"}`}>
                  <input type="hidden" name="questionId" value={question.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question {index + 1}</p>
                      <h3 className="mt-1 font-semibold text-[#22304a]">{question.prompt}</h3>
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

        <TeacherSection eyebrow="Round results" title="Recognition and house leaderboard">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] bg-[#effaf3] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6b4b]">Correct answers</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {correctResponses.map((response) => (
                  <div key={response.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#22304a]">
                    <img src={avatarForGender(response.studentGender)} alt="Student avatar" className="h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
                    <span>{response.studentName} +{response.housePointsAwarded}</span>
                    <span className="text-xs font-normal text-[#617184]">{QUIZ_CORRECT_MESSAGE}</span>
                  </div>
                ))}
                {!correctResponses.length ? <p className="text-sm text-[#617184]">Correct submissions will appear live.</p> : null}
              </div>
            </div>
            <div className="rounded-[28px] bg-[#fff7e6] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a5b11]">Good effort</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {effortResponses.map((response) => (
                  <div key={response.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#22304a]">
                    <img src={avatarForGender(response.studentGender)} alt="Student avatar" className="h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
                    <span>{response.studentName}</span>
                    <span className="text-xs font-normal text-[#617184]">{QUIZ_INCORRECT_MESSAGE}</span>
                  </div>
                ))}
                {!effortResponses.length ? <p className="text-sm text-[#617184]">Encouragement appears after answers.</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {live.leaderboard.map((house, index) => (
              <div key={house.id} className={`rounded-[24px] p-4 ${index === 0 ? "bg-[#f7c56f] text-[#22304a]" : "bg-[#22304a] text-white"}`}>
                <p className="text-sm font-semibold">#{index + 1} {house.name}</p>
                <p className="mt-3 text-3xl font-semibold">{house.points}</p>
                <p className="mt-1 text-xs opacity-75">{house.virtue}</p>
              </div>
            ))}
          </div>
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
