export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { deleteTeacherMaterial, uploadTeacherMaterial, listMaterials } from "@/lib/google-drive/materials";
import { isGoogleDriveConfigured } from "@/lib/google-drive/client";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string; programId?: string; folderName?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" | "danger" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/materials?${params.toString()}`;
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-[20px] border border-[#f0cccc] bg-[#fff4f4] px-5 py-4 text-sm font-medium text-[#a23c3c]">{message}</div>;
}

export default async function TeacherMaterialsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const programIds = new Set(dashboard.rosters.map((roster) => roster.programId));
  const defaultProgramId = params.programId && programIds.has(params.programId)
    ? params.programId
    : dashboard.rosters[0]?.programId;
  const defaultFolderName = params.folderName?.trim() || "General";
  let driveError: string | null = null;
  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  try {
    materials = (await listMaterials({ limit: 50 })).filter((material) => material.programId && programIds.has(material.programId));
  } catch (error) {
    driveError = error instanceof Error ? error.message : "Unable to load Google Drive materials.";
  }

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
        folderName: String(formData.get("folderName") || "General"),
        publishToStudents: formData.get("publishToStudents") === "on",
        file,
      });
      revalidatePath("/teacher/materials");
      revalidatePath("/admin/materials");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload this material.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Material uploaded successfully."));
  }

  async function deleteMaterialAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    try {
      await deleteTeacherMaterial(String(formData.get("fileId") || ""), currentSession.user.id);
      revalidatePath("/teacher/materials");
      revalidatePath("/admin/materials");
      revalidatePath("/student/courses");
      revalidatePath("/parent/courses");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete this material.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Material deleted successfully.", "danger"));
  }

  return (
    <TeacherDashboardFrame
      title="Course Materials"
      subtitle="Upload program files directly to the Gen-Mumin Google Drive. Published resources appear for students and parents immediately when selected."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.notice} tone={params.tone} />
      <ErrorBanner message={driveError ?? undefined} />
      <TeacherMetricGrid
        metrics={[
          { label: "Drive", value: isGoogleDriveConfigured() ? "Ready" : "Missing", hint: "Google Drive service account connection." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Assigned upload folders." },
          { label: "Materials", value: String(materials.length), hint: "Uploaded files visible in this workspace." },
          { label: "Publishing", value: "Direct", hint: "Admin is notified for monitoring." },
        ]}
      />

      <TeacherSection eyebrow="Upload" title="Add course material">
        <form action={uploadMaterialAction} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Program folder
            <select name="programId" required defaultValue={defaultProgramId} className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {dashboard.rosters.map((roster) => (
                <option key={roster.programId} value={roster.programId}>{roster.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Display title
            <input name="title" placeholder="Week 1 worksheet" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Folder / week
            <input name="folderName" placeholder="Week 1, Homework, Recordings" defaultValue={defaultFolderName} className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
            <input name="publishToStudents" type="checkbox" defaultChecked className="h-4 w-4" />
            Show in student/parent dashboards
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a] md:col-span-2">
            Choose file
            <div className="rounded-2xl border border-dashed border-[#b9c6d6] bg-[#fbfdff] px-4 py-5">
              <input name="file" type="file" required className="w-full text-sm text-[#22304a] file:mr-4 file:rounded-full file:border-0 file:bg-[#0f4d81] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
            </div>
          </label>
          <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white md:col-span-2 md:justify-self-start">
            Upload material
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
                  <p className="mt-1 text-sm text-[#617184]">{material.programTitle ?? "Program"} - {material.folderName ?? "General"} - {material.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {material.webViewLink ? (
                    <a href={material.webViewLink} target="_blank" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
                      Open
                    </a>
                  ) : null}
                  <form action={deleteMaterialAction}>
                    <input type="hidden" name="fileId" value={material.id} />
                    <button className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">Delete</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
          {!materials.length ? <p className="text-sm text-[#617184]">No materials uploaded yet.</p> : null}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
