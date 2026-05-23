import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentFeedbackSummary, submitWeeklyFeedback } from "@/lib/community/feedback";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

export default async function StudentFeedbackPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const feedback = await getStudentFeedbackSummary(dashboard.child.id);
  const params = searchParams ? await searchParams : {};

  async function submitFeedback(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");
    const currentDashboard = await getStudentDashboardData(currentSession.user.id);
    if (!currentDashboard) redirect("/auth/login");

    await submitWeeklyFeedback({
      audience: FeedbackAudience.STUDENT,
      submittedById: currentSession.user.id,
      studentId: currentDashboard.child.id,
      weekLabel: String(formData.get("weekLabel") || ""),
      moodRating: Number(formData.get("moodRating") || 0) || null,
      confidence: Number(formData.get("confidence") || 0) || null,
      workload: Number(formData.get("workload") || 0) || null,
      wins: String(formData.get("wins") || ""),
      concerns: String(formData.get("concerns") || ""),
      supportNeeded: String(formData.get("supportNeeded") || ""),
    });

    revalidatePath("/student/feedback");
    revalidatePath("/parent/feedback");
    redirect("/student/feedback?submitted=1");
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Weekly Feedback"
      subtitle="Share how the week felt, what went well, and where you need mentor support."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.submitted ? "Feedback submitted. Your mentors can review the summary." : undefined} />

      <MetricGrid
        metrics={[
          { label: "Responses", value: String(feedback.length), hint: "Recent weekly feedback entries." },
          { label: "Confidence", value: feedback[0]?.confidence ? `${feedback[0].confidence}/5` : "Pending", hint: "Latest confidence check." },
          { label: "Mood", value: feedback[0]?.moodRating ? `${feedback[0].moodRating}/5` : "Pending", hint: "Latest student mood check." },
          { label: "Workload", value: feedback[0]?.workload ? `${feedback[0].workload}/5` : "Pending", hint: "Latest workload feeling." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard eyebrow="Feedback form" title="Submit this week" icon="journal">
          <form action={submitFeedback} className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Week label
              <input name="weekLabel" required placeholder="Week 1, Ramadan week, etc." className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
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
              What went well?
              <textarea name="wins" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Any concerns?
              <textarea name="concerns" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Support needed from mentor
              <textarea name="supportNeeded" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">
              Submit feedback
            </button>
          </form>
        </SectionCard>

        <SectionCard eyebrow="History" title="Recent feedback" icon="chart">
          <div className="space-y-3">
            {feedback.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                <p className="mt-1">Mood {entry.moodRating ?? "-"} - Confidence {entry.confidence ?? "-"} - Workload {entry.workload ?? "-"}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.submittedAt)}</p>
              </div>
            ))}
            {!feedback.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Feedback history will appear after the first submission.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
