"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { setCertificatePublication, hideAllWeeklyCertificates } from "@/lib/community/certificate-publication";

export async function refreshCertificatePortals() {
  for (const path of ["/teacher", "/parent", "/student", "/admin/rewards", "/certificates", "/parent-certificates", "/badges"]) revalidatePath(path, "layout");
}
export async function changeCertificatePublication(form: FormData) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") redirect("/auth/login");
  const parent = form.get("parent") === "true";
  await setCertificatePublication({ userId: session.user.id, awardId: String(form.get("awardId") || ""), parent, isPublic: form.get("isPublic") === "on" });
  await refreshCertificatePortals();
  redirect(parent ? "/teacher/parent-recognition" : "/teacher/recognition?tab=certificate");
}
export async function hideWeeklyCertificates(form: FormData) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") redirect("/auth/login");
  if (form.get("confirmHide") !== "on") throw new Error("Confirm hiding existing weekly certificates.");
  await hideAllWeeklyCertificates(session.user.id);
  await refreshCertificatePortals();
  redirect("/teacher/recognition?tab=certificate");
}
