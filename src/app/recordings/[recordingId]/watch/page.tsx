import Link from "next/link";
import { redirect } from "next/navigation";

import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecordingPlaybackDetails } from "@/lib/live-classes/recordings";

type PageProps = {
  params: Promise<{ recordingId: string }>;
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

function dashboardHref(role: string) {
  if (role === "TEACHER") return "/teacher/recordings";
  if (role === "STUDENT") return "/student/recordings";
  if (role === "ADMIN") return "/admin/recordings";
  return "/parent/recordings";
}

export default async function RecordingWatchPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");

  const { recordingId } = await params;
  let recording: Awaited<ReturnType<typeof getRecordingPlaybackDetails>>;
  try {
    recording = await getRecordingPlaybackDetails(recordingId, {
      id: session.user.id,
      role: session.user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open this recording.";
    return (
      <main className="min-h-screen bg-[#f4efe8] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Recording unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold text-[#22304a]">Unable to open recording</h1>
          <p className="mt-3 text-sm leading-7 text-[#617184]">{message}</p>
          <Link href={dashboardHref(session.user.role)} className="mt-5 inline-flex rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">
            Back to recordings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-[28px] border border-[#eadfce] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#22304a]">{recording.title}</h1>
              <p className="mt-2 text-sm text-[#617184]">
                {recording.teacherName} - {formatDate(recording.recordingStart ?? recording.availableAt)}
              </p>
            </div>
            <Link href={dashboardHref(session.user.role)} className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
              Back
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#eadfce] bg-white p-4 shadow-sm">
          <RecordingPlayer src={`/api/recordings/${recording.id}/media`} title={recording.title} />
          <p className="mt-4 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#617184]">
            The recording plays through the Gen-Mumins dashboard. If it was uploaded only moments ago, give the player a short refresh after Google Drive finishes accepting the file stream.
          </p>
        </div>
      </div>
    </main>
  );
}
