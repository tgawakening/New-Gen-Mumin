"use server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function markHomeworkReviewed(form: FormData) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "PARENT") throw new Error("Sign in as a parent to review homework.");
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("notificationIds") || "[]")); } catch { return; }
  const ids = Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string" && value.length < 100).slice(0, 1000) : [];
  if (!ids.length) return;
  await db.notification.updateMany({ where: { userId: session.user.id, id: { in: ids }, readAt: null, href: { startsWith: "/parent/homework?" } }, data: { readAt: new Date() } });
  revalidatePath("/parent", "layout");
}
