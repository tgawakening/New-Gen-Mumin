import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/client";
import {
  emailTemplateCatalog,
  renderGenMuminsEmailTemplate,
} from "@/lib/email/templates";

function resolveHref(path: string) {
  if (!env.success) return path;
  return new URL(path, env.data.APP_URL).toString();
}

async function sendAdminFacingEmail(
  template: string,
  subject: string,
  intro: string,
  sections: Array<{ label: string; value: string }>,
) {
  if (!env.success || !env.data.ADMIN_NOTIFICATION_EMAIL) return;

  await sendTransactionalEmail({
    toEmail: env.data.ADMIN_NOTIFICATION_EMAIL,
    subject,
    template,
    html: renderGenMuminsEmailTemplate({
      heading: subject,
      preview: intro,
      intro,
      sections,
      callToAction: { label: "Open admin dashboard", href: resolveHref("/admin") },
    }),
  });
}

export async function sendAccountCreationConfirmationEmail(input: {
  toEmail: string;
  firstName: string;
  loginUrl: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.accountCreationConfirmation.heading,
    template: "accountCreationConfirmation",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.accountCreationConfirmation.heading,
      preview: emailTemplateCatalog.accountCreationConfirmation.preview,
      intro: `Assalamu alaikum ${input.firstName}, your Gen-Mumins account is now ready.`,
      sections: [
        { label: "Email", value: input.toEmail },
        { label: "Next step", value: "Use your email and password to access the platform." },
      ],
      callToAction: { label: "Open login", href: resolveHref(input.loginUrl) },
    }),
  });
}

export async function sendEnrollmentConfirmationEmail(input: {
  toEmail: string;
  parentName: string;
  registrationId: string;
  totalAmount: number;
  currency: string;
  studentCount: number;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.enrollmentConfirmation.heading,
    template: "enrollmentConfirmation",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.enrollmentConfirmation.heading,
      preview: emailTemplateCatalog.enrollmentConfirmation.preview,
      intro: `Assalamu alaikum ${input.parentName}, your registration draft has been saved. Complete your payment now to confirm your child's enrollment.`,
      sections: [
        { label: "Registration ID", value: input.registrationId },
        { label: "Students", value: `${input.studentCount}` },
        { label: "Amount", value: `${input.currency} ${input.totalAmount}` },
        { label: "Status", value: "Payment pending" },
      ],
      callToAction: {
        label: "Complete pending payment",
        href: resolveHref(`/registration/pending/${input.registrationId}`),
      },
    }),
  });
}

export async function sendAdminNewEnrollmentEmail(input: {
  parentName: string;
  parentEmail: string;
  registrationId: string;
  totalAmount: number;
  currency: string;
  studentCount: number;
  country: string;
}) {
  await sendAdminFacingEmail(
    "adminNewEnrollment",
    emailTemplateCatalog.adminNewEnrollment.heading,
    emailTemplateCatalog.adminNewEnrollment.preview,
    [
      { label: "Parent", value: `${input.parentName} (${input.parentEmail})` },
      { label: "Registration", value: input.registrationId },
      { label: "Students", value: `${input.studentCount}` },
      { label: "Amount", value: `${input.currency} ${input.totalAmount}` },
      { label: "Country", value: input.country },
    ],
  );
}

export async function sendScholarshipConfirmationEmail(input: {
  toEmail: string;
  parentName: string;
  requestedPercent: number;
  offerTitle: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.scholarshipConfirmation.heading,
    template: "scholarshipConfirmation",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.scholarshipConfirmation.heading,
      preview: emailTemplateCatalog.scholarshipConfirmation.preview,
      intro: `Assalamu alaikum ${input.parentName}, your scholarship application has been received for review.`,
      sections: [
        { label: "Programme", value: input.offerTitle },
        { label: "Requested support", value: `${input.requestedPercent}%` },
      ],
      callToAction: { label: "View scholarship page", href: resolveHref("/scholarship-registration") },
    }),
  });
}

export async function sendScholarshipAdminNotificationEmail(input: {
  parentName: string;
  parentEmail: string;
  requestedPercent: number;
  offerTitle: string;
}) {
  await sendAdminFacingEmail(
    "scholarshipAdminNotification",
    emailTemplateCatalog.scholarshipAdminNotification.heading,
    emailTemplateCatalog.scholarshipAdminNotification.preview,
    [
      { label: "Parent", value: `${input.parentName} (${input.parentEmail})` },
      { label: "Programme", value: input.offerTitle },
      { label: "Requested support", value: `${input.requestedPercent}%` },
    ],
  );
}

export async function sendScholarshipApprovedEmail(input: {
  toEmail: string;
  parentName: string;
  approvedPercent: number;
  reviewNote: string;
  approvalToken: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.scholarshipApproved.heading,
    template: "scholarshipApproved",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.scholarshipApproved.heading,
      preview: emailTemplateCatalog.scholarshipApproved.preview,
      intro: `Assalamu alaikum ${input.parentName}, your scholarship request has been approved.`,
      sections: [
        { label: "Approved support", value: `${input.approvedPercent}%` },
        { label: "Review note", value: input.reviewNote },
        { label: "Approval token", value: input.approvalToken },
      ],
      callToAction: { label: "Open registration", href: resolveHref("/registration") },
    }),
  });
}

export async function sendScholarshipRejectedEmail(input: {
  toEmail: string;
  parentName: string;
  reviewNote: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.scholarshipRejected.heading,
    template: "scholarshipRejected",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.scholarshipRejected.heading,
      preview: emailTemplateCatalog.scholarshipRejected.preview,
      intro: `Assalamu alaikum ${input.parentName}, your scholarship application has now been reviewed.`,
      sections: [{ label: "Review note", value: input.reviewNote }],
      callToAction: { label: "View scholarship page", href: resolveHref("/scholarship-registration") },
    }),
  });
}

export async function sendManualPaymentSubmittedEmail(input: {
  orderNumber: string;
  parentName: string;
  parentEmail: string;
  method: string;
  referenceKey: string;
}) {
  await sendAdminFacingEmail(
    "manualPaymentSubmitted",
    "Manual payment proof submitted",
    "A new manual payment proof is waiting for admin review.",
    [
      { label: "Order", value: input.orderNumber },
      { label: "Parent", value: `${input.parentName} (${input.parentEmail})` },
      { label: "Method", value: input.method },
      { label: "Reference", value: input.referenceKey },
    ],
  );
}

export async function sendContactAcknowledgementEmail(input: {
  toEmail: string;
  name: string;
  subject: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.contactAcknowledgement.heading,
    template: "contactAcknowledgement",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.contactAcknowledgement.heading,
      preview: emailTemplateCatalog.contactAcknowledgement.preview,
      intro: `Jazakum Allahu khayran ${input.name}, we have received your message and the Gen-Mumins team will review it shortly.`,
      sections: [{ label: "Subject", value: input.subject }],
      callToAction: { label: "Visit Gen-Mumins", href: resolveHref("/") },
    }),
  });
}

export async function sendAdminContactNotificationEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  await sendAdminFacingEmail(
    "adminContactMessage",
    "New contact message received",
    "A new contact form message needs review.",
    [
      { label: "From", value: `${input.name} (${input.email})` },
      { label: "Subject", value: input.subject },
      { label: "Message", value: input.message },
    ],
  );
}

export async function sendDashboardUnlockedEmail(input: {
  toEmail: string;
  parentName: string;
  dashboardUrl: string;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: emailTemplateCatalog.dashboardUnlocked.heading,
    template: "dashboardUnlocked",
    html: renderGenMuminsEmailTemplate({
      heading: emailTemplateCatalog.dashboardUnlocked.heading,
      preview: emailTemplateCatalog.dashboardUnlocked.preview,
      intro: `Assalamu alaikum ${input.parentName}, your payment has been confirmed and the Gen-Mumins dashboard is now unlocked.`,
      sections: [
        {
          label: "Next step",
          value: "Log in to review your children, courses, attendance, schedule, and payment status.",
        },
      ],
      callToAction: { label: "Open your dashboard", href: resolveHref(input.dashboardUrl) },
    }),
  });
}

export async function sendPaymentCompletedEmail(input: {
  toEmail: string;
  parentName: string;
  orderNumber: string;
  amount: number;
  currency: string;
  gateway: string;
  childCount?: number;
}) {
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    subject: "Payment confirmed",
    template: "dashboardUnlocked",
    html: renderGenMuminsEmailTemplate({
      heading: "Payment confirmed",
      preview: "Your Gen-Mumins payment has been confirmed.",
      intro: `Assalamu alaikum ${input.parentName}, your payment has been confirmed and your registration is now completed.`,
      sections: [
        { label: "Order", value: input.orderNumber },
        { label: "Gateway", value: input.gateway },
        { label: "Amount", value: `${input.currency} ${input.amount}` },
        { label: "Students", value: `${input.childCount ?? 1}` },
        { label: "Status", value: "Completed" },
      ],
      callToAction: { label: "Open your dashboard", href: resolveHref("/parent") },
    }),
  });
}

export async function sendAdminPaymentCompletedEmail(input: {
  parentName: string;
  parentEmail: string;
  orderNumber: string;
  amount: number;
  currency: string;
  gateway: string;
  childCount?: number;
}) {
  await sendAdminFacingEmail(
    "adminNewEnrollment",
    "Payment completed",
    "A Gen-Mumins order has been completed and the registration is now unlocked.",
    [
      { label: "Parent", value: `${input.parentName} (${input.parentEmail})` },
      { label: "Order", value: input.orderNumber },
      { label: "Gateway", value: input.gateway },
      { label: "Amount", value: `${input.currency} ${input.amount}` },
      { label: "Students", value: `${input.childCount ?? 1}` },
      { label: "Status", value: "Completed" },
    ],
  );
}
