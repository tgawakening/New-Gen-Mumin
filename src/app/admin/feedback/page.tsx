import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { getAdminFeedbackOverview } from "@/lib/community/feedback";
import { FeedbackReviewConsole, type FeedbackReviewEntry } from "@/components/dashboard/feedback/FeedbackReviewConsole";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function personName(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}`.trim() : "Unassigned";
}

function totalFor(totals: Array<{ audience: FeedbackAudience; _count: { _all: number } }>, audience: FeedbackAudience) {
  return totals.find((entry) => entry.audience === audience)?._count._all ?? 0;
}

function payloadEntries(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload).map(([key, value]) => ({
    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    value: Array.isArray(value) ? value.join(", ") : String(value || "No entry"),
  }));
}

function toReviewEntry(entry: Awaited<ReturnType<typeof getAdminFeedbackOverview>>["responses"][number]): FeedbackReviewEntry {
  const programmes = entry.student?.enrollments.map((enrollment) => enrollment.program.title) ?? [];
  const studentName = entry.student ? personName(entry.student.user) : null;
  const summary = [
    { label: "Wins / taught", value: entry.wins || "No entry" },
    { label: "Concerns", value: entry.concerns || "No entry" },
    { label: "Support / next steps", value: entry.supportNeeded || "No entry" },
  ];

  return {
    id: entry.id,
    audience: entry.audience,
    title: entry.weekLabel,
    submittedBy: `${personName(entry.submittedBy)} (${entry.submittedBy.role})`,
    studentName,
    programmes,
    submittedAt: formatDate(entry.submittedAt),
    metrics: [
      { label: "Mood", value: entry.moodRating ? `${entry.moodRating}/5` : "-" },
      { label: "Confidence", value: entry.confidence ? `${entry.confidence}/5` : "-" },
      { label: "Workload", value: entry.workload ? `${entry.workload}/5` : "-" },
    ],
    summary,
    details: [...payloadEntries(entry.rawPayload), ...summary],
  };
}

export default async function AdminFeedbackPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const overview = await getAdminFeedbackOverview();
  const reviewEntries = overview.responses.map(toReviewEntry);

  return (
    <div className="min-h-screen bg-[#edf2f6] py-6">
      <div className="section-container space-y-5">
        <div className="rounded-[24px] border border-[#dce4ed] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Admin feedback</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#22304a]">Weekly Feedback Console</h1>
              <p className="mt-1 text-sm text-[#617184]">Review student, parent, and teacher signals across the platform.</p>
            </div>
            <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
              Back to admin
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          {[
            ["Total", overview.responses.length],
            ["Students", totalFor(overview.totals, FeedbackAudience.STUDENT)],
            ["Parents", totalFor(overview.totals, FeedbackAudience.PARENT)],
            ["Teachers", totalFor(overview.totals, FeedbackAudience.TEACHER)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[22px] border border-[#dce4ed] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#6d7785]">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-[#22304a]">{value}</p>
            </div>
          ))}
        </div>

        <section className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Recent responses</p>
            <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Feedback review</h2>
          </div>

          <FeedbackReviewConsole
            entries={reviewEntries}
            defaultAudience="PARENT"
            emptyLabel="Feedback submissions will appear here."
          />
        </section>
      </div>
    </div>
  );
}
