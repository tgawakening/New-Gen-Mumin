import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { getTeacherFeedbackSummary, submitWeeklyFeedback } from "@/lib/community/feedback";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatDate,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

export default async function TeacherFeedbackPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const [dashboard, feedback] = await Promise.all([
    getTeacherDashboardData(session.user.id),
    getTeacherFeedbackSummary(session.user.id),
  ]);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : {};

  async function submitTeacherFeedback(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    await submitWeeklyFeedback({
      audience: FeedbackAudience.TEACHER,
      submittedById: currentSession.user.id,
      weekLabel: String(formData.get("weekLabel") || ""),
      moodRating: Number(formData.get("moodRating") || 0) || null,
      confidence: Number(formData.get("confidence") || 0) || null,
      workload: Number(formData.get("workload") || 0) || null,
      wins: String(formData.get("wins") || ""),
      concerns: String(formData.get("concerns") || ""),
      supportNeeded: String(formData.get("supportNeeded") || ""),
    });

    revalidatePath("/teacher/feedback");
    redirect("/teacher/feedback?submitted=1");
  }

  return (
    <TeacherDashboardFrame
      title="Weekly Feedback"
      subtitle="Submit teaching reflections, workload signals, student support needs, and operational blockers."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.submitted ? "Teacher feedback submitted." : undefined} />

      <TeacherMetricGrid
        metrics={[
          { label: "Responses", value: String(feedback.length), hint: "Your recent teacher feedback entries." },
          { label: "Confidence", value: feedback[0]?.confidence ? `${feedback[0].confidence}/5` : "Pending", hint: "Latest delivery confidence." },
          { label: "Workload", value: feedback[0]?.workload ? `${feedback[0].workload}/5` : "Pending", hint: "Latest workload signal." },
          { label: "Classes", value: String(dashboard.classes.length), hint: "Assigned teaching sessions." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TeacherSection eyebrow="Teacher form" title="Submit this week">
          <form action={submitTeacherFeedback} className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Week label
              <input name="weekLabel" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["moodRating", "Teaching energy"],
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
              Concerns or student support needs
              <textarea name="concerns" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Admin support needed
              <textarea name="supportNeeded" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">
              Submit teacher feedback
            </button>
          </form>
        </TeacherSection>

        <TeacherSection eyebrow="History" title="Recent entries">
          <div className="space-y-3">
            {feedback.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                <p className="mt-1">Confidence {entry.confidence ?? "-"} - Workload {entry.workload ?? "-"}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.submittedAt)}</p>
              </div>
            ))}
            {!feedback.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Your teacher feedback history will appear here.
              </p>
            ) : null}
          </div>
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
