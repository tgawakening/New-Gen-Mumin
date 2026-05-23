import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { submitMissionAttempt, getStudentQuestData } from "@/lib/community/quest";
import { db } from "@/lib/db";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ completed?: string }>;
};

export default async function StudentMissionsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const profile = await db.studentProfile.findUnique({
    where: { id: child.id },
    include: { enrollments: { select: { programId: true } } },
  });
  const quest = await getStudentQuestData(child.id, profile?.enrollments.map((enrollment) => enrollment.programId) ?? []);
  const params = searchParams ? await searchParams : {};

  async function submitMission(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");
    const currentDashboard = await getStudentDashboardData(currentSession.user.id);
    if (!currentDashboard) redirect("/auth/login");

    const missionId = String(formData.get("missionId") || "");
    await submitMissionAttempt({
      missionId,
      studentId: currentDashboard.child.id,
      studentName: currentDashboard.studentName,
      formData,
    });

    revalidatePath("/student");
    revalidatePath("/student/missions");
    redirect("/student/missions?completed=1");
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Daily Missions"
      subtitle="Complete short Islamic learning missions, earn house points, and build a steady streak."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.completed ? "Mission completed. House points awarded." : undefined} />

      <MetricGrid
        metrics={[
          { label: "House", value: quest.membership.house.name, hint: quest.membership.house.virtue },
          { label: "My points", value: String(quest.studentTotal), hint: "Your earned mission points." },
          { label: "House points", value: String(quest.houseTotal), hint: "Total points from your house." },
          { label: "Missions", value: String(quest.missions.length), hint: "Currently available missions." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <SectionCard eyebrow="Mission board" title="Available missions" icon="sparkles">
          <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
            {quest.missions.map((mission) => {
              const latestAttempt = mission.attempts[0] ?? null;
              return (
                <div key={mission.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#22304a]">{mission.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                        {mission.description ?? "Complete this mission to earn house points."}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                      {mission.basePoints} base pts
                    </span>
                  </div>

                  {latestAttempt ? (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      Latest attempt: {latestAttempt.pointsAwarded} points - {formatDate(latestAttempt.submittedAt)}
                    </p>
                  ) : null}

                  <details className="mt-4 rounded-[18px] bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                      {latestAttempt ? "Try again" : "Start mission"}
                    </summary>
                    <form action={submitMission} className="mt-4 space-y-3">
                      <input type="hidden" name="missionId" value={mission.id} />
                      {mission.questions.map((question) => {
                        const meta = question.meta as { choices?: string[] } | null;
                        return (
                          <label key={question.id} className="grid gap-2 text-sm font-semibold text-[#22304a]">
                            {question.prompt}
                            {question.type === "MCQ" && meta?.choices?.length ? (
                              <select name={`answer-${question.id}`} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                                <option value="">Select answer</option>
                                {meta.choices.map((choice) => (
                                  <option key={choice} value={choice}>{choice}</option>
                                ))}
                              </select>
                            ) : question.type === "TRUE_FALSE" ? (
                              <select name={`answer-${question.id}`} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                                <option value="">Select answer</option>
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            ) : question.type === "SHORT_REFLECTION" ? (
                              <textarea name={`answer-${question.id}`} required rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Write your reflection" />
                            ) : (
                              <input name={`answer-${question.id}`} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Type your answer" />
                            )}
                          </label>
                        );
                      })}
                      <button disabled={child.accessLocked} className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        Submit mission
                      </button>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard eyebrow="House ledger" title="Recent points" icon="trophy">
          <div className="space-y-3">
            {quest.pointLedger.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{entry.points} points</p>
                <p className="mt-1 leading-5">{entry.reason}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.awardedAt)}</p>
              </div>
            ))}
            {!quest.pointLedger.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Complete your first mission to start the points ledger.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
