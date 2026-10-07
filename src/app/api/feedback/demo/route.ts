import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validMonth, validateAnswers } from "@/lib/feedback/monthly-questions";
async function mutate(request: NextRequest, remove = false) {
 const session = await getCurrentSession();
 if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
 const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true } });
 if (user?.role !== "COMMUNICATIONS" || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
 const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
 try { if (new URL(request.headers.get("origin") || "").host !== host) throw new Error(); } catch { return NextResponse.json({ error: "Please use your portal." }, { status: 403 }); }
 try {
  const text = await request.text();
  if (text.length > 100000) return NextResponse.json({ error: "Response too long." }, { status: 413 });
  const input = JSON.parse(text);
  if (remove) {
   const result = await db.monthlyFeedbackDemo.deleteMany({ where: { id: String(input.id), userId: session.user.id, version: Number(input.version) } });
   if (!result.count) return NextResponse.json({ error: "This test response changed. Reload to continue." }, { status: 409 });
   return NextResponse.json({ deleted: true });
  }
  if (typeof input.month !== "string" || !validMonth(input.month)) throw new Error("Choose a valid month.");
  const details: Record<string, string> = {};
  for (const key of ["parentName", "childName", "age", "country", "timezone"]) {
   const value = input.details?.[key];
   if (typeof value !== "string" || !value.trim() || value.length > 150) throw new Error("Complete the family details.");
   details[key] = value.trim();
  }
  if (!/^\d{1,2}$/.test(details.age) || Number(details.age) < 1) throw new Error("Enter a valid age.");
  const answers = validateAnswers(input.answers);
  const save = async () => {
   if (request.method === "PATCH") {
    const changed = await db.monthlyFeedbackDemo.updateMany({ where: { id: String(input.id), userId: session.user.id, month: input.month, version: Number(input.version) }, data: { details, answers, version: { increment: 1 } } });
    if (!changed.count) throw new Error("This test response changed. Reload to continue.");
    return db.monthlyFeedbackDemo.findUniqueOrThrow({ where: { id: String(input.id) } });
   }
   return db.monthlyFeedbackDemo.create({ data: { userId: session.user.id, month: input.month, details, answers } });
  };
  const saved = await save();
  return NextResponse.json({ ...saved, studentId: "demo", canManage: true });
 } catch { return NextResponse.json({ error: "Could not save this test response. Check required answers, or reload if already submitted." }, { status: 400 }); }
}
export const POST = (request: NextRequest) => mutate(request);
export const PATCH = (request: NextRequest) => mutate(request);
export const DELETE = (request: NextRequest) => mutate(request, true);
