import Link from "next/link";
import { redirect } from "next/navigation";

import { FamilyDashboardFrame, MetricGrid, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { RecordingModal } from "@/components/recordings/RecordingModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { listStudentRecordings } from "@/lib/live-classes/recordings";

const PAGE_SIZE = 6;

type PageProps = {
  searchParams?: Promise<{ recording?: string; program?: string; page?: string }>;
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "Length pending";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function recordingsHref(params: { program?: string; page?: number; recording?: string }) {
  const query = new URLSearchParams();
  if (params.program) query.set("program", params.program);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.recording) query.set("recording", params.recording);
  const value = query.toString();
  return value ? `/student/recordings?${value}` : "/student/recordings";
}

export default async function StudentRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");
  const params = searchParams ? await searchParams : undefined;
  const recordings = await listStudentRecordings(session.user.id);
  const activeRecording = recordings.find((recording) => recording.id === params?.recording);

  const grouped = new Map<string, typeof recordings>();
  for (const recording of recordings) {
    const entries = grouped.get(recording.programSlug) ?? [];
    entries.push(recording);
    grouped.set(recording.programSlug, entries);
  }
  const programTabs = [...grouped.entries()].map(([programSlug, entries]) => ({
    programSlug,
    programTitle: entries[0]?.programTitle ?? "Programme",
    teacherNames: [...new Set(entries.map((entry) => entry.teacherName).filter(Boolean))],
    count: entries.length,
  })).sort((left, right) => left.programTitle.localeCompare(right.programTitle));
  const activeProgram = programTabs.some((tab) => tab.programSlug === params?.program)
    ? params?.program
    : programTabs[0]?.programSlug;
  const activeRecordings = activeProgram ? grouped.get(activeProgram) ?? [] : [];
  const totalPages = Math.max(1, Math.ceil(activeRecordings.length / PAGE_SIZE));
  const requestedPage = Number(params?.page ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
  const paginatedRecordings = activeRecordings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const closeHref = recordingsHref({ program: activeProgram, page });

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Recordings"
      subtitle="Watch completed live class recordings by programme."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Recordings", value: String(recordings.length), hint: "Available live class replays." },
          { label: "Latest", value: recordings[0] ? formatDate(recordings[0].availableAt) : "None yet", hint: "Most recent replay posted." },
          { label: "Access", value: dashboard.child.accessLocked ? "Locked" : "Open", hint: "Recordings follow your dashboard access." },
          { label: "Programmes", value: String(programTabs.length), hint: "Courses with recordings." },
        ]}
      />

      <SectionCard eyebrow="Live class replays" title="Available recordings">
        {programTabs.length ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {programTabs.map((tab) => {
                const active = tab.programSlug === activeProgram;
                return (
                  <Link
                    key={tab.programSlug}
                    href={recordingsHref({ program: tab.programSlug })}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#22304a] text-white" : "border border-[#d8e3ed] bg-white text-[#22304a] hover:bg-[#f6f8fb]"}`}
                  >
                    {tab.programTitle} <span className="opacity-75">({tab.count})</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 rounded-[22px] bg-[#f8fafc] px-4 py-3 text-sm text-[#617184]">
              <span className="font-semibold text-[#22304a]">Teacher:</span>{" "}
              {programTabs.find((tab) => tab.programSlug === activeProgram)?.teacherNames.join(", ") || "Teacher pending"}
            </div>

            <div className="mt-4 space-y-4">
              {paginatedRecordings.map((recording) => (
                <div key={recording.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {recording.teacherName} - {formatDate(recording.recordingStart ?? recording.availableAt)} - {formatDuration(recording.durationMinutes)}
                  </p>
                  {recording.watchUrl ? (
                    <Link href={recordingsHref({ program: activeProgram, page, recording: recording.id })} className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                      Watch recording
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Link href={recordingsHref({ program: activeProgram, page: page - 1 })} className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}>Previous</Link>
                <span className="text-sm font-semibold text-[#617184]">Page {page} of {totalPages}</span>
                <Link href={recordingsHref({ program: activeProgram, page: page + 1 })} className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}>Next</Link>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
            Recordings will appear here after Zoom finishes processing a completed class.
          </p>
        )}
      </SectionCard>
      {activeRecording ? <RecordingModal recording={activeRecording} closeHref={closeHref} /> : null}
    </FamilyDashboardFrame>
  );
}