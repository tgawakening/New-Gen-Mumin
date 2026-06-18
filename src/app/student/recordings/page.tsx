import Link from "next/link";
import { redirect } from "next/navigation";

import { FamilyDashboardFrame, MetricGrid, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { RecordingModal } from "@/components/recordings/RecordingModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { listStudentRecordings } from "@/lib/live-classes/recordings";

type PageProps = {
  searchParams?: Promise<{ recording?: string }>;
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
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

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Recordings"
      subtitle="Watch completed live class recordings shared for your sessions."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Recordings", value: String(recordings.length), hint: "Available live class replays." },
          { label: "Latest", value: recordings[0] ? formatDate(recordings[0].availableAt) : "None yet", hint: "Most recent replay posted." },
          { label: "Access", value: dashboard.child.accessLocked ? "Locked" : "Open", hint: "Recordings follow your dashboard access." },
          { label: "Programmes", value: String(new Set(recordings.map((item) => item.programTitle)).size), hint: "Courses with recordings." },
        ]}
      />

      <SectionCard eyebrow="Live class replays" title="Available recordings">
        <div className="space-y-4">
          {recordings.map((recording) => (
            <div key={recording.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {recording.teacherName} - {formatDate(recording.recordingStart ?? recording.availableAt)}
              </p>
              {recording.watchUrl ? (
                <Link
                  href={`/student/recordings?recording=${recording.id}`}
                  className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"
                >
                  {recording.isReadyForPlayback ? "Watch recording" : "Preparing recording"}
                </Link>
              ) : (
                <span className="mt-4 inline-flex rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#617184]">
                  Preparing Drive view
                </span>
              )}
            </div>
          ))}
          {!recordings.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Recordings will appear here after Zoom finishes processing a completed class.
            </p>
          ) : null}
        </div>
      </SectionCard>
      {activeRecording ? <RecordingModal recording={activeRecording} closeHref="/student/recordings" /> : null}
    </FamilyDashboardFrame>
  );
}
