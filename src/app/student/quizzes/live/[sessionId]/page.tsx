import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { HouseBadge, HouseLeaderboardRow } from "@/components/community/HouseDisplay";
import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { LiveQuizAutoRefresh } from "@/components/quizzes/LiveQuizAutoRefresh";
import { LiveQuizCelebrationClient } from "@/components/quizzes/LiveQuizCelebrationClient";
import { LiveQuizCountdown } from "@/components/quizzes/LiveQuizCountdown";
import { LiveQuizSubmitButton } from "@/components/quizzes/LiveQuizSubmitButton";
import { QuizQuestionImage } from "@/components/quizzes/QuizQuestionImage";
import { QuizAnimalAvatar } from "@/components/quizzes/QuizAnimalAvatar";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentLiveQuizSession, liveQuizMessage, selectStudentQuizAvatarByUserId, submitLiveQuizAnswer } from "@/lib/quizzes/live";
import { quizAnimalAvatars, quizAvatar } from "@/lib/quizzes/avatars";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ notice?: string; error?: string; choose?: string }>;
};

const choiceStyles = [
  "border-[#f97316] bg-[#fff4e8] text-[#7c2d12]",
  "border-[#2563eb] bg-[#edf4ff] text-[#1e3a8a]",
  "border-[#16a34a] bg-[#edfff4] text-[#14532d]",
  "border-[#a855f7] bg-[#f6edff] text-[#581c87]",
];
const choiceIcons = ["A", "B", "C", "D"];

function responseValue(answer: unknown) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "";
  return String((answer as { value?: unknown }).value ?? "");
}

function choicesFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const choices = (meta as { choices?: unknown }).choices;
  return Array.isArray(choices) ? choices.filter((choice): choice is string => typeof choice === "string") : [];
}

export default async function StudentLiveQuizPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const { sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  const live = await getStudentLiveQuizSession(sessionId, session.user.id);
  if (!live) redirect("/student/quizzes?error=Live quiz not available");

  async function submitAnswerAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");
    const answer = String(formData.get("answer") || "").trim();
    if (!answer) redirect(`/student/quizzes/live/${sessionId}?error=Choose or type an answer first`);
    try {
      await submitLiveQuizAnswer({ sessionId, studentUserId: currentSession.user.id, answer });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit the answer. Please try once more.";
      redirect(`/student/quizzes/live/${sessionId}?error=${encodeURIComponent(message)}`);
    }
    revalidatePath(`/student/quizzes/live/${sessionId}`);
    redirect(`/student/quizzes/live/${sessionId}?notice=Answer submitted`);
  }

  async function selectAvatarAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");
    const avatarId = String(formData.get("avatarId") || "");
    try {
      await selectStudentQuizAvatarByUserId({ studentUserId: currentSession.user.id, avatarId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not choose character.";
      redirect("/student/quizzes/live/" + sessionId + "?choose=1&error=" + encodeURIComponent(message));
    }
    revalidatePath("/student/quizzes/live/" + sessionId);
    revalidatePath("/teacher/quizzes/live/" + sessionId);
    redirect("/student/quizzes/live/" + sessionId + "?notice=Your animal avatar is ready");
  }
  const choices = live.currentQuestion ? choicesFromMeta(live.currentQuestion.meta) : [];
  const responseTone = live.currentResponse?.isCorrect ? "success" : "effort";
  const myHouseStanding = live.leaderboard.find((house) => house.name === live.houseMembership.house.name) ?? live.leaderboard[0];
  const myHouseRank = Math.max(1, live.leaderboard.findIndex((house) => house.name === live.houseMembership.house.name) + 1);
  const completedResponses = live.session.responses;
  const correctCount = completedResponses.filter((response) => response.isCorrect).length;
  const perfectQuiz = live.quiz.questions.length > 0 && correctCount === live.quiz.questions.length;

  if (query.choose === "1") {
    return (
      <FamilyDashboardFrame
        roleLabel="Student Dashboard"
        title="Choose Your Quiz Animal"
        subtitle="Pick a funny animal face before entering the live quiz. Your choice will appear on the teacher screen and leaderboard."
        navItems={getStudentNavItems()}
        pendingReason={dashboard.pendingReason}
      >
        <ActionToast message={query.error} tone="error" />
        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#fff7df] via-white to-[#eaf7ff] p-5 shadow-lg sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c27a2c]">Animal avatar parade</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#22304a] sm:text-4xl">Who will you be today?</h2>
            <p className="mt-3 text-sm leading-7 text-[#617184]">Tap one animal to choose it and enter {live.quiz.title}.</p>
          </div>
          <div className="mx-auto mt-7 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {quizAnimalAvatars().map((avatar, index) => (
              <form action={selectAvatarAction} key={avatar.id}>
                <input type="hidden" name="avatarId" value={avatar.id} />
                <button className="group flex w-full flex-col items-center rounded-[28px] border-2 border-white bg-white/85 p-4 text-center shadow-md transition hover:-translate-y-2 hover:rotate-1 hover:border-[#f5a33b] hover:shadow-xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#2563eb]">
                  <QuizAnimalAvatar avatarId={avatar.id} animated={index % 3 === 0} size="xl" className="h-28 w-28 sm:h-32 sm:w-32" />
                  <span className="mt-3 text-base font-black text-[#22304a]">{avatar.name}</span>
                  <span className="mt-1 text-xs font-semibold text-[#c27a2c]">Choose & enter</span>
                </button>
              </form>
            ))}
          </div>
          <div className="mt-7 text-center">
            <Link href="/student/quizzes" className="inline-flex rounded-full border border-[#dce4ed] bg-white px-5 py-3 text-sm font-semibold text-[#22304a]">Back to quizzes</Link>
          </div>
        </section>
      </FamilyDashboardFrame>
    );
  }

  const selectedAnimal = quizAvatar(live.student.user.avatarUrl);

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Live Quiz"
      subtitle="Every correct answer earns 1 personal house point and adds 1 live point to your team. A perfect quiz earns a 10-point bonus."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <LiveQuizAutoRefresh intervalMs={3200} enabled={live.session.status !== "ENDED"} />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-[#eadfce] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-4">
          <QuizAnimalAvatar avatarId={selectedAnimal.id} animated size="md" className="h-20 w-20" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Playing as</p>
            <h2 className="mt-1 text-xl font-semibold text-[#22304a]">{selectedAnimal.name}</h2>
          </div>
        </div>
        <Link href={`/student/quizzes/live/${sessionId}?choose=1`} className="rounded-full border border-[#dce4ed] px-4 py-2 text-sm font-semibold text-[#22304a]">Change animal</Link>
      </section>

      <section className="overflow-hidden rounded-[34px] bg-[#0b1630] text-white shadow-lg">
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f7c56f]">Gen-Mumin House Challenge</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Answer together. Win as a house.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
              Answer within {live.settings.responseWindowSeconds} seconds. Complete every question correctly to earn 10 points for your house.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <HouseBadge name={live.houseMembership.house.name} color={live.houseMembership.house.color} virtue="Your fixed team" dark />
              <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold">Trait: {live.houseMembership.house.virtue}</span>
            </div>
          </div>
          <div className="flex items-end justify-center gap-3 rounded-[28px] bg-white/8 px-4 pt-4">
            <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali Gen-Mumin character" className="h-44 w-36 rounded-3xl object-cover object-[50%_12%] sm:h-56 sm:w-44" />
            <img src="/gen-mumin-chars/rania-superhero.png" alt="Rania Gen-Mumin character" className="h-44 w-36 rounded-3xl object-cover object-[50%_12%] sm:h-56 sm:w-44" />
          </div>
        </div>
      </section>

      <SectionCard eyebrow="Live game" title={live.quiz.title}>
        {live.session.status === "ENDED" ? (
          <div className="grid gap-5 rounded-[32px] bg-[#0b1630] p-6 text-white md:grid-cols-[1fr_240px] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f7c56f]">Game complete</p>
              <h3 className="mt-3 text-3xl font-semibold">Amazing effort from every learner.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                Well done to everyone for taking part. Every effort counts. Learners who answered every question correctly have earned 10 points for their house.
              </p>
              <Link href="/student/quizzes" className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#22304a]">Back to quizzes</Link>
            </div>
            <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali Gen-Mumin character" className="mx-auto h-56 w-44 rounded-[28px] object-cover object-[50%_12%]" />
          </div>
        ) : live.currentQuestion ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <div className="rounded-[32px] bg-[#fffaf3] p-5 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Question on screen</p>
              <h3 className="mt-3 text-4xl font-semibold leading-tight text-[#22304a]">{live.currentQuestion.prompt}</h3>
              {live.session.currentQuestionStartedAt ? <LiveQuizCountdown key={live.currentQuestion.id} startedAt={live.session.currentQuestionStartedAt.toISOString()} durationSeconds={live.settings.responseWindowSeconds} serverNow={new Date().toISOString()} /> : null}
              <QuizQuestionImage meta={live.currentQuestion.meta} />
              <p className="mt-2 text-sm text-[#617184]">{live.currentQuestion.points} quiz points. Every correct answer earns +1 personal point and +1 team point. A perfect quiz adds +10 bonus points.</p>

              {live.currentResponse ? (
                <div className={`relative mt-6 overflow-hidden rounded-[32px] text-center shadow-sm ${live.currentResponse.isCorrect ? "bg-[#ecfff3]" : "bg-[#fff4df]"}`}>
                  <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center gap-2 opacity-80">
                    <span className="animate-bounce rounded-full bg-white px-3 py-1 text-xs font-bold text-[#22304a]">Great effort</span>
                    <span className="animate-pulse rounded-full bg-[#f7c56f] px-3 py-1 text-xs font-bold text-[#22304a]">House points</span>
                  </div>
                  <div className="grid gap-4 p-5 pt-16 sm:p-6 sm:pt-16 md:grid-cols-[1fr_180px] md:items-center md:text-left">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
                        {live.currentResponse.isCorrect ? "Correct answer" : "Good effort"}
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold text-[#22304a]">
                        {live.currentResponse.isCorrect ? "Brilliant. Your correct answer is recorded." : "Submitted. Keep going."}
                      </h3>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-[#617184]">{liveQuizMessage(live.currentResponse)}</p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                        <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#2f6b4b] shadow-sm">{live.currentResponse.isCorrect ? "+1 personal house point" : "+0 house points"}</span>
                        <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#245d85] shadow-sm">{live.currentResponse.isCorrect ? `+1 for ${live.houseMembership.house.name}` : "Keep trying for your team"}</span>
                        <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#22304a] shadow-sm">Waiting for teacher</span>
                        <LiveQuizCelebrationClient tone={responseTone} label={live.currentResponse.isCorrect ? "Play celebration" : "Play encouragement"} />
                      </div>
                    </div>
                    <img src={live.currentResponse.isCorrect ? "/gen-mumin-chars/ali-superhero.png" : "/gen-mumin-chars/rania-superhero.png"} alt="Gen-Mumin quiz mascot" className="mx-auto h-48 w-36 rounded-[28px] object-cover object-[50%_12%]" />
                  </div>
                  <div className="border-t border-white/70 bg-white/55 px-5 py-4 text-sm font-semibold text-[#22304a]">
                    Keep this page open. The next question will appear automatically.
                  </div>
                </div>
              ) : (
                <form action={submitAnswerAction} className="mt-6 space-y-5">
                  {live.currentQuestion.type === "MCQ" && choices.length ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {choices.map((choice, index) => (
                        <label key={choice} className={`flex min-h-[104px] cursor-pointer items-center gap-4 rounded-[28px] border-2 px-5 py-5 text-lg font-semibold shadow-sm transition hover:-translate-y-1 hover:shadow-md ${choiceStyles[index % choiceStyles.length]}`}>
                          <input type="radio" name="answer" value={choice} required className="h-5 w-5 accent-[#22304a]" />
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl font-bold" aria-hidden="true">{choiceIcons[index % choiceIcons.length]}</span>
                          <span>{choice}</span>
                        </label>
                      ))}
                    </div>
                  ) : live.currentQuestion.type === "TRUE_FALSE" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex min-h-[104px] cursor-pointer items-center gap-4 rounded-[28px] border-2 border-[#16a34a] bg-[#edfff4] px-5 py-5 text-xl font-semibold text-[#14532d] shadow-sm transition hover:-translate-y-1"><input type="radio" name="answer" value="true" required className="h-5 w-5 accent-[#22304a]" /><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl font-bold">T</span>True</label>
                      <label className="flex min-h-[104px] cursor-pointer items-center gap-4 rounded-[28px] border-2 border-[#f97316] bg-[#fff4e8] px-5 py-5 text-xl font-semibold text-[#7c2d12] shadow-sm transition hover:-translate-y-1"><input type="radio" name="answer" value="false" required className="h-5 w-5 accent-[#22304a]" /><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl font-bold">F</span>False</label>
                    </div>
                  ) : (
                    <input name="answer" required className="w-full rounded-[28px] border-2 border-[#d8e3ed] bg-white px-5 py-5 text-lg font-semibold text-[#22304a]" placeholder="Type your answer" />
                  )}
                  <LiveQuizSubmitButton disabled={dashboard.child.accessLocked} />
                </form>
              )}
            </div>

            <div className="rounded-[32px] bg-[#22304a] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f3d7aa]">House leaderboard</p>
              <div className="mt-4 rounded-[24px] bg-white/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black text-white" style={{ backgroundColor: live.houseMembership.house.color }}>
                    {live.houseMembership.house.name.replace(" House", "").slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f7c56f]">Your team</p>
                    <p className="text-lg font-semibold">{live.houseMembership.house.name}</p>
                    <p className="text-xs text-white/65">Rank #{myHouseRank} - {myHouseStanding?.points ?? 0} points</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {live.leaderboard.map((house, index) => (
                  <HouseLeaderboardRow key={house.id} rank={index + 1} name={house.name} color={house.color} virtue={house.virtue} points={house.points} dark />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 rounded-[32px] bg-[#10223d] p-6 text-white md:grid-cols-[1fr_280px] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f7c56f]">Waiting room</p>
              <h3 className="mt-3 text-3xl font-semibold">Waiting for your teacher to open the next question.</h3>
              <p className="mt-3 text-sm leading-7 text-white/75">Keep this page open. It refreshes automatically, and your answer cards will appear here when the teacher starts.</p>
              <div className="mt-5"><LiveQuizCelebrationClient tone="ready" label="Test quiz sound" /></div>
            </div>
            <img src="/gen-mumin-chars/rania-superhero.png" alt="Rania waiting mascot" className="mx-auto h-56 w-44 rounded-[28px] object-cover object-[50%_12%]" />
          </div>
        )}
      </SectionCard>

      {live.session.status === "ENDED" ? (
        <SectionCard eyebrow="My performance" title="Review your quiz">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Questions", live.quiz.questions.length],
              ["Correct", correctCount],
              ["Needs review", Math.max(0, live.quiz.questions.length - correctCount)],
              ["House points", correctCount + (perfectQuiz ? 10 : 0)],
            ].map(([label, value]) => <div key={String(label)} className="rounded-[22px] bg-[#f7f3ec] p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6b2f]">{label}</p><p className="mt-2 text-3xl font-bold text-[#22304a]">{value}</p></div>)}
          </div>
          {perfectQuiz ? <p className="mt-4 rounded-2xl bg-[#ecfff3] p-4 font-semibold text-[#2f6b4b]">Perfect quiz: +10 bonus house points awarded.</p> : null}
          <div className="mt-5 space-y-3">
            {live.quiz.questions.map((question, index) => {
              const response = completedResponses.find((item) => item.questionId === question.id);
              return <details key={question.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4"><summary className="cursor-pointer font-semibold text-[#22304a]">{index + 1}. {question.prompt} <span className={response?.isCorrect ? "text-[#2f6b4b]" : "text-[#b24646]"}>{response?.isCorrect ? "Correct (+1)" : "Needs review"}</span></summary><p className="mt-3 text-sm text-[#617184]">Your answer: <strong>{response ? responseValue(response.answer) : "No answer"}</strong></p></details>;
            })}
          </div>
        </SectionCard>
      ) : null}    </FamilyDashboardFrame>
  );
}
