import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import { getSharedRecordingPlaybackDetails } from "@/lib/live-classes/recordings";
import { verifyRecordingShareToken } from "@/lib/live-classes/recording-share";
type PageProps = { params: Promise<{ recordingId: string }>; searchParams: Promise<{ expires?: string; token?: string }> };
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Date pending"; }
export default async function SharedRecordingPage({ params, searchParams }: PageProps) {
  const { recordingId } = await params; const { expires, token } = await searchParams;
  if (!verifyRecordingShareToken(recordingId, expires ?? null, token ?? null)) notFound();
  const recording = await getSharedRecordingPlaybackDetails(recordingId); if (!recording) notFound();
  const mediaUrl = `/api/shared/recordings/${recording.id}/media?expires=${encodeURIComponent(expires!)}&token=${encodeURIComponent(token!)}`;
  return <main className="min-h-screen bg-[#f4efe8] px-4 py-8"><div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-[28px] border border-[#eadfce] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p><h1 className="mt-2 text-2xl font-semibold text-[#22304a]">{recording.title}</h1><p className="mt-2 text-sm text-[#617184]">{recording.teacherName} - {formatDate(recording.recordingStart ?? recording.availableAt)}</p></header>
    <section className="rounded-[28px] border border-[#eadfce] bg-white p-4 shadow-sm"><RecordingPlayer src={mediaUrl} title={recording.title} /><p className="mt-4 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#617184]">This private replay link expires automatically. The recording remains protected inside Gen-Mumins.</p></section>
    <Link href="/" className="inline-flex rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">Go to Gen-Mumins</Link>
  </div></main>;
}
