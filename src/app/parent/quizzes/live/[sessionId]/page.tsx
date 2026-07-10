import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { LiveQuizAutoRefresh } from "@/components/quizzes/LiveQuizAutoRefresh";
import { LiveQuizCelebrationClient } from "@/components/quizzes/LiveQuizCelebrationClient";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentLiveQuizSessionByStudentId, liveQuizMessage, submitLiveQuizAnswerByStudentId } from "@/lib/quizzes/live";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ child?: string; notice?: string; error?: string }>;
};

const choiceStyles = [
  "border-[#f97316] bg-[#fff4e8] text-[#7c2d12]",
  "border-[#2563eb] bg-[#edf4ff] text-[#1e3a8a]",
  "border-[#16a34a] bg-[#edfff4] text-[#14532d]",
  "border-[#a855f7] bg-[#f6edff] text-[#581c87]",
];
const choiceIcons = ["A", "B", "C", "D"];

function choicesFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const choices = (meta as { choices?: unknown }).choices;
  return Array.isArray(choices) ? choices.filter((choice): choice is string => typeof choice === "string") : [];
}

export default async function ParentLiveQuizPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const { sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  const selectedChild = dashboard.children.find((child) => child.id === query.child) ?? dashboard.children[0];
  if (!selectedChild) redirect("/parent/quizzes?error=Choose a learner first");
  const live = await getStudentLiveQuizSessionByStudentId(sessionId, selectedChild.id);
  if (!live) redirect(`/parent/quizzes?child=${selectedChild.id}&error=Live quiz not available`);

  async function submitAnswerAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "PARENT") redirect("/auth/login");
    const childId = String(formData.get("childId") || "");
    const parentDashboard = await getParentDashboardData(currentSession.user.id);
    const child = parentDashboard?.children.find((learner) => learner.id === childId);
    if (!child) redirect("/parent/quizzes?error=Choose a learner first");
    const answer = String(formData.get("answer") || "").trim();
    if (!answer) redirect(`/parent/quizzes/live/${sessionId}?child=${childId}&error=Choose or type an answer first`);
    await submitLiveQuizAnswerByStudentId({ sessionId, studentId: childId, answer });
    revalidatePath(`/parent/quizzes/live/${sessionId}`);
    revalidatePath(`/teacher/quizzes/live/${sessionId}`);
    revalidatePath("/teacher/quizzes");
    redirect(`/parent/quizzes/live/${sessionId}?child=${childId}&notice=Answer submitted`);
  }

  const choices = live.currentQuestion ? choicesFromMeta(live.currentQuestion.meta) : [];
  const responseTone = live.currentResponse?.isCorrect ? "success" : "effort";

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title={`Live Quiz for ${selectedChild.name}`}
      subtitle="Team quiz time. Correct answers inside the window earn full points for your house."
      navItems={getParentNavItems(selectedChild.id)}
      pendingReason={dashboard.pendingReason}
    >
      <LiveQuizAutoRefresh intervalMs={1200} enabled={live.session.status !== "ENDED"} />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

      <section className="overflow-hidden rounded-[34px] bg-[#0b1630] text-white shadow-lg">
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f7c56f]">Gen-Mumin House Challenge</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Answer together. Win as a house.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
              This is not a fastest-finger podium. Everyone who answers correctly in {live.settings.responseWindowSeconds} seconds earns full points.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold">{live.houseMembership.house.name}</span>
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
                Well done to everyone for taking part. Every effort counts, and the house points have been saved.
              </p>
              <Link href={`/parent/quizzes?child=${selectedChild.id}`} className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#22304a]">Back to quizzes</Link>
            </div>
            <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali Gen-Mumin character" className="mx-auto h-56 w-44 rounded-[28px] object-cover object-[50%_12%]" />
          </div>
        ) : live.currentQuestion ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <div className="rounded-[32px] bg-[#fffaf3] p-5 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Question on screen</p>
              <h3 className="mt-3 text-4xl font-semibold leading-tight text-[#22304a]">{live.currentQuestion.prompt}</h3>
              <p className="mt-2 text-sm text-[#617184]">{live.currentQuestion.points} quiz points + participation points for your house.</p>

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
                        {live.currentResponse.isCorrect ? "Brilliant. Your house earned points." : "Submitted. Keep going."}
                      </h3>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-[#617184]">{liveQuizMessage(live.currentResponse)}</p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                        <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#2f6b4b] shadow-sm">+{live.currentResponse.housePointsAwarded} house points</span>
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
                  <input type="hidden" name="childId" value={selectedChild.id} />
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
                  <button disabled={selectedChild.accessLocked} className="w-full rounded-[28px] bg-[#22304a] px-6 py-5 text-xl font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50">
                    Lock in answer
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-[32px] bg-[#22304a] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f3d7aa]">House leaderboard</p>
              <div className="mt-4 flex items-center gap-3 rounded-[24px] bg-white/10 p-3">
                <img src="/gen-mumin-chars/ali-superhero.png" alt="Ali avatar" className="h-14 w-14 rounded-2xl object-cover object-[50%_12%]" />
                <img src="/gen-mumin-chars/rania-superhero.png" alt="Rania avatar" className="h-14 w-14 rounded-2xl object-cover object-[50%_12%]" />
                <p className="text-sm text-white/75">Boys and girls earn together for their houses.</p>
              </div>
              <div className="mt-4 space-y-3">
                {live.leaderboard.map((house, index) => (
                  <div key={house.id} className="rounded-2xl bg-white/10 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">#{index + 1} {house.name}</span>
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#22304a]">{house.points} pts</span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">{house.virtue}</p>
                  </div>
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
    </FamilyDashboardFrame>
  );
}
