import { db } from "@/lib/db";
import { env } from "@/lib/env";

type SendEmailInput = {
  toEmail: string;
  subject: string;
  html: string;
  template: string;
};
// Keep quota capacity for mail that grants access, protects an account, or confirms money.
// Routine engagement mail must never consume the final daily reserve.
const CRITICAL_TEMPLATES = new Set([
  "accountCreationConfirmation",
  "passwordReset",
  "enrollmentConfirmation",
  "scholarshipApproved",
  "scholarshipRejected",
  "dashboardUnlocked",
  "monthlyPaymentReceipt",
  "monthlyPaymentActivated",
]);
const TIME_SENSITIVE_TEMPLATES = new Set([
  "liveClassStarted",
  "teacherZoomMeetingApproved",
]);
const STANDARD_DAILY_LIMIT = 60;
const TIME_SENSITIVE_DAILY_LIMIT = 75;
const CRITICAL_DAILY_LIMIT = 95;
const TEMPLATE_COOLDOWN_MS: Record<string, number> = {
  fardhTrackerSubmitted: 12 * 60 * 60 * 1000,
  qabilaMention: 2 * 60 * 60 * 1000,
  qabilaMessagePosted: 2 * 60 * 60 * 1000,
  sunnahTrackerSubmitted: 60 * 60 * 1000,
};
let reservedSends = 0;
let reservationWindowStartedAt = Date.now();

function getOptionalEmailConfig() {
  if (!env.success) return null;
  if (!env.data.RESEND_API_KEY || !env.data.EMAIL_FROM) return null;
  return {
    apiKey: env.data.RESEND_API_KEY,
    from: env.data.EMAIL_FROM,
  };
}

export async function sendTransactionalEmail(input: SendEmailInput) {
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

  const now = Date.now();
  if (now - reservationWindowStartedAt >= 24 * 60 * 60 * 1000) {
    reservationWindowStartedAt = now;
    reservedSends = 0;
  }
  const critical = CRITICAL_TEMPLATES.has(input.template);
  const timeSensitive = TIME_SENSITIVE_TEMPLATES.has(input.template);
  const dailyLimit = critical ? CRITICAL_DAILY_LIMIT : timeSensitive ? TIME_SENSITIVE_DAILY_LIMIT : STANDARD_DAILY_LIMIT;
  const cooldownMs = TEMPLATE_COOLDOWN_MS[input.template] ?? 10 * 60 * 1000;
  const [sentCount, duplicate] = await Promise.all([
    db.emailLog.count({ where: { status: "SENT", createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
    critical
      ? Promise.resolve(null)
      : db.emailLog.findFirst({
          where: {
            toEmail: input.toEmail,
            template: input.template,
            subject: input.subject,
            status: "SENT",
            createdAt: { gte: new Date(now - cooldownMs) },
          },
          select: { id: true },
        }),
  ]);
  const reason = duplicate
    ? "Duplicate notification suppressed"
    : sentCount + reservedSends >= dailyLimit
      ? critical
        ? "Provider quota safety limit reached"
        : timeSensitive
          ? "Critical email reserve protected"
          : "Daily quota reserve protected"
      : null;
  if (reason) {
    await db.emailLog.create({
      data: { toEmail: input.toEmail, template: input.template, subject: input.subject, status: "SKIPPED", payload: { reason } },
    });
    return { skipped: true as const };
  }
  reservedSends += 1;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  await db.emailLog.create({
    data: {
      toEmail: input.toEmail,
      template: input.template,
      subject: input.subject,
      status: response.ok ? "SENT" : "FAILED",
      providerId: typeof payload?.id === "string" ? payload.id : null,
      error: response.ok ? null : JSON.stringify(payload),
      payload,
      sentAt: response.ok ? new Date() : null,
    },
  });

  reservedSends = Math.max(0, reservedSends - 1);

  if (!response.ok) {
    return {
      skipped: false as const,
      failed: true as const,
      error: typeof payload?.message === "string" ? payload.message : "Unable to send email.",
    };
  }

  return { skipped: false as const, failed: false as const };
}
