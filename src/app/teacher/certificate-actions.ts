"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAwardWeeklyCertificates } from "@/lib/teacher/recognition-permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { setCertificatePublication, hideAllWeeklyCertificates } from "@/lib/community/certificate-publication";

export async function refreshCertificatePortals() {
  for (const path of ["/teacher", "/communications", "/parent", "/student", "/admin/rewards", "/certificates", "/parent-certificates", "/badges"]) revalidatePath(path, "layout");
}
export async function changeCertificatePublication(form: FormData) {
  const session = await getCurrentSession();
  if (!session || !canAwardWeeklyCertificates(session.user)) redirect("/auth/login");
  const parent = form.get("parent") === "true";
  await setCertificatePublication({ userId: session.user.id, awardId: String(form.get("awardId") || ""), parent, isPublic: form.get("isPublic") === "on" });
  await refreshCertificatePortals();
  const portal = session.user.role === "COMMUNICATIONS" ? "/communications" : "/teacher";
  redirect(parent ? `${portal}/parent-recognition` : `${portal}/recognition?tab=certificate`);
}
export async function hideWeeklyCertificates(form: FormData) {
  const session = await getCurrentSession();
  if (!session || !canAwardWeeklyCertificates(session.user)) redirect("/auth/login");
  if (form.get("confirmHide") !== "on") throw new Error("Confirm hiding existing weekly certificates.");
  await hideAllWeeklyCertificates(session.user.id);
  await refreshCertificatePortals();
  redirect(session.user.role === "COMMUNICATIONS" ? "/communications/recognition?tab=certificate" : "/teacher/recognition?tab=certificate");
}
