import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentLiveQuizSession, liveQuizMessage, submitLiveQuizAnswer } from "@/lib/quizzes/live";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

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
    await submitLiveQuizAnswer({ sessionId, studentUserId: currentSession.user.id, answer });
    revalidatePath(`/student/quizzes/live/${sessionId}`);
    revalidatePath("/teacher/quizzes");
    redirect(`/student/quizzes/live/${sessionId}?notice=Answer submitted`);
  }

  const choices = live.currentQuestion ? choicesFromMeta(live.currentQuestion.meta) : [];

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Live Quiz"
      subtitle="Answer carefully. Correct answers inside the time window earn full points for your house."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <meta httpEquiv="refresh" content="7" />
      <ActionToast message={query.notice ?? query.error} tone={query.error ? "error" : "success"} />

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">House</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 rounded-full border border-[#d8e3ed]" style={{ backgroundColor: live.houseMembership.house.color ?? "#f8fafc" }} />
            <div>
              <h2 className="text-2xl font-semibold text-[#22304a]">{live.houseMembership.house.name}</h2>
              <p className="text-sm text-[#617184]">Every effort counts. Your house is cheering you on.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Answer window</p>
          <p className="mt-2 text-4xl font-semibold text-[#22304a]">{live.settings.responseWindowSeconds}s</p>
          <p className="mt-2 text-sm text-[#617184]">Speed does not rank students. Correct answers in the window get full points.</p>
        </div>
      </section>

      <SectionCard eyebrow="Live question" title={live.quiz.title}>
        {live.session.status === "ENDED" ? (
          <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#617184]">
            This live quiz has ended. <Link href="/student/quizzes" className="font-semibold text-[#22304a]">Back to quizzes</Link>
          </div>
        ) : live.currentQuestion ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-[28px] bg-[#fbf6ef] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question</p>
              <h3 className="mt-3 text-2xl font-semibold text-[#22304a]">{live.currentQuestion.prompt}</h3>
              <p className="mt-2 text-sm text-[#617184]">{live.currentQuestion.points} quiz points + participation points</p>

              {live.currentResponse ? (
                <div className="mt-5 rounded-[24px] bg-white p-5">
                  <p className="text-lg font-semibold text-[#22304a]">Answer received</p>
                  <p className="mt-2 text-sm leading-7 text-[#617184]">{liveQuizMessage(live.currentResponse)}</p>
                  <p className="mt-3 rounded-full bg-[#effaf3] px-4 py-2 text-sm font-semibold text-[#2f6b4b]">
                    +{live.currentResponse.housePointsAwarded} house points this question
                  </p>
                </div>
              ) : (
                <form action={submitAnswerAction} className="mt-5 space-y-4">
                  {live.currentQuestion.type === "MCQ" && choices.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {choices.map((choice) => (
                        <label key={choice} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-[#22304a] shadow-sm">
                          <input type="radio" name="answer" value={choice} required />
                          {choice}
                        </label>
                      ))}
                    </div>
                  ) : live.currentQuestion.type === "TRUE_FALSE" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-[#22304a] shadow-sm"><input type="radio" name="answer" value="true" required />True</label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-[#22304a] shadow-sm"><input type="radio" name="answer" value="false" required />False</label>
                    </div>
                  ) : (
                    <input name="answer" required className="w-full rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm" placeholder="Type your answer" />
                  )}
                  <button disabled={dashboard.child.accessLocked} className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    Submit answer
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-[28px] bg-[#22304a] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d7aa]">House leaderboard</p>
              <div className="mt-4 space-y-3">
                {live.leaderboard.map((house, index) => (
                  <div key={house.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm">
                    <span className="font-semibold">{index + 1}. {house.name}</span>
                    <span>{house.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#617184]">
            Waiting for your teacher to open the first question. This page refreshes automatically.
          </div>
        )}
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
