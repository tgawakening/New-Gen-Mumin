import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { getAdminFeedbackOverview } from "@/lib/community/feedback";

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

export default async function AdminFeedbackPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const overview = await getAdminFeedbackOverview();

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
            <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Feedback stream</h2>
          </div>

          <div className="space-y-4">
            {overview.responses.map((entry) => (
              <div key={entry.id} className="rounded-[20px] border border-[#eadfce] bg-[#fbfdff] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                    <p className="mt-1 text-sm text-[#617184]">
                      {entry.audience} by {personName(entry.submittedBy)} - {formatDate(entry.submittedAt)}
                    </p>
                    <p className="mt-1 text-sm text-[#617184]">
                      Student: {entry.student ? personName(entry.student.user) : "General teacher/admin feedback"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-[#245d85]">Mood {entry.moodRating ?? "-"}/5</span>
                    <span className="rounded-full bg-[#effaf3] px-3 py-1 text-[#2f6b4b]">Confidence {entry.confidence ?? "-"}/5</span>
                    <span className="rounded-full bg-[#fff7eb] px-3 py-1 text-[#8a6326]">Workload {entry.workload ?? "-"}/5</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <FeedbackBlock label="Wins" value={entry.wins} />
                  <FeedbackBlock label="Concerns" value={entry.concerns} />
                  <FeedbackBlock label="Support needed" value={entry.supportNeeded} />
                </div>
              </div>
            ))}
            {!overview.responses.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Feedback submissions will appear here.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function FeedbackBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 text-sm">
      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">{label}</p>
      <p className="mt-2 leading-6 text-[#4d5a6b]">{value || "No entry"}</p>
    </div>
  );
}
