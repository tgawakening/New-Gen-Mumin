import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { RecordingModal } from "@/components/recordings/RecordingModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { listParentChildRecordings } from "@/lib/live-classes/recordings";

const PAGE_SIZE = 6;

type PageProps = {
  searchParams?: Promise<{ child?: string; recording?: string; program?: string; page?: string }>;
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

function recordingsHref(params: { childId?: string; program?: string; page?: number; recording?: string }) {
  const query = new URLSearchParams();
  if (params.childId) query.set("child", params.childId);
  if (params.program) query.set("program", params.program);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.recording) query.set("recording", params.recording);
  return `/parent/recordings?${query.toString()}`;
}

export default async function ParentRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const recordings = selectedChild ? await listParentChildRecordings(session.user.id, selectedChild.id) : [];
  const activeRecording = recordings.find((recording) => recording.id === params?.recording);
  const childId = selectedChild?.id;
  const baseRecordingsPath = childId ? recordingsHref({ childId, program: params?.program }) : "/parent/recordings";

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

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Recordings"
      subtitle="Review completed live class recordings for each child by programme."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/recordings"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Recordings", value: String(recordings.length), hint: "Available replays for this child." },
              { label: "Latest", value: recordings[0] ? formatDate(recordings[0].availableAt) : "None yet", hint: "Most recent recording." },
              { label: "Teacher linked", value: recordings.some((item) => item.teacherName) ? "Yes" : "Pending", hint: "Teacher shown per replay." },
              { label: "Programmes", value: String(programTabs.length), hint: "Courses with recordings." },
            ]}
          />

          <SectionCard eyebrow="Live class replays" title={`${selectedChild.name}'s recordings`}>
            {programTabs.length ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {programTabs.map((tab) => {
                    const active = tab.programSlug === activeProgram;
                    return (
                      <Link
                        key={tab.programSlug}
                        href={recordingsHref({ childId, program: tab.programSlug })}
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
                        <Link href={recordingsHref({ childId, program: activeProgram, page, recording: recording.id })} className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                          Watch recording
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <Link href={recordingsHref({ childId, program: activeProgram, page: page - 1 })} className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}>Previous</Link>
                    <span className="text-sm font-semibold text-[#617184]">Page {page} of {totalPages}</span>
                    <Link href={recordingsHref({ childId, program: activeProgram, page: page + 1 })} className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}>Next</Link>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                Recordings will appear here after Zoom finishes processing completed classes for this child.
              </p>
            )}
          </SectionCard>
        </>
      ) : null}
      {activeRecording ? <RecordingModal recording={activeRecording} closeHref={baseRecordingsPath} /> : null}
    </FamilyDashboardFrame>
  );
}