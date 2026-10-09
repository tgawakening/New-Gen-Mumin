import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { reserveEmailSend } from "@/lib/email/quota";

type SendEmailInput = {
  toEmail: string;
  subject: string;
  html: string;
  template: string;
  deduplicationKey?: string;
};
// These templates bypass only the ordinary notification cooldown, never the global quota.
const CRITICAL_TEMPLATES = new Set([
  "accountCreationConfirmation",
  "passwordReset",
  "enrollmentConfirmation",
  "scholarshipApproved",
  "scholarshipRejected",
  "dashboardUnlocked",
  "monthlyPaymentReceipt",
  "teacherPayrollPublished",
  "monthlyPaymentPending",
  "monthlyPaymentReminder",
  "monthlyPaymentActivated",
]);
const TEMPLATE_COOLDOWN_MS: Record<string, number> = {
  liveClassStarted: 60 * 60 * 1000,
  fardhTrackerSubmitted: 12 * 60 * 60 * 1000,
  qabilaMention: 2 * 60 * 60 * 1000,
  qabilaMessagePosted: 2 * 60 * 60 * 1000,
  sunnahTrackerSubmitted: 60 * 60 * 1000,
};

function getOptionalEmailConfig() {
  if (!env.success) return null;
  if (!env.data.RESEND_API_KEY || !env.data.EMAIL_FROM) return null;
  return {
    apiKey: env.data.RESEND_API_KEY,
    from: env.data.EMAIL_FROM,
  };
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const durableDeduplication = ["billing:", "payroll:", "feedback:"].some(prefix => input.deduplicationKey?.startsWith(prefix));
  const config = getOptionalEmailConfig();

  if (!config) {
    await db.emailLog.create({
      data: {
        toEmail: input.toEmail,
        template: input.template,
        subject: input.subject,
        status: "SKIPPED",
        payload: { reason: "Email provider not configured" },
      },
    });
    return { skipped: true as const };
  }

  let reservation;
  try {
    reservation = await reserveEmailSend({ ...input, durableDeduplication,
      critical: CRITICAL_TEMPLATES.has(input.template),
      cooldownMs: TEMPLATE_COOLDOWN_MS[input.template] ?? 10 * 60 * 1000,
    });
  } catch (error) {
    console.error("Email quota reservation unavailable", error);
    return { skipped: false as const, failed: true as const, error: "Email quota could not be verified. No email was sent." };
  }
  if (reservation.kind === "already-sent") return { skipped: false as const, failed: false as const };
  if (reservation.kind === "blocked") {
    await db.emailLog.create({ data: { toEmail: input.toEmail, template: input.template,
      subject: input.subject, status: "SKIPPED", payload: { reason: reservation.reason },
    } });
    return { skipped: true as const };
  }
  // UNKNOWN is deliberately counted by the quota: a timeout can occur after acceptance.
  let response: Response;
  try {
  response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(durableDeduplication ? { "Idempotency-Key": input.deduplicationKey } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
    }),
  });

  } catch (error) {
    await db.emailLog.update({ where: { id: reservation.id }, data: {
      status: "UNKNOWN", error: "Provider outcome unknown; quota slot retained for reconciliation",
    } }).catch(() => undefined);
    console.error("Email provider outcome unknown", error);
    return { skipped: false as const, failed: true as const, error: "Email provider outcome is unknown." };
  }
  const payload = await response.json().catch(() => ({}));

  await db.emailLog.update({
    where: { id: reservation.id },
    data: {
      status: response.ok ? "SENT" : response.status >= 500 ? "UNKNOWN" : "FAILED",
      providerId: typeof payload?.id === "string" ? payload.id : null,
      error: response.ok ? null : JSON.stringify(payload),
      payload: { ...payload, ...(input.deduplicationKey ? { deduplicationKey: input.deduplicationKey } : {}) },
      sentAt: response.ok ? new Date() : null,
    },
  });


  if (!response.ok) {
    return {
      skipped: false as const,
      failed: true as const,
      error: typeof payload?.message === "string" ? payload.message : "Unable to send email.",
    };
  }

  return { skipped: false as const, failed: false as const };
}
