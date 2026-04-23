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
      intro: `Jazakum Allahu khayran ${input.parentName}, your enrollment has been received and is now in progress.`,
      sections: [
        { label: "Registration ID", value: input.registrationId },
        { label: "Students", value: `${input.studentCount}` },
        { label: "Amount", value: `${input.currency} ${input.totalAmount}` },
      ],
      callToAction: { label: "Review registration", href: resolveHref("/registration") },
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
