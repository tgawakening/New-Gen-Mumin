import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentFeedbackSummary, submitWeeklyFeedback } from "@/lib/community/feedback";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; submitted?: string }>;
};

export default async function ParentFeedbackPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const params = searchParams ? await searchParams : {};
  const selectedChild = dashboard.children.find((child) => child.id === params.child) ?? dashboard.children[0];
  const feedback = selectedChild ? await getStudentFeedbackSummary(selectedChild.id) : [];

  async function submitParentFeedback(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "PARENT") redirect("/auth/login");
    const currentDashboard = await getParentDashboardData(currentSession.user.id);
    if (!currentDashboard) redirect("/registration");

    const childId = String(formData.get("childId") || "");
    const child = currentDashboard.children.find((entry) => entry.id === childId);
    if (!child) throw new Error("Child is not available for this parent.");

    await submitWeeklyFeedback({
      audience: FeedbackAudience.PARENT,
      submittedById: currentSession.user.id,
      studentId: child.id,
      weekLabel: String(formData.get("weekLabel") || ""),
      moodRating: Number(formData.get("moodRating") || 0) || null,
      confidence: Number(formData.get("confidence") || 0) || null,
      workload: Number(formData.get("workload") || 0) || null,
      wins: String(formData.get("wins") || ""),
      concerns: String(formData.get("concerns") || ""),
      supportNeeded: String(formData.get("supportNeeded") || ""),
    });

    revalidatePath("/parent/feedback");
    redirect(`/parent/feedback?child=${child.id}&submitted=1`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Weekly Feedback"
      subtitle="Submit family observations and review student feedback trends in one place."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.submitted ? "Parent feedback submitted." : undefined} />

      <MetricGrid
        metrics={[
          { label: "Children", value: String(dashboard.children.length), hint: "Linked learners." },
          { label: "Responses", value: String(feedback.length), hint: "Recent feedback entries." },
          { label: "Confidence", value: feedback[0]?.confidence ? `${feedback[0].confidence}/5` : "Pending", hint: "Latest confidence check." },
          { label: "Workload", value: feedback[0]?.workload ? `${feedback[0].workload}/5` : "Pending", hint: "Latest workload feeling." },
        ]}
      />

      <SectionCard eyebrow="Child selector" title="Choose learner" icon="star">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/feedback"
        />
      </SectionCard>

      {selectedChild ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard eyebrow="Parent form" title={`Submit for ${selectedChild.name}`} icon="journal">
            <form action={submitParentFeedback} className="grid gap-4">
              <input type="hidden" name="childId" value={selectedChild.id} />
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Week label
                <input name="weekLabel" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["moodRating", "Mood"],
                  ["confidence", "Confidence"],
                  ["workload", "Workload"],
                ].map(([name, label]) => (
                  <label key={name} className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    {label}
                    <input name={name} type="number" min="1" max="5" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                  </label>
                ))}
              </div>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Wins noticed at home
                <textarea name="wins" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Concerns
                <textarea name="concerns" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Support needed
                <textarea name="supportNeeded" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">
                Submit parent feedback
              </button>
            </form>
          </SectionCard>

          <SectionCard eyebrow="Shared history" title="Recent feedback" icon="chart">
            <div className="space-y-3">
              {feedback.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                  <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                  <p className="mt-1">{entry.submittedBy.role} - Mood {entry.moodRating ?? "-"} - Confidence {entry.confidence ?? "-"}</p>
                  <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.submittedAt)}</p>
                </div>
              ))}
              {!feedback.length ? (
                <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                  Feedback history will appear here after submissions.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </FamilyDashboardFrame>
  );
}
