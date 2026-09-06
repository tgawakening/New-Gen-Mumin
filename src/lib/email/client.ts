import { db } from "@/lib/db";
import { env } from "@/lib/env";

type SendEmailInput = {
  toEmail: string;
  subject: string;
  html: string;
  template: string;
};
// Reserve the final daily sends for access, security, payment, and class-critical mail.
const ESSENTIAL_TEMPLATES = new Set([
  "accountCreationConfirmation",
  "passwordReset",
  "enrollmentConfirmation",
  "scholarshipApproved",
  "scholarshipRejected",
  "dashboardUnlocked",
  "liveClassStarted",
  "teacherZoomMeetingApproved",
  "studentTaskAssigned",
  "monthlyPaymentReceipt",
  "monthlyPaymentPending",
  "monthlyPaymentReminder",
  "monthlyPaymentActivated",
]);
const STANDARD_EMAIL_RESERVE_LIMIT = 85;
let reservedStandardSends = 0;
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

  const essential = ESSENTIAL_TEMPLATES.has(input.template);
  if (!essential) {
    const now = Date.now();
    if (now - reservationWindowStartedAt >= 24 * 60 * 60 * 1000) {
      reservationWindowStartedAt = now;
      reservedStandardSends = 0;
    }
    const [sentCount, duplicate] = await Promise.all([
      db.emailLog.count({ where: { status: "SENT", createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
      db.emailLog.findFirst({
        where: {
          toEmail: input.toEmail,
          template: input.template,
          subject: input.subject,
          status: "SENT",
          createdAt: { gte: new Date(now - 10 * 60 * 1000) },
        },
        select: { id: true },
      }),
    ]);
    const reason = duplicate
      ? "Duplicate notification suppressed"
      : sentCount + reservedStandardSends >= STANDARD_EMAIL_RESERVE_LIMIT
        ? "Daily quota reserve protected"
        : null;
    if (reason) {
      await db.emailLog.create({
        data: { toEmail: input.toEmail, template: input.template, subject: input.subject, status: "SKIPPED", payload: { reason } },
      });
      return { skipped: true as const };
    }
    reservedStandardSends += 1;
  }
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

  if (!essential) reservedStandardSends = Math.max(0, reservedStandardSends - 1);

  if (!response.ok) {
    return {
      skipped: false as const,
      failed: true as const,
      error: typeof payload?.message === "string" ? payload.message : "Unable to send email.",
    };
  }

  return { skipped: false as const, failed: false as const };
}
