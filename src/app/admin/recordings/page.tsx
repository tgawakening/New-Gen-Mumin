export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { getCurrentSession } from "@/lib/auth/session";
import { ManualRecordingForm } from "./ManualRecordingForm";
import {
  addManualLiveClassRecording,
  deleteRecordingForAdmin,
  listAdminRecordings,
  listManualRecordingFormOptions,
  processPendingDriveRecordings,
  resetPendingRecordingImportsForAdmin,
  syncRecentZoomRecordingsForAdmin,
} from "@/lib/live-classes/recordings";

const PAGE_SIZE = 8;

type PageProps = {
  searchParams?: Promise<{
    notice?: string | string[];
    tone?: string | string[];
    teacher?: string | string[];
    page?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function noticeHref(message: string, tone: "success" | "error" | "danger" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/admin/recordings?${params.toString()}`;
}

function recordingsHref(params: { teacher?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.teacher) query.set("teacher", params.teacher);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const value = query.toString();
  return value ? `/admin/recordings?${value}` : "/admin/recordings";
}

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

function statusBadgeClasses(status: string) {
  switch (status) {
    case "ready":
      return "bg-[#edf8ef] text-[#2f6b4b]";
    case "processing":
      return "bg-[#fff7e6] text-[#9a5b11]";
    case "failed":
      return "bg-[#fdeeee] text-[#a23c3c]";
    default:
      return "bg-white text-[#617184]";
  }
}

function noticeClasses(tone?: string) {
  if (tone === "error" || tone === "danger") {
    return "border-[#efb3b3] bg-[#fff4f4] text-[#a23c3c]";
  }
  return "border-[#bfe4ca] bg-[#effaf3] text-[#2f6b4b]";
}

export default async function AdminRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  const params = searchParams ? await searchParams : {};
  const notice = firstParam(params.notice);
  const tone = firstParam(params.tone);

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Gen-Mumins Admin</p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Recordings</h1>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  async function deleteRecordingAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/recordings");

    try {
      await deleteRecordingForAdmin(String(formData.get("recordingId") || ""));
      revalidatePath("/admin/recordings");
      revalidatePath("/teacher/recordings");
      revalidatePath("/student/recordings");
      revalidatePath("/parent/recordings");
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to remove recording.", "error"));
    }
    redirect(noticeHref("Recording removed from dashboards.", "danger"));
  }

  async function processPendingRecordingsAction() {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/recordings");

    const results = await processPendingDriveRecordings(1);
    revalidatePath("/admin/recordings");
    revalidatePath("/teacher/recordings");
    revalidatePath("/student/recordings");
    revalidatePath("/parent/recordings");

    const failed = results.find((result) => !result.ok);
    if (failed) {
      redirect(noticeHref(failed.error ?? "Recording chunk processing failed.", "error"));
    }

    redirect(noticeHref(results.length ? "Recording processor ran. Keep cron enabled to continue uploads and Drive playback checks." : "No pending recording work was ready.", "success"));
  }

  async function resetProcessingRecordingsAction() {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/recordings");

    const count = await resetPendingRecordingImportsForAdmin();
    revalidatePath("/admin/recordings");
    redirect(noticeHref(`Reset ${count} stuck processing recording${count === 1 ? "" : "s"}.`, "success"));
  }

  async function syncZoomRecordingsAction() {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/recordings");

    let result: Awaited<ReturnType<typeof syncRecentZoomRecordingsForAdmin>>;
    try {
      result = await syncRecentZoomRecordingsForAdmin();
      revalidatePath("/admin/recordings");
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to sync Zoom recordings.", "error"));
    }

    redirect(noticeHref(`Synced ${result.imported} Zoom recording${result.imported === 1 ? "" : "s"}. Skipped ${result.skipped}.`, "success"));
  }

  async function addManualRecordingAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/recordings");

    try {
      const fileValue = formData.get("recordingFile");
      await addManualLiveClassRecording({
        adminUserId: currentSession.user.id,
        teacherId: String(formData.get("teacherId") || ""),
        programId: String(formData.get("programId") || ""),
        title: String(formData.get("title") || ""),
        sessionDate: String(formData.get("sessionDate") || ""),
        durationSeconds: Number(formData.get("durationSeconds") || "0") || null,
        source: String(formData.get("source") || "drive") === "upload" ? "upload" : "drive",
        file: fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
        driveUrl: String(formData.get("driveUrl") || ""),
        notifyUsers: formData.get("notifyUsers") === "yes",
      });
      revalidatePath("/admin/recordings");
      revalidatePath("/teacher/recordings");
      revalidatePath("/student/recordings");
      revalidatePath("/parent/recordings");
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to add recording.", "error"));
    }

    redirect(noticeHref("Manual recording added to Drive-backed recordings.", "success"));
  }

  const manualRecordingOptions = await listManualRecordingFormOptions();
  const recordings = await listAdminRecordings();
  const grouped = new Map<string, typeof recordings>();
  for (const recording of recordings) {
    const entries = grouped.get(recording.teacherId) ?? [];
    entries.push(recording);
    grouped.set(recording.teacherId, entries);
  }

  const teacherTabs = [...grouped.entries()].map(([teacherId, entries]) => ({
    teacherId,
    teacherName: entries[0]?.teacherName ?? "Teacher",
    count: entries.length,
  })).sort((left, right) => left.teacherName.localeCompare(right.teacherName));
  const requestedTeacher = firstParam(params.teacher);
  const activeTeacher = teacherTabs.some((tab) => tab.teacherId === requestedTeacher)
    ? requestedTeacher
    : teacherTabs[0]?.teacherId;
  const activeRecordings = activeTeacher ? grouped.get(activeTeacher) ?? [] : [];
  const totalPages = Math.max(1, Math.ceil(activeRecordings.length / PAGE_SIZE));
  const requestedPage = Number(firstParam(params.page) ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
  const paginatedRecordings = activeRecordings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#f7f2ea] py-8">
      <div className="section-container space-y-6">
        <div className="rounded-[32px] border border-[#e1d8cb] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Recordings</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#22304a]">Live class recordings</h1>
              <p className="mt-2 text-sm leading-6 text-[#617184]">
                Review unique Drive-backed recordings by teacher, with pagination for larger libraries.
              </p>
            </div>
            <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
              Admin home
            </Link>
            <form action={processPendingRecordingsAction}>
              <button className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">Process pending recordings</button>
            </form>
            <form action={syncZoomRecordingsAction}>
              <button className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Sync from Zoom</button>
            </form>
            <form action={resetProcessingRecordingsAction}>
              <button className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Reset stuck processing</button>
            </form>
          </div>
        </div>

        {notice ? <div className={`rounded-[22px] border px-5 py-4 text-sm font-semibold shadow-sm ${noticeClasses(tone)}`}>{notice}</div> : null}

        <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Manual recordings</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Add outside-session recording</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#617184]">
              Upload a local recording or attach an existing Google Drive video to the correct teacher and programme. It will appear in the same recordings tabs for admin, teacher, parent, and student dashboards.
            </p>
          </div>
          <form action={addManualRecordingAction} encType="multipart/form-data">
            <ManualRecordingForm teachers={manualRecordingOptions} />
          </form>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Total recordings</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{recordings.length}</p>
          </div>
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Teachers</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{teacherTabs.length}</p>
          </div>
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Latest</p>
            <p className="mt-2 text-lg font-semibold text-[#22304a]">{recordings[0] ? formatDate(recordings[0].availableAt) : "None yet"}</p>
          </div>
        </div>

        {teacherTabs.length ? (
          <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {teacherTabs.map((tab) => {
                const active = tab.teacherId === activeTeacher;
                return (
                  <Link
                    key={tab.teacherId}
                    href={recordingsHref({ teacher: tab.teacherId })}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#22304a] text-white" : "border border-[#d8e3ed] bg-white text-[#22304a] hover:bg-[#f6f8fb]"}`}
                  >
                    {tab.teacherName} <span className="opacity-75">({tab.count})</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Teacher</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{teacherTabs.find((tab) => tab.teacherId === activeTeacher)?.teacherName ?? "Recordings"}</h2>
              </div>
              <span className="rounded-full bg-[#fbf6ef] px-4 py-2 text-sm font-semibold text-[#22304a]">
                Page {page} of {totalPages}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {paginatedRecordings.map((recording) => (
                <div key={recording.id} className="rounded-[22px] bg-[#fbf6ef] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
                      <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
                      <p className="mt-1 text-sm text-[#617184]">
                        {(recording.sessionDateKnown ? formatDate(recording.recordingStart ?? recording.availableAt) : "Session date not set")} - {formatDuration(recording.durationMinutes)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(recording.processingStatus)}`}>
                          {recording.processingStatusLabel}
                        </span>
                        {recording.processingProgressLabel ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#617184]">{recording.processingProgressLabel}</span> : null}
                        {recording.processingError ? <span className="max-w-xl text-xs leading-5 text-[#a23c3c]">{recording.processingError}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recording.isReadyForPlayback && recording.watchUrl ? (
                        <Link href={recording.watchUrl} target="_blank" className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">Open</Link>
                      ) : (
                        <form action={`/api/recordings/${recording.id}/prepare`} method="post">
                          <input type="hidden" name="returnTo" value="/admin/recordings" />
                          <button className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                            {recording.processingStatus === "processing" ? "Processing" : recording.processingStatus === "failed" ? "Retry" : "Prepare"}
                          </button>
                        </form>
                      )}
                      <form action={deleteRecordingAction}>
                        <input type="hidden" name="recordingId" value={recording.id} />
                        <button className="rounded-full border border-[#efc6c1] bg-white px-4 py-2 text-sm font-semibold text-[#a23c3c]">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={recordingsHref({ teacher: activeTeacher, page: page - 1 })}
                  className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}
                >
                  Previous
                </Link>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <Link
                      key={pageNumber}
                      href={recordingsHref({ teacher: activeTeacher, page: pageNumber })}
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${pageNumber === page ? "bg-[#22304a] text-white" : "border border-[#d8e3ed] bg-white text-[#22304a]"}`}
                    >
                      {pageNumber}
                    </Link>
                  ))}
                </div>
                <Link
                  href={recordingsHref({ teacher: activeTeacher, page: page + 1 })}
                  className={`rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white text-[#22304a]"}`}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="rounded-[30px] border border-[#eadfce] bg-white p-6 text-sm text-[#617184] shadow-sm">
            Recordings will appear here after Zoom sends a recording completed webhook.
          </div>
        )}
      </div>
    </div>
  );
}