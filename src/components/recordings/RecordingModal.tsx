import Link from "next/link";

import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";

type RecordingModalRecording = {
  id: string;
  title: string;
  programTitle: string;
  teacherName: string;
  playbackUrl: string | null;
  isReadyForPlayback: boolean;
  recordingStart: Date | null;
  availableAt: Date;
};

type RecordingModalProps = {
  recording: RecordingModalRecording;
  closeHref: string;
};

function appendRecordingParam(path: string, recordingId: string) {
  return `${path}${path.includes("?") ? "&" : "?"}recording=${encodeURIComponent(recordingId)}`;
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

export function RecordingModal({ recording, closeHref }: RecordingModalProps) {
  const returnTo = appendRecordingParam(closeHref, recording.id);

  return (
    <div className="fixed inset-0 z-[180] overflow-y-auto bg-[#1b2740]/55 px-4 py-6 backdrop-blur-sm sm:px-6">
      <Link href={closeHref} className="fixed inset-0" aria-label="Close recording player" />
      <div className="relative z-[181] mx-auto max-w-5xl rounded-[28px] border border-[#e5dccf] bg-white p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex flex-col gap-3 border-b border-[#e8dfd4] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#17233c]">{recording.title}</h2>
            <p className="mt-2 text-sm text-[#5f6b7a]">
              {recording.teacherName} - {formatDate(recording.recordingStart ?? recording.availableAt)}
            </p>
          </div>
          <Link
            href={closeHref}
            className="inline-flex w-fit rounded-full border border-[#cbd8e6] px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f3f7fb]"
          >
            Close
          </Link>
        </div>

        {recording.isReadyForPlayback && recording.playbackUrl ? (
          <RecordingPlayer src={recording.playbackUrl} title={recording.title} />
        ) : (
          <div className="rounded-[24px] bg-[#fbf6ef] px-6 py-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Preparing recording</p>
            <h3 className="mt-3 text-2xl font-semibold text-[#17233c]">This replay is still being prepared</h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#486079]">
              Zoom has sent the recording details, but the Google Drive playback file is not attached yet. Prepare it once to copy the replay into
              the correct Google Drive folder and enable website playback.
            </p>
            <form action={`/api/recordings/${recording.id}/prepare`} method="post" className="mt-6">
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17233c]">
                Prepare recording
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
