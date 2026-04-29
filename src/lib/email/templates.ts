type EmailTemplateInput = {
  heading: string;
  preview: string;
  intro: string;
  sections?: Array<{ label: string; value: string }>;
  callToAction?: { label: string; href: string };
  closing?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRows(sections: EmailTemplateInput["sections"] = []) {
  return sections
    .map(
      (section) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #efe3d3;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c27a2c;font-weight:700;">${escapeHtml(section.label)}</div>
            <div style="margin-top:6px;font-size:15px;line-height:1.7;color:#314258;">${escapeHtml(section.value)}</div>
          </td>
        </tr>`,
    )
    .join("");
}

export function renderGenMuminsEmailTemplate(input: EmailTemplateInput) {
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(input.heading)}</title>
    </head>
    <body style="margin:0;background:#f6f1e8;font-family:Georgia, 'Times New Roman', serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preview)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f1e8;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf5;border:1px solid #ead9c5;border-radius:28px;overflow:hidden;">
              <tr>
                <td style="padding:28px 32px;background:linear-gradient(135deg,#fff1df 0%,#fff9f0 100%);border-bottom:1px solid #efdfcd;">
                  <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:#f39f5f;color:#fff;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Gen-Mumins</div>
                  <h1 style="margin:18px 0 0;font-size:32px;line-height:1.15;color:#22304a;">${escapeHtml(input.heading)}</h1>
                  <p style="margin:14px 0 0;font-size:16px;line-height:1.8;color:#556274;">${escapeHtml(input.intro)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 32px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${renderRows(input.sections)}
                  </table>
                  ${
                    input.callToAction
                      ? `<div style="margin-top:28px;">
                          <a href="${escapeHtml(input.callToAction.href)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#22304a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(input.callToAction.label)}</a>
                        </div>`
                      : ""
                  }
                  <p style="margin:28px 0 0;font-size:15px;line-height:1.8;color:#556274;">${escapeHtml(input.closing ?? "Jazakum Allahu khayran, The Gen-Mumins team")}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export const emailTemplateCatalog = {
  enrollmentConfirmation: {
    heading: "Your payment is pending",
    preview: "Complete your payment to confirm your Gen-Mumins enrollment.",
  },
  adminNewEnrollment: {
    heading: "New enrollment received",
    preview: "A new Gen-Mumins registration is waiting for review.",
  },
  scholarshipConfirmation: {
    heading: "Scholarship application received",
    preview: "Your scholarship request is now in review.",
  },
  scholarshipAdminNotification: {
    heading: "Scholarship application review needed",
    preview: "A new scholarship application needs admin review.",
  },
  scholarshipApproved: {
    heading: "Scholarship approved",
    preview: "Your Gen-Mumins scholarship has been approved.",
  },
  scholarshipRejected: {
    heading: "Scholarship update",
    preview: "Your scholarship request has been reviewed.",
  },
  paymentReminder: {
    heading: "Payment reminder",
    preview: "A Gen-Mumins payment reminder is due.",
  },
  accountCreationConfirmation: {
    heading: "Account created",
    preview: "Your Gen-Mumins account is ready.",
  },
  contactAcknowledgement: {
    heading: "We received your message",
    preview: "Your Gen-Mumins contact enquiry is safely with the team.",
  },
  passwordReset: {
    heading: "Reset your password",
    preview: "Use this secure link to choose a new Gen-Mumins password.",
  },
  dashboardUnlocked: {
    heading: "Dashboard unlocked",
    preview: "Your Gen-Mumins learning dashboard is now ready.",
  },
} as const;
