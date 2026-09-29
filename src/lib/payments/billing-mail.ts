import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendMonthlyPaymentPendingEmail, sendMonthlyPaymentReceiptEmail } from "@/lib/email/notifications";
import { DAY } from "@/lib/payments/billing-policy";

type Receipt = Parameters<typeof sendMonthlyPaymentReceiptEmail>[0];
export async function queueBillingReceipt(key: string, payload: Receipt) {
  await db.billingEmailJob.upsert({ where: { key }, update: {}, create: { key, kind: "RECEIPT", toEmail: payload.toEmail, payload: payload as unknown as Prisma.InputJsonValue } });
}
export async function deliverBillingEmails(limit = 20) {
  const now = new Date();
  const jobs = await db.billingEmailJob.findMany({ where: { nextAttemptAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "PROCESSING", lockedUntil: { lt: now } }] }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }], take: limit });
  let sent = 0;
  for (const job of jobs) {
    const token = randomUUID();
    const claim = await db.billingEmailJob.updateMany({ where: { id: job.id, OR: [{ status: "PENDING" }, { status: "PROCESSING", lockedUntil: { lt: now } }] }, data: { status: "PROCESSING", lockToken: token, lockedUntil: new Date(Date.now() + 5 * 60000), attempts: { increment: 1 } } });
    if (!claim.count) continue;
    try {
      let result;
      if (job.kind === "MANUAL") {
        const record = await db.monthlyPaymentRecord.findUnique({ where: { id: job.recordId! }, include: { parent: { include: { user: true } } } });
        // Never remind paid, cancelled, superseded or automatic-payment accounts.
        if (!record || record.method !== "MANUAL" || record.status !== "PENDING" || !record.billingKey || record.billingPeriodEnd <= now) {
          await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "CANCELLED", lockedUntil: null } }); continue;
        }
        const data = job.payload as { stage: string };
        result = await sendMonthlyPaymentPendingEmail({
          toEmail: record.parent.user.email, parentName: [record.parent.user.firstName, record.parent.user.lastName].filter(Boolean).join(" "),
          monthLabel: record.billingPeriodStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Karachi" }),
          totalLabel: money(record.amount, record.currency), dueDateLabel: record.dueDate.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "long" }),
          reference: record.id, reminder: data.stage !== "initial", overdue: now > record.dueDate,
          rows: [{ childName: record.childName, programmeTitle: record.programmeTitle, amountLabel: money(record.amount, record.currency) }],
          deduplicationKey: job.key,
        });
      } else {
        result = await sendMonthlyPaymentReceiptEmail({ ...(job.payload as unknown as Receipt), deduplicationKey: job.key });
      }
      if (result.skipped || result.failed) throw new Error(result.skipped ? "Email deferred: provider configuration or quota" : "Email provider declined delivery");
      await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "SENT", sentAt: new Date(), lockedUntil: null, lastError: null } });
      if (job.recordId) await db.monthlyPaymentRecord.updateMany({ where: { id: job.recordId }, data: (job.payload as { stage?: string }).stage === "initial" ? { pendingNotifiedAt: new Date() } : { reminderSentAt: new Date() } });
      if (job.kind === "RECEIPT") {
        const receipt = job.payload as unknown as Receipt;
        if (receipt.reference) await db.monthlyPaymentRecord.updateMany({ where: { providerInvoiceId: receipt.reference, method: "AUTO", parent: { user: { email: job.toEmail } } }, data: { receiptSentAt: new Date() } });
      }
      sent++;
    } catch (error) {
      await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "PENDING", lockedUntil: null, nextAttemptAt: new Date(Date.now() + Math.min(DAY, 15 * 60000 * (job.attempts + 1))), lastError: error instanceof Error ? error.message : "Email delivery failed" } });
    }
  }
  return { sent, checked: jobs.length };
}
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}
