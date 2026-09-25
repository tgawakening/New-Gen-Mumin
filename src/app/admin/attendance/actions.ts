"use server";
import { getCurrentSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { previewAdminAttendance, saveAdminAttendance, type RecoveryInput } from "@/lib/live-classes/admin-attendance";
async function admin() {
  const session = await getCurrentSession();
  if (session?.user.role !== "ADMIN") throw new Error("Administrator access required.");
  return session.user.id;
}
export async function previewRecovery(studentId: string, from: string, to: string) {
  try { return { data: await previewAdminAttendance(await admin(), studentId, from, to), error: "" }; }
  catch (error) { return { data: null, error: error instanceof Error ? error.message : "Unable to preview attendance." }; }
}
export async function saveRecovery(input: RecoveryInput) {
  try {
    const data = await saveAdminAttendance(await admin(), input);
    for (const path of ["/parent", "/student", "/admin/attendance", "/admin/rewards"]) revalidatePath(path, "layout");
    return { data, error: "" };
  } catch (error) {
    console.error("Admin attendance recovery failed", error);
    return { data: null, error: error instanceof Error && !('code' in error) ? error.message : "Unable to save this learner. Retry safely; duplicate points will not be awarded." };
  }
}
