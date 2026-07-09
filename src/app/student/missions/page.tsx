import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import {
  getStudentQuestData,
  isSunnahTrackerMission,
  parseSunnahTrackerDescription,
  submitMissionAttempt,
} from "@/lib/community/quest";
import { db } from "@/lib/db";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ completed?: string; type?: string }>;
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
  const sunnahOnly = params.type === "sunnah";
  const visibleMissions = sunnahOnly ? quest.missions.filter(isSunnahTrackerMission) : quest.missions;

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
    revalidatePath("/parent/sunnah-tracker");
    redirect(`/student/missions${sunnahOnly ? "?type=sunnah&" : "?"}completed=1`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title={sunnahOnly ? "Sunnah Tracker" : "Daily Missions"}
      subtitle={
        sunnahOnly
          ? "Tick today's Sunnah tasks, add an optional note, and save your daily record."
          : "Complete short Islamic learning missions, earn house points, and build a steady streak."
      }
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast
        message={
          params.completed
            ? sunnahOnly
              ? "Sunnah tracker submitted. House points awarded."
              : "Mission completed. House points awarded."
            : undefined
        }
      />

      <MetricGrid
        metrics={[
          { label: "House", value: quest.membership.house.name, hint: quest.membership.house.virtue },
          { label: "My points", value: String(quest.studentTotal), hint: "Your earned points." },
          { label: "House points", value: String(quest.houseTotal), hint: "Total points from your house." },
          { label: sunnahOnly ? "Trackers" : "Missions", value: String(visibleMissions.length), hint: sunnahOnly ? "Daily Sunnah templates." : "Currently available missions." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <SectionCard eyebrow={sunnahOnly ? "Sunnah tracker" : "Mission board"} title={sunnahOnly ? "Today's Sunnah tasks" : "Available missions"} icon="sparkles">
          <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
            {visibleMissions.map((mission) => {
              const latestAttempt = mission.attempts[0] ?? null;
              const sunnahTracker = isSunnahTrackerMission(mission);
              const sunnahDetails = parseSunnahTrackerDescription(mission.description);
              return (
                <div key={mission.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#22304a]">{mission.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                        {sunnahTracker
                          ? sunnahDetails?.description ?? "Tick each Sunnah task completed today."
                          : mission.description ?? "Complete this mission to earn house points."}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                      {mission.basePoints} base pts
                    </span>
                  </div>

                  {latestAttempt ? (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      Latest submission: {latestAttempt.pointsAwarded} points - {formatDate(latestAttempt.submittedAt)}
                    </p>
                  ) : null}

                  <details className="mt-4 rounded-[18px] bg-white p-4" open={sunnahTracker && !latestAttempt}>
                    <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                      {sunnahTracker ? "Open checklist" : latestAttempt ? "Try again" : "Start mission"}
                    </summary>
                    <form action={submitMission} className="mt-4 space-y-3">
                      <input type="hidden" name="missionId" value={mission.id} />
                      {mission.questions.map((question) => {
                        const meta = question.meta as { choices?: string[] } | null;
                        if (sunnahTracker) {
                          return (
                            <label key={question.id} className="flex items-start gap-3 rounded-2xl border border-[#eadfce] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#22304a]">
                              <input type="checkbox" name={`answer-${question.id}`} value="true" className="mt-1 h-5 w-5 accent-[#2f6b4b]" />
                              <span>{question.prompt}</span>
                            </label>
                          );
                        }
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
                      {sunnahTracker ? (
                        <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                          Optional parent/student note
                          <textarea name="reflection" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Anything to mention for today?" />
                        </label>
                      ) : null}
                      <button disabled={child.accessLocked} className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {sunnahTracker ? "Submit Sunnah tracker" : "Submit mission"}
                      </button>
                    </form>
                  </details>
                </div>
              );
            })}
            {!visibleMissions.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                {sunnahOnly ? "Sunnah tracker templates will appear here after a teacher publishes them." : "Created missions will appear here."}
              </p>
            ) : null}
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
                Complete your first activity to start the points ledger.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
