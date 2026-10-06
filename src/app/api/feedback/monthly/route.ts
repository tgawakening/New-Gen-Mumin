import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canReviewMonthlyFeedback, submitMonthlyFeedback, changeMonthlyFeedback, FeedbackConflict } from "@/lib/feedback/monthly";
import { MONTHLY_QUESTIONS, csvCell, validMonth } from "@/lib/feedback/monthly-questions";
import { deliverFeedbackEmails } from "@/lib/feedback/email-worker";
async function mutate(request: NextRequest, method: "POST" | "PATCH" | "DELETE") {
 const session = await getCurrentSession();
 if (!session || session.user.role !== "PARENT") return NextResponse.json({ error: "Please sign in as a parent." }, { status: 401 });
 const origin = request.headers.get("origin");
 const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
 let sameOrigin = false;
 try { sameOrigin = Boolean(origin && new URL(origin).host === host); } catch { /* Reject malformed origins. */ }
 if (!sameOrigin) return NextResponse.json({ error: "Please submit from your portal." }, { status: 403 });
 if (Number(request.headers.get("content-length") ?? 0) > 100000) return NextResponse.json({ error: "Your response is too long." }, { status: 413 });
 try {
  const body = await request.text();
  if (body.length > 100000) return NextResponse.json({ error: "Your response is too long." }, { status: 413 });
  const input = JSON.parse(body);
  if (!input || (method === "POST" ? typeof input.studentId !== "string" || typeof input.month !== "string" : typeof input.id !== "string" || !Number.isInteger(input.version))) return NextResponse.json({ error: "Select a child and month." }, { status: 400 });
  const saved = method === "POST" ? await submitMonthlyFeedback(session.user.id, input) : await changeMonthlyFeedback(session.user.id, input, method === "DELETE");
  for (const path of ["/parent/feedback", "/feedback/monthly", "/communications"]) revalidatePath(path);
  if (!saved) return NextResponse.json({ deleted: true });
  after(async () => { try { await deliverFeedbackEmails(10, saved.id); } catch { console.error("Monthly feedback email delivery deferred to worker"); } });
  return NextResponse.json({ id: saved.id, version: saved.version, studentId: saved.studentId, month: saved.month, details: saved.details, answers: saved.answers, submittedAt: saved.submittedAt.toISOString(), canManage: true });
 } catch (error) {
  if (error instanceof FeedbackConflict) return NextResponse.json({ error: error.message, conflict: true }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Feedback has already been submitted for this child and month. Thank you!", duplicate: true }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) { console.error("Monthly feedback save unavailable"); return NextResponse.json({ error: "We could not save right now. Your answers are still here. Please try again." }, { status: 503 }); }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit feedback. Please try again." }, { status: 400 });
 }
}
export const POST = (request: NextRequest) => mutate(request, "POST");
export const PATCH = (request: NextRequest) => mutate(request, "PATCH");
export const DELETE = (request: NextRequest) => mutate(request, "DELETE");
export async function GET(request: NextRequest) {
 const session = await getCurrentSession();
 if (!session || !(await canReviewMonthlyFeedback(session.user.id))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
 const month = request.nextUrl.searchParams.get("month") ?? "";
 if (!validMonth(month)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
 const rows = await db.monthlyParentFeedback.findMany({ where: { month }, orderBy: { submittedAt: "asc" }, include: { submittedBy: { select: { email: true } } } });
 const detailKeys = ["parentName", "childName", "age", "country", "timezone", "programmes", "qabila"];
 const csv = [["Month", "Submitted at (UTC)", "Parent email", "Child ID", ...detailKeys, ...MONTHLY_QUESTIONS.map(q => q.label)], ...rows.map(row => {
  const details = row.details as Record<string, string>, answers = row.answers as Record<string, string | string[]>;
  return [row.month, row.submittedAt.toISOString(), row.submittedBy.email, row.studentId, ...detailKeys.map(k => details[k]), ...MONTHLY_QUESTIONS.map(q => answers[q.id])];
 })].map(row => row.map(csvCell).join(",")).join("\r\n");
 return new NextResponse("\uFEFF" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gen-mumin-monthly-feedback-${month}.csv"`, "Cache-Control": "private, no-store" } });
}
