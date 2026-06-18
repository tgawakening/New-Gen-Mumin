export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteRecordingForAdmin, listAdminRecordings } from "@/lib/live-classes/recordings";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" | "danger" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/admin/recordings?${params.toString()}`;
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

export default async function AdminRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  const params = searchParams ? await searchParams : {};

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

  const recordings = await listAdminRecordings();
  const grouped = new Map<string, typeof recordings>();
  for (const recording of recordings) {
    const entries = grouped.get(recording.teacherName) ?? [];
    entries.push(recording);
    grouped.set(recording.teacherName, entries);
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] py-8">
      <div className="section-container space-y-6">
        <div className="rounded-[32px] border border-[#e1d8cb] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Recordings</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#22304a]">Live class recordings</h1>
              <p className="mt-2 text-sm leading-6 text-[#617184]">
                Review Drive-backed class recordings by teacher and remove recordings from parent, student, and teacher dashboards when needed.
              </p>
            </div>
            <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
              Admin home
            </Link>
          </div>
        </div>

        <ActionToast message={params.notice} tone={params.tone} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Total recordings</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{recordings.length}</p>
          </div>
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Teachers</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{grouped.size}</p>
          </div>
          <div className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#617184]">Latest</p>
            <p className="mt-2 text-lg font-semibold text-[#22304a]">{recordings[0] ? formatDate(recordings[0].availableAt) : "None yet"}</p>
          </div>
        </div>

        {[...grouped.entries()].map(([teacherName, teacherRecordings]) => (
          <section key={teacherName} className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Teacher</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{teacherName}</h2>
              </div>
              <span className="rounded-full bg-[#fbf6ef] px-4 py-2 text-sm font-semibold text-[#22304a]">
                {teacherRecordings.length} recordings
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {teacherRecordings.map((recording) => (
                <div key={recording.id} className="rounded-[22px] bg-[#fbf6ef] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
                      <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
                      <p className="mt-1 text-sm text-[#617184]">{formatDate(recording.recordingStart ?? recording.availableAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recording.isReadyForPlayback && recording.watchUrl ? (
                        <Link href={recording.watchUrl} target="_blank" className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                          Open
                        </Link>
                      ) : (
                        <form action={`/api/recordings/${recording.id}/prepare`} method="post">
                          <input type="hidden" name="returnTo" value="/admin/recordings" />
                          <button className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                            Prepare
                          </button>
                        </form>
                      )}
                      <form action={deleteRecordingAction}>
                        <input type="hidden" name="recordingId" value={recording.id} />
                        <button className="rounded-full border border-[#efc6c1] bg-white px-4 py-2 text-sm font-semibold text-[#a23c3c]">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {!recordings.length ? (
          <div className="rounded-[30px] border border-[#eadfce] bg-white p-6 text-sm text-[#617184] shadow-sm">
            Recordings will appear here after Zoom sends a recording completed webhook.
          </div>
        ) : null}
      </div>
    </div>
  );
}
