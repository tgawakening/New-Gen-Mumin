import Link from "next/link";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { RecordingModal } from "@/components/recordings/RecordingModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { listTeacherRecordings } from "@/lib/live-classes/recordings";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = {
  searchParams?: Promise<{ recording?: string }>;
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

export default async function TeacherRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : undefined;
  const recordings = await listTeacherRecordings(session.user.id);
  const activeRecording = recordings.find((recording) => recording.id === params?.recording);

  return (
    <TeacherDashboardFrame
      title="Recordings"
      subtitle="Review Drive-backed recordings generated after your completed live classes."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Recordings", value: String(recordings.length), hint: "Cloud replays available." },
          { label: "Latest", value: recordings[0] ? formatDate(recordings[0].availableAt) : "None yet", hint: "Most recent processed recording." },
          { label: "Programs", value: String(new Set(recordings.map((item) => item.programTitle)).size), hint: "Programmes with replays." },
          { label: "Weekly classes", value: String(dashboard.classes.length), hint: "Live sessions under your account." },
        ]}
      />

      <TeacherSection eyebrow="Drive replays" title="Class recordings">
        <div className="space-y-4">
          {recordings.map((recording) => (
            <div key={recording.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
              <p className="mt-2 text-sm text-[#5f6b7a]">{formatDate(recording.recordingStart ?? recording.availableAt)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {recording.watchUrl ? (
                  <Link href={`/teacher/recordings?recording=${recording.id}`} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    Watch recording
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#617184]">
                    Preparing Drive view
                  </span>
                )}
              </div>
            </div>
          ))}
          {!recordings.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Recordings will appear here after Zoom finishes processing completed classes.
            </p>
          ) : null}
        </div>
      </TeacherSection>
      {activeRecording ? <RecordingModal recording={activeRecording} closeHref="/teacher/recordings" /> : null}
    </TeacherDashboardFrame>
  );
}
