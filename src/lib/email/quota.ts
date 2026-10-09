import { db } from "@/lib/db";

export const EMAIL_DAILY_LIMIT = 60;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const GATE_ID = "genm-email-quota-control-v1";

type ReservationInput = {
  toEmail: string; template: string; subject: string;
  deduplicationKey?: string; durableDeduplication: boolean;
  critical: boolean; cooldownMs: number;
};

/** Commit a reservation before contacting Resend. The singleton row serializes
 * senders across processes and deployments; no network call holds this lock.
 * Uncertain or unfinished sends retain their slots until reconciled, because
 * releasing them could allow more than 60 accepted messages.
 */
export async function reserveEmailSend(input: ReservationInput) {
  return db.$transaction(async tx => {
    await tx.emailLog.upsert({
      where: { id: GATE_ID },
      create: { id: GATE_ID, toEmail: "system@genmumin.invalid", template: "quotaControl", subject: "Global email quota lock (not an email)", status: "QUOTA_CONTROL" },
      update: { updatedAt: new Date() },
    });
    const now = new Date();
    const deduplication = input.deduplicationKey
      ? { payload: { path: "$.deduplicationKey", equals: input.deduplicationKey } }
      : { subject: input.subject };
    if (input.durableDeduplication || !input.critical) {
      const duplicate = await tx.emailLog.findFirst({
        where: { toEmail: input.toEmail, template: input.template, ...deduplication,
          OR: [
            { status: "SENT", ...(input.durableDeduplication ? {} : { createdAt: { gte: new Date(now.getTime() - input.cooldownMs) } }) },
            { status: { in: ["SENDING", "UNKNOWN"] } },
          ],
        }, select: { status: true },
      });
      if (duplicate) return input.durableDeduplication && duplicate.status === "SENT"
        ? { kind: "already-sent" as const }
        : { kind: "blocked" as const, reason: "Duplicate notification suppressed or awaiting confirmation" };
    }
    const since = new Date(now.getTime() - WINDOW_MS);
    const used = await tx.emailLog.count({ where: { OR: [
      { status: "SENT", OR: [{ sentAt: { gte: since } }, { sentAt: null, createdAt: { gte: since } }] },
      { status: { in: ["SENDING", "UNKNOWN"] } },
    ] } });
    if (used >= EMAIL_DAILY_LIMIT) return { kind: "blocked" as const, reason: "Global 60-email rolling 24-hour limit reached" };
    const row = await tx.emailLog.create({ data: {
      toEmail: input.toEmail, template: input.template, subject: input.subject,
      status: "SENDING", payload: input.deduplicationKey ? { deduplicationKey: input.deduplicationKey } : {},
    }, select: { id: true } });
    return { kind: "reserved" as const, id: row.id };
  }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 });
}
