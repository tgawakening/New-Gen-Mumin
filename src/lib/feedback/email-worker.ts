import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/client";
import { renderGenMuminsEmailTemplate } from "@/lib/email/templates";
import { isFeedbackReviewer, type FeedbackDetails } from "./monthly";
export async function deliverFeedbackEmails(limit = 10, responseId?: string) {
 const now = new Date();
 const available = [{ status: "FEEDBACK_PENDING" }, { status: "FEEDBACK_PROCESSING", lockedUntil: { lt: now } }];
 const jobs = await db.billingEmailJob.findMany({ where: { kind: "MONTHLY_FEEDBACK", ...(responseId ? { recordId: responseId } : {}), nextAttemptAt: { lte: now }, OR: available }, orderBy: { createdAt: "asc" }, take: limit });
 for (const job of jobs) {
  const token = randomUUID();
  const claim = await db.billingEmailJob.updateMany({ where: { id: job.id, OR: available }, data: { status: "FEEDBACK_PROCESSING", lockToken: token, lockedUntil: new Date(Date.now() + 300000), attempts: { increment: 1 } } });
  if (!claim.count) continue;
  try {
   const recipientId = (job.payload as { recipientId?: string }).recipientId;
   const recipient = recipientId ? await db.user.findUnique({ where: { id: recipientId } }) : null;
   const response = job.recordId ? await db.monthlyParentFeedback.findUnique({ where: { id: job.recordId } }) : null;
   if (!recipient || !isFeedbackReviewer(recipient) || !response) {
    await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "CANCELLED", lockToken: null, lockedUntil: null } }); continue;
   }
   if (!env.success) throw new Error("Email configuration unavailable");
   const details = response.details as unknown as FeedbackDetails;
   const result = await sendTransactionalEmail({ toEmail: recipient.email, template: "monthlyParentFeedback", deduplicationKey: job.key, subject: `Gen-Mumin | Parent feedback for ${response.month}`, html: renderGenMuminsEmailTemplate({ heading: "New monthly parent feedback", preview: "A family has shared their monthly feedback.", intro: "Assalamu alaikum, a parent has submitted feedback for your review.", sections: [{ label: "Parent / child", value: details.parentName + " / " + details.childName }, { label: "Feedback month", value: response.month }, { label: "Programmes", value: details.programmes || "Gen-Mumin" }], callToAction: { label: "Review monthly feedback", href: new URL("/feedback/monthly?month=" + response.month, env.data.APP_URL).toString() }, closing: "Sign in to review answers by question, see individual responses, or download the monthly spreadsheet. JazakAllahu khairan." }) });
   if (result.skipped || result.failed) throw new Error("Email deferred: provider configuration, quota or delivery failure");
   await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "SENT", toEmail: recipient.email, sentAt: new Date(), lockToken: null, lockedUntil: null, lastError: null } });
  } catch (error) {
   await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "FEEDBACK_PENDING", lockToken: null, lockedUntil: null, nextAttemptAt: new Date(Date.now() + Math.min(86400000, 900000 * (job.attempts + 1))), lastError: error instanceof Error ? error.message : "Email failed" } });
  }
 }
}
export function startFeedbackEmailWorker() {
 const state = globalThis as typeof globalThis & { genmFeedbackTimer?: ReturnType<typeof setTimeout> };
 if (state.genmFeedbackTimer) return;
 const tick = async () => { try { await deliverFeedbackEmails(); } catch { console.error("Monthly feedback email worker unavailable"); } state.genmFeedbackTimer = setTimeout(tick, 300000); state.genmFeedbackTimer.unref(); };
 state.genmFeedbackTimer = setTimeout(tick, 45000); state.genmFeedbackTimer.unref();
}
