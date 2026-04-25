import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, MetricGrid, SectionCard, formatGrade, formatSubmissionStatus } from "@/components/dashboard/family/FamilyDashboardFrame";

export default async function StudentJournalPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const totalPractice = child.journals.reduce((sum, entry) => sum + entry.practiceMinutes, 0);

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Journal"
      subtitle="Track weekly reflections, self-ratings, practice minutes, and teacher feedback."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Entries", value: String(child.journals.length), hint: "Weekly journal submissions." },
          { label: "Practice minutes", value: String(totalPractice), hint: "Total logged practice time." },
          { label: "Latest self-rating", value: child.journals[0]?.selfRating ? formatGrade(child.journals[0].selfRating) : "Pending", hint: "Most recent learner reflection." },
          { label: "Teacher feedback", value: child.journals.some((entry) => entry.teacherFeedback) ? "Available" : "Pending", hint: "Teacher response to journal work." },
        ]}
      />

      <SectionCard eyebrow="Weekly reflections" title="Journal log">
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {child.journals.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {formatSubmissionStatus(entry.status)}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#5f6b7a]">
                Practice: {entry.practiceMinutes} minutes • Self-rating: {formatGrade(entry.selfRating)}
              </p>
              <p className="mt-3 text-sm leading-7 text-[#4d5a6b]">{entry.reflection}</p>
              {entry.teacherFeedback ? (
                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-[#4d5a6b]">
                  <strong>Teacher feedback:</strong> {entry.teacherFeedback}
                </p>
              ) : null}
            </div>
          ))}
          {!child.journals.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Weekly journal entries will appear here after reflection activities begin.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
