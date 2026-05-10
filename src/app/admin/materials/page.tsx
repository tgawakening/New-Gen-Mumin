export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { getCurrentSession } from "@/lib/auth/session";
import { approveMaterial, listMaterials, rejectMaterial } from "@/lib/google-drive/materials";
import { isGoogleDriveConfigured } from "@/lib/google-drive/client";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/admin/materials?${params.toString()}`;
}

function NoticeBanner({ notice, tone }: { notice?: string; tone?: string }) {
  if (!notice) return null;
  return (
    <div className={`rounded-[20px] border px-5 py-4 text-sm font-medium ${tone === "error" ? "border-[#f0cccc] bg-[#fff4f4] text-[#a23c3c]" : "border-[#cfe9d8] bg-[#edf8ef] text-[#2f6b4b]"}`}>
      {notice}
    </div>
  );
}

export default async function AdminMaterialsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  const params = searchParams ? await searchParams : {};

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Gen-Mumins Admin</p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Course materials</h1>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  async function approveAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/materials");
    try {
      await approveMaterial(String(formData.get("fileId") || ""), currentSession.user.id);
      revalidatePath("/admin/materials");
      revalidatePath("/student/courses");
      revalidatePath("/parent/courses");
      redirect(noticeHref("Material approved and published."));
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to approve material.", "error"));
    }
  }

  async function rejectAction(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/materials");
    try {
      await rejectMaterial(String(formData.get("fileId") || ""), currentSession.user.id);
      revalidatePath("/admin/materials");
      redirect(noticeHref("Material marked as needing changes."));
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to reject material.", "error"));
    }
  }

  const materials = await listMaterials({ limit: 80 });
  const pending = materials.filter((material) => material.status === "pending");

  return (
    <div className="min-h-screen bg-[#edf2f6] py-6">
      <div className="section-container space-y-5">
        <NoticeBanner notice={params.notice} tone={params.tone} />
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Admin / Materials</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#22304a]">Google Drive course materials</h1>
              <p className="mt-2 text-sm text-[#617184]">Approve teacher uploads before they appear to students and parents.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Admin home</Link>
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${isGoogleDriveConfigured() ? "bg-[#effaf3] text-[#2f6b4b]" : "bg-[#fff7eb] text-[#8a6326]"}`}>
                Drive {isGoogleDriveConfigured() ? "configured" : "needs env"}
              </span>
            </div>
          </div>
        </div>

        {pending.length ? (
          <section className="rounded-[28px] border border-[#f0d7aa] bg-[#fffaf1] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6326]">Needs review</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Pending uploads</h2>
            <div className="mt-5 space-y-4">
              {pending.map((material) => (
                <div key={material.id} className="rounded-[20px] border border-[#efd9b6] bg-white p-5">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_auto] xl:items-center">
                    <div>
                      <p className="font-semibold text-[#22304a]">{material.name}</p>
                      <p className="mt-1 text-sm text-[#617184]">{material.programTitle} - uploaded by {material.uploadedBy ?? "teacher"}</p>
                    </div>
                    <a href={material.webViewLink ?? "#"} target="_blank" className="text-sm font-semibold text-[#2a76aa]">Preview file</a>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <form action={approveAction}>
                        <input type="hidden" name="fileId" value={material.id} />
                        <button className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white">Approve</button>
                      </form>
                      <form action={rejectAction}>
                        <input type="hidden" name="fileId" value={material.id} />
                        <button className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">Needs changes</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f7d8f]">Library</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">All Drive materials</h2>
          <div className="mt-5 space-y-3">
            {materials.map((material) => (
              <div key={material.id} className="rounded-[20px] border border-[#dce4ed] bg-[#fbfdff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#22304a]">{material.name}</p>
                    <p className="mt-1 text-sm text-[#617184]">{material.programTitle ?? "Program"} - {material.status}</p>
                  </div>
                  {material.webViewLink ? <a href={material.webViewLink} target="_blank" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Open</a> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
