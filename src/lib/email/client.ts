import { db } from "@/lib/db";
import { env } from "@/lib/env";

type SendEmailInput = {
  toEmail: string;
  subject: string;
  html: string;
  template: string;
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

  if (!response.ok) {
    return {
      skipped: false as const,
      failed: true as const,
      error: typeof payload?.message === "string" ? payload.message : "Unable to send email.",
    };
  }

  return { skipped: false as const, failed: false as const };
}
