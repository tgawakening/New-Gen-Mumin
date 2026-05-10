export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { uploadTeacherMaterial, listMaterials } from "@/lib/google-drive/materials";
import { isGoogleDriveConfigured } from "@/lib/google-drive/client";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/materials?${params.toString()}`;
}

function NoticeBanner({ notice, tone }: { notice?: string; tone?: string }) {
  if (!notice) return null;
  return (
    <div className={`rounded-[20px] border px-5 py-4 text-sm font-medium ${tone === "error" ? "border-[#f0cccc] bg-[#fff4f4] text-[#a23c3c]" : "border-[#cfe9d8] bg-[#edf8ef] text-[#2f6b4b]"}`}>
      {notice}
    </div>
  );
}

export default async function TeacherMaterialsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const programIds = new Set(dashboard.rosters.map((roster) => roster.programId));
  const materials = (await listMaterials({ limit: 50 })).filter((material) => material.programId && programIds.has(material.programId));

  async function uploadMaterialAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    try {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
      await uploadTeacherMaterial({
        programId: String(formData.get("programId") || ""),
        teacherUserId: currentSession.user.id,
        title: String(formData.get("title") || file.name),
        file,
      });
      revalidatePath("/teacher/materials");
      revalidatePath("/admin/materials");
      redirect(noticeHref("Material uploaded and sent to admin for approval."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload this material.";
      redirect(noticeHref(message, "error"));
    }
  }

  return (
    <TeacherDashboardFrame
      title="Course Materials"
      subtitle="Upload program files directly to the Gen-Mumin Google Drive. Admin approval publishes them to student and parent dashboards."
      navItems={getTeacherNavItems()}
    >
      <NoticeBanner notice={params.notice} tone={params.tone} />
      <TeacherMetricGrid
        metrics={[
          { label: "Drive", value: isGoogleDriveConfigured() ? "Ready" : "Missing", hint: "Google Drive service account connection." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Assigned upload folders." },
          { label: "Materials", value: String(materials.length), hint: "Uploaded files visible in this workspace." },
          { label: "Approval", value: "Admin", hint: "Files publish after review." },
        ]}
      />

      <TeacherSection eyebrow="Upload" title="Add course material">
        <form action={uploadMaterialAction} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Program folder
            <select name="programId" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {dashboard.rosters.map((roster) => (
                <option key={roster.programId} value={roster.programId}>{roster.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Display title
            <input name="title" placeholder="Week 1 worksheet" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a] md:col-span-2">
            File
            <input name="file" type="file" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white md:col-span-2 md:justify-self-start">
            Upload for approval
          </button>
        </form>
      </TeacherSection>

      <TeacherSection eyebrow="Library" title="Your uploaded materials">
        <div className="space-y-3">
          {materials.map((material) => (
            <div key={material.id} className="rounded-[20px] bg-[#fbf6ef] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#22304a]">{material.name}</p>
                  <p className="mt-1 text-sm text-[#617184]">{material.programTitle ?? "Program"} - {material.status}</p>
                </div>
                {material.webViewLink ? (
                  <a href={material.webViewLink} target="_blank" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {!materials.length ? <p className="text-sm text-[#617184]">No materials uploaded yet.</p> : null}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
