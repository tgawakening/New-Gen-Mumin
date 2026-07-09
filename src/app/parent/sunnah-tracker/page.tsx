import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import {
  getStudentQuestData,
  isSunnahTrackerMission,
  parseSunnahTrackerDescription,
  submitMissionAttempt,
} from "@/lib/community/quest";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { db } from "@/lib/db";

type PageProps = {
  searchParams?: Promise<{ child?: string; submitted?: string }>;
};

export default async function ParentSunnahTrackerPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : {};
  const selectedChild = dashboard.children.find((child) => child.id === params.child) ?? dashboard.children[0];
  const programIds = selectedChild.courses.flatMap((course) => course.programIds.length ? course.programIds : [course.programId]);
  const quest = await getStudentQuestData(selectedChild.id, programIds);
  const trackers = quest.missions.filter(isSunnahTrackerMission);

  async function submitSunnahTracker(formData: FormData) {
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

    const missionId = String(formData.get("missionId") || "");
    await submitMissionAttempt({
      missionId,
      studentId: childId,
      studentName: parentChild.student.displayName || `${parentChild.student.user.firstName} ${parentChild.student.user.lastName}`.trim(),
      formData,
    });

    revalidatePath("/parent/sunnah-tracker");
    revalidatePath("/student/missions");
    revalidatePath("/student");
    redirect(`/parent/sunnah-tracker?child=${childId}&submitted=1`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Sunnah Tracker"
      subtitle="Submit daily Sunnah tasks in a clear checklist instead of WhatsApp messages."
      navItems={getParentNavItems(selectedChild.id)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.submitted ? "Sunnah tracker submitted. House points awarded." : undefined} />

      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild.id}
          basePath="/parent/sunnah-tracker"
        />
      </SectionCard>

      <MetricGrid
        metrics={[
          { label: "House", value: quest.membership.house.name, hint: quest.membership.house.virtue },
          { label: "Student points", value: String(quest.studentTotal), hint: "Total earned points." },
          { label: "House points", value: String(quest.houseTotal), hint: "Team total." },
          { label: "Trackers", value: String(trackers.length), hint: "Available Sunnah templates." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <SectionCard eyebrow="Daily checklist" title={`${selectedChild.name}'s Sunnah tasks`} icon="check">
          <div className="space-y-4">
            {trackers.map((mission) => {
              const latestAttempt = mission.attempts[0] ?? null;
              const details = parseSunnahTrackerDescription(mission.description);
              return (
                <div key={mission.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#22304a]">{mission.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">
                        {details?.description ?? "Tick each Sunnah task completed today."}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                      {mission.questions.length} tasks
                    </span>
                  </div>

                  {latestAttempt ? (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      Latest submission: {latestAttempt.pointsAwarded} points - {formatDate(latestAttempt.submittedAt)}
                    </p>
                  ) : null}

                  <form action={submitSunnahTracker} className="mt-4 space-y-3 rounded-[18px] bg-white p-4">
                    <input type="hidden" name="childId" value={selectedChild.id} />
                    <input type="hidden" name="missionId" value={mission.id} />
                    {mission.questions.map((question) => (
                      <label key={question.id} className="flex items-start gap-3 rounded-2xl border border-[#eadfce] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#22304a]">
                        <input type="checkbox" name={`answer-${question.id}`} value="true" className="mt-1 h-5 w-5 accent-[#2f6b4b]" />
                        <span>{question.prompt}</span>
                      </label>
                    ))}
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Optional note
                      <textarea name="reflection" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Any note for today's tracker?" />
                    </label>
                    <button disabled={selectedChild.accessLocked} className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      Submit Sunnah tracker
                    </button>
                  </form>
                </div>
              );
            })}
            {!trackers.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Sunnah tracker templates will appear here after a teacher publishes them.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Recent records" title="Points ledger" icon="trophy">
          <div className="space-y-3">
            {quest.pointLedger.filter((entry) => entry.sourceType === "SUNNAH_TRACKER").slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{entry.points} points</p>
                <p className="mt-1 leading-5">{entry.reason}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.awardedAt)}</p>
              </div>
            ))}
            {!quest.pointLedger.some((entry) => entry.sourceType === "SUNNAH_TRACKER") ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Sunnah tracker submissions will appear here.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
