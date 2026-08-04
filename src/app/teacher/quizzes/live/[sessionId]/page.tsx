import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { HouseLeaderboardRow } from "@/components/community/HouseDisplay";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { LiveQuizAutoRefresh } from "@/components/quizzes/LiveQuizAutoRefresh";
import { LiveQuizCelebrationClient } from "@/components/quizzes/LiveQuizCelebrationClient";
import { LiveQuizCountdown } from "@/components/quizzes/LiveQuizCountdown";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { QUIZ_CORRECT_MESSAGE, QUIZ_INCORRECT_MESSAGE } from "@/lib/community/house-points";
import { endLiveQuizSession, getTeacherLiveQuizSession, setLiveQuizQuestion } from "@/lib/quizzes/live";
import { QuizQuestionImage } from "@/components/quizzes/QuizQuestionImage";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { quizAvatar } from "@/lib/quizzes/avatars";

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

function responseSeconds(answer: unknown) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return Number.MAX_SAFE_INTEGER;
  const seconds = Number((answer as { secondsTaken?: unknown }).secondsTaken);
  return Number.isFinite(seconds) ? seconds : Number.MAX_SAFE_INTEGER;
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
  const latestResponses = [...currentResponses].sort((left, right) => right.answeredAt.getTime() - left.answeredAt.getTime()).slice(0, 6);
  const roundElapsedSeconds = currentQuestion && live.session.currentQuestionStartedAt
    ? Math.floor((Date.now() - live.session.currentQuestionStartedAt.getTime()) / 1000)
    : 0;
  const roundClosed = Boolean(currentQuestion) && (
    roundElapsedSeconds >= live.settings.responseWindowSeconds
    || (live.roster.length > 0 && currentResponses.length >= live.roster.length)
  );
  const roundWinners = [...correctResponses]
    .sort((left, right) => responseSeconds(left.answer) - responseSeconds(right.answer))
    .slice(0, 5);

  async function setQuestionAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const questionId = String(formData.get("questionId") || "");
    await setLiveQuizQuestion({ sessionId, teacherUserId: currentSession.user.id, questionId });
    revalidatePath(`/teacher/quizzes/live/${sessionId}`);
    revalidatePath(`/student/quizzes/live/${sessionId}`);
    revalidatePath(`/parent/quizzes/live/${sessionId}`);
    revalidatePath("/student/quizzes");
    revalidatePath("/student");
    revalidatePath("/parent");
    revalidatePath("/parent/quizzes");
    redirect(`/teacher/quizzes/live/${sessionId}?notice=Question is live`);
  }

  async function endSessionAction() {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    await endLiveQuizSession({ sessionId, teacherUserId: currentSession.user.id });
    revalidatePath(`/teacher/quizzes/live/${sessionId}`);
    revalidatePath(`/student/quizzes/live/${sessionId}`);
    revalidatePath(`/parent/quizzes/live/${sessionId}`);
    revalidatePath("/student/quizzes");
    revalidatePath("/student");
    revalidatePath("/parent");
    revalidatePath("/parent/quizzes");
    redirect(`/teacher/quizzes/live/${sessionId}?notice=Live quiz ended`);
  }

  return (
    <TeacherDashboardFrame
      title="Live Quiz Host"
      subtitle="Project this screen in class. Students answer from their dashboards while houses earn points together."
      navItems={getTeacherNavItems()}
    >
      <LiveQuizAutoRefresh intervalMs={2200} enabled={live.session.status !== "ENDED"} />
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
                {live.session.currentQuestionStartedAt ? <LiveQuizCountdown key={currentQuestion.id} startedAt={live.session.currentQuestionStartedAt.toISOString()} durationSeconds={live.settings.responseWindowSeconds} dark /> : null}
                <QuizQuestionImage meta={currentQuestion.meta} className="mt-5 max-h-[420px] w-full rounded-[24px] bg-white/10 object-contain" />

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
            <div className="mt-4 space-y-2">
              {latestResponses.length ? latestResponses.map((response) => (
                <div key={response.id} className="rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-3 py-2 text-xs font-semibold text-[#22304a]">
                  <span className="mr-2 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: response.houseColor ?? "#245d85" }} />
                  {response.houseName} {response.housePointsAwarded > 0 ? `+${response.housePointsAwarded}` : "answered"} as {response.studentName} submitted
                </div>
              )) : <p className="text-xs text-[#617184]">Live team updates appear here as students answer.</p>}
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {live.roster.slice(0, 16).map((student) => (
                <div key={student.id} className={`rounded-2xl border p-2 text-center ${answeredStudentIds.has(student.id) ? "border-[#2f6b4b] bg-[#effaf3]" : "border-[#eadfce] bg-[#fbf6ef]"}`}>
                  <img src={quizAvatar(student.avatarId, student.gender).image} alt="Student avatar" className="mx-auto h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
                  <p className="mt-1 truncate text-[10px] font-semibold">{quizAvatar(student.avatarId, student.gender).badge} {student.name}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {roundClosed ? (
        <section className="overflow-hidden rounded-[32px] border border-[#f2d39b] bg-gradient-to-r from-[#fff7df] via-white to-[#edf7ff] p-5 shadow-lg sm:p-7">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c27a2c]">Round complete</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#22304a]">Question champions</h2>
            <p className="mt-2 text-sm text-[#617184]">{correctResponses.length} learners answered correctly. The first five correct responses are highlighted.</p>
          </div>
          <div className="mx-auto mt-5 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-5">
            {roundWinners.map((winner, index) => {
              const avatar = quizAvatar(winner.avatarId, winner.studentGender);
              return (
                <article key={winner.id} className="relative rounded-[24px] bg-white p-3 text-center shadow-md">
                  <span className="absolute left-2 top-2 rounded-full bg-[#f7c56f] px-2 py-1 text-xs font-black text-[#22304a]">#{index + 1}</span>
                  <span className="absolute right-2 top-2 text-2xl">{avatar.badge}</span>
                  <img src={avatar.image} alt={winner.studentName} className="mx-auto h-24 w-20 rounded-[18px] object-cover object-[50%_12%]" style={{ backgroundColor: avatar.accent }} />
                  <h3 className="mt-2 truncate text-sm font-bold text-[#22304a]">{winner.studentName}</h3>
                  <p className="text-xs text-[#2f6b4b]">Correct in {responseSeconds(winner.answer)}s</p>
                </article>
              );
            })}
          </div>
          {!roundWinners.length ? <p className="mt-4 text-center text-sm font-semibold text-[#617184]">No correct answers this round. Encourage everyone and make the next question live.</p> : null}
        </section>
      ) : null}
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
                    <img src={quizAvatar(response.avatarId, response.studentGender).image} alt="Student avatar" className="h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
                    <span><span className="mr-2 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: response.houseColor ?? "#245d85" }} />{response.studentName} {response.earnedPoints} quiz pts</span>
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
                    <img src={quizAvatar(response.avatarId, response.studentGender).image} alt="Student avatar" className="h-10 w-10 rounded-xl object-cover object-[50%_12%]" />
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
              <HouseLeaderboardRow key={house.id} rank={index + 1} name={house.name} color={house.color} virtue={house.virtue} points={house.points} dark={index !== 0} />
            ))}
          </div>
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
