import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/client";
import { queuePayrollEmail } from "./email-queue";
import { payrollEmailContent } from "./email-template";
import type { PayrollSnapshot } from "./calculation";

/** Catch up previously published slips, using the published revision, never a later draft version. */
export async function queuePublishedPayrollEmails() {
 const slips = await db.teacherPayslip.findMany({ where: { publishedAt: { not: null }, teacher: { user: { status: "ACTIVE", role: "TEACHER" } } }, include: { teacher: { include: { user: true } }, revisions: { orderBy: { version: "desc" }, take: 1 } } });
 for (const slip of slips) {
  const revision = slip.revisions[0];
  if (slip.publishedData && revision) await queuePayrollEmail(db, slip.id, revision.version, slip.teacher.user.email);
 }
 return { reviewed: slips.length };
}

export async function deliverPayrollEmails(limit = 10, payslipId?: string) {
 const now = new Date();
 const available = [{ status: "PAYROLL_PENDING" }, { status: "PAYROLL_PROCESSING", lockedUntil: { lt: now } }];
 const jobs = await db.billingEmailJob.findMany({ where: { kind: "TEACHER_PAYROLL", ...(payslipId ? { recordId: payslipId } : {}), nextAttemptAt: { lte: now }, OR: available }, orderBy: { createdAt: "asc" }, take: limit });
 let sent = 0;
 for (const job of jobs) {
  const token = randomUUID();
  const claim = await db.billingEmailJob.updateMany({ where: { id: job.id, OR: available }, data: { status: "PAYROLL_PROCESSING", lockToken: token, lockedUntil: new Date(Date.now() + 5 * 60000), attempts: { increment: 1 } } });
  if (!claim.count) continue;
  try {
   const slip = job.recordId ? await db.teacherPayslip.findUnique({ where: { id: job.recordId }, include: { teacher: { include: { user: true } }, revisions: { orderBy: { version: "desc" }, take: 1 } } }) : null;
   const revision = slip?.revisions[0];
   if (!slip?.publishedAt || !slip.publishedData || !revision || revision.version !== (job.payload as { version?: number }).version || slip.teacher.user.status !== "ACTIVE" || slip.teacher.user.role !== "TEACHER") {
    await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "CANCELLED", lockedUntil: null, lockToken: null } }); continue;
   }
   if (!env.success) throw new Error("Payroll email configuration is unavailable");
   const content = payrollEmailContent(revision.snapshot as unknown as PayrollSnapshot, env.data.APP_URL);
   const result = await sendTransactionalEmail({ toEmail: slip.teacher.user.email, ...content, template: "teacherPayrollPublished", deduplicationKey: job.key });
   if (result.skipped || result.failed) throw new Error(result.skipped ? "Payroll email deferred: provider configuration or quota" : "Payroll email provider declined delivery");
   await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "SENT", toEmail: slip.teacher.user.email, sentAt: new Date(), lockedUntil: null, lockToken: null, lastError: null } });
   sent++;
  } catch (error) {
   await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "PAYROLL_PENDING", lockedUntil: null, lockToken: null, nextAttemptAt: new Date(Date.now() + Math.min(86400000, 15 * 60000 * (job.attempts + 1))), lastError: error instanceof Error ? error.message : "Payroll email failed" } });
  }
 }
 return { sent, checked: jobs.length };
}

export function startPayrollEmailWorker() {
 const state = globalThis as typeof globalThis & { genmPayrollEmailTimer?: ReturnType<typeof setTimeout> };
 if (state.genmPayrollEmailTimer) return;
 const tick = async () => {
  try { await queuePublishedPayrollEmails(); await deliverPayrollEmails(); }
  catch (error) { console.error("Payroll email worker failed", error instanceof Error ? error.message : "unknown error"); }
  state.genmPayrollEmailTimer = setTimeout(tick, 5 * 60000); state.genmPayrollEmailTimer.unref();
 };
 state.genmPayrollEmailTimer = setTimeout(tick, 30000); state.genmPayrollEmailTimer.unref();
}
