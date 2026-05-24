"use client";

import { useMemo, useState } from "react";
import { Eye, X } from "lucide-react";

export type FeedbackReviewEntry = {
  id: string;
  audience: "PARENT" | "TEACHER" | "STUDENT";
  title: string;
  submittedBy: string;
  studentName: string | null;
  programmes: string[];
  submittedAt: string;
  metrics: Array<{ label: string; value: string }>;
  summary: Array<{ label: string; value: string }>;
  details: Array<{ label: string; value: string }>;
};

type FeedbackReviewConsoleProps = {
  entries: FeedbackReviewEntry[];
  defaultAudience?: "ALL" | "PARENT" | "TEACHER" | "STUDENT";
  showAudienceTabs?: boolean;
  showProgrammeTabs?: boolean;
  emptyLabel: string;
};

const audienceTabs = [
  { id: "ALL", label: "All" },
  { id: "PARENT", label: "Parents" },
  { id: "TEACHER", label: "Teachers" },
  { id: "STUDENT", label: "Students" },
] as const;

export function FeedbackReviewConsole({
  entries,
  defaultAudience = "ALL",
  showAudienceTabs = true,
  showProgrammeTabs = true,
  emptyLabel,
}: FeedbackReviewConsoleProps) {
  const [activeAudience, setActiveAudience] = useState(defaultAudience);
  const [activeProgramme, setActiveProgramme] = useState("ALL");
  const [selectedEntry, setSelectedEntry] = useState<FeedbackReviewEntry | null>(null);

  const programmes = useMemo(
    () => Array.from(new Set(entries.flatMap((entry) => entry.programmes).filter(Boolean))).sort(),
    [entries],
  );

  const filteredEntries = entries.filter((entry) => {
    const audienceMatch = activeAudience === "ALL" || entry.audience === activeAudience;
    const programmeMatch = activeProgramme === "ALL" || entry.programmes.includes(activeProgramme);
    return audienceMatch && programmeMatch;
  });

  return (
    <div className="space-y-4">
      {showAudienceTabs ? (
        <div className="flex flex-wrap gap-2">
          {audienceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAudience(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeAudience === tab.id
                  ? "bg-[#22304a] text-white"
                  : "border border-[#dce4ed] bg-white text-[#526173] hover:bg-[#f6f9fc]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {showProgrammeTabs && programmes.length ? (
        <div className="flex flex-wrap gap-2">
          {["ALL", ...programmes].map((programme) => (
            <button
              key={programme}
              type="button"
              onClick={() => setActiveProgramme(programme)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeProgramme === programme
                  ? "bg-[#f39f5f] text-white"
                  : "border border-[#eadfce] bg-[#fff9f2] text-[#6a5b49] hover:bg-[#fff1e1]"
              }`}
            >
              {programme === "ALL" ? "All programmes" : programme}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] border border-[#dce4ed] bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(150px,0.7fr)_minmax(140px,0.65fr)_96px] gap-3 border-b border-[#edf1f5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">
          <span>Submission</span>
          <span className="hidden md:block">Programme</span>
          <span className="hidden md:block">Overview</span>
          <span className="text-right">Action</span>
        </div>

        <div className="divide-y divide-[#edf1f5]">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(150px,0.7fr)_minmax(140px,0.65fr)_96px] md:items-center">
              <div className="min-w-0">
                <p className="break-words font-semibold text-[#22304a]">{entry.title}</p>
                <p className="mt-1 text-sm text-[#617184]">
                  {entry.submittedBy} - {entry.submittedAt}
                </p>
                {entry.studentName ? <p className="mt-1 text-xs text-[#6f7d8f]">Student: {entry.studentName}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(entry.programmes.length ? entry.programmes : ["General"]).slice(0, 3).map((programme) => (
                  <span key={programme} className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#245d85]">
                    {programme}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.metrics.slice(0, 2).map((metric) => (
                  <span key={metric.label} className="rounded-full bg-[#effaf3] px-3 py-1 text-xs font-semibold text-[#2f6b4b]">
                    {metric.label} {metric.value}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#22304a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#17243a]"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
            </div>
          ))}

          {!filteredEntries.length ? (
            <p className="px-4 py-6 text-sm leading-7 text-[#6b7482]">{emptyLabel}</p>
          ) : null}
        </div>
      </div>

      {selectedEntry ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#17243a]/55 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#edf1f5] bg-white px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{selectedEntry.audience} feedback</p>
                <h3 className="mt-2 text-xl font-semibold text-[#22304a]">{selectedEntry.title}</h3>
                <p className="mt-1 text-sm text-[#617184]">{selectedEntry.submittedBy} - {selectedEntry.submittedAt}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce4ed] text-[#526173] transition hover:bg-[#f6f9fc]"
                aria-label="Close feedback details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                {selectedEntry.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-[#fbf6ef] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a6326]">{metric.label}</p>
                    <p className="mt-2 text-lg font-semibold text-[#22304a]">{metric.value}</p>
                  </div>
                ))}
              </div>

              <section>
                <p className="text-sm font-semibold text-[#22304a]">Main overview</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {selectedEntry.summary.map((item) => (
                    <FeedbackDetailBlock key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </section>

              <section>
                <p className="text-sm font-semibold text-[#22304a]">Full submission</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {selectedEntry.details.map((item) => (
                    <FeedbackDetailBlock key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackDetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#edf1f5] bg-[#fbfdff] px-4 py-3 text-sm">
      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap leading-6 text-[#4d5a6b]">{value || "No entry"}</p>
    </div>
  );
}
