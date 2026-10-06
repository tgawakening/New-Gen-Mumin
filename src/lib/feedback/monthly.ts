import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { validMonth, validateAnswers } from "./monthly-questions";

// Programme leads listed in the faculty directory; no partial-name matching.
export const FEEDBACK_LEAD_EMAILS = ["mehranraziq@gmail.com", "umm.abdissamee@gmail.com"];
export function isFeedbackReviewer(user: { role: string; email: string; status?: string }) {
 return (!user.status || user.status === "ACTIVE") && (user.role === "ADMIN" || user.role === "COMMUNICATIONS" || (user.role === "TEACHER" && FEEDBACK_LEAD_EMAILS.includes(user.email.toLowerCase())));
}
export async function canReviewMonthlyFeedback(userId: string) {
 const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, email: true, status: true } });
 return Boolean(user && isFeedbackReviewer(user));
}
export async function feedbackRecipients() {
 return db.user.findMany({ where: { status: "ACTIVE", OR: [{ role: "ADMIN" }, { role: "COMMUNICATIONS" }, { role: "TEACHER", email: { in: FEEDBACK_LEAD_EMAILS } }] }, select: { id: true, email: true, role: true } });
}
export type FeedbackDetails = { parentName: string; childName: string; age: string; country: string; timezone: string; programmes: string; qabila: string };
export function validateDetails(input: unknown): Omit<FeedbackDetails, "programmes" | "qabila"> {
 if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Please check your family details.");
 const raw = input as Record<string, unknown>;
 const details = { parentName: "", childName: "", age: "", country: "", timezone: "" };
 for (const key of Object.keys(details) as (keyof typeof details)[]) {
  if (typeof raw[key] !== "string" || (raw[key] as string).length > 150) throw new Error("Please check " + key + ".");
  details[key] = (raw[key] as string).trim();
 }
 if (Object.values(details).some(value => !value)) throw new Error("Please complete the parent name, child name, age, country and time zone.");
 if (details.age && (!/^\d{1,2}$/.test(details.age) || Number(details.age) < 1)) throw new Error("Please check your child's age.");
 return details;
}
export async function submitMonthlyFeedback(userId: string, input: { studentId: string; month: string; details: unknown; answers: unknown }) {
 if (!validMonth(input.month)) throw new Error("Choose the current month or a previous month.");
 const user = await db.user.findFirst({ where: { id: userId, role: "PARENT", status: "ACTIVE" }, select: { id: true } });
 if (!user) throw new Error("Please sign in with an active parent account.");
 const answers = validateAnswers(input.answers), details = validateDetails(input.details);
 const recipients = await feedbackRecipients();
 return db.$transaction(async tx => {
  const child = await tx.studentProfile.findFirst({ where: { id: input.studentId, parents: { some: { parent: { userId } } } }, include: { enrollments: { include: { program: true } }, houseMembership: { include: { house: true } } } });
  if (!child) throw new Error("This child is not linked to your parent account.");
  const saved = await tx.monthlyParentFeedback.create({ data: { schemaVersion: 2, studentId: child.id, submittedById: userId, month: input.month, details: { ...details, programmes: [...new Set(child.enrollments.map(e => e.program.title))].join(", "), qabila: child.houseMembership?.house.name ?? "" }, answers: answers as Prisma.InputJsonValue } });
  for (const recipient of recipients) {
   await tx.notification.create({ data: { userId: recipient.id, monthlyFeedbackId: saved.id, title: "Monthly parent feedback", body: `${details.parentName} shared ${input.month} feedback for ${details.childName}.`, href: "/feedback/monthly?month=" + input.month } });
   await tx.billingEmailJob.create({ data: { key: `feedback:${saved.id}:v${saved.version}:${recipient.id}`, kind: "MONTHLY_FEEDBACK", status: "FEEDBACK_PENDING", toEmail: recipient.email, recordId: saved.id, payload: { recipientId: recipient.id, version: saved.version } } });
  }
  return saved;
 }, { timeout: 15000 });
}

export class FeedbackConflict extends Error {}
export async function changeMonthlyFeedback(userId: string, input: { id: string; version: number; details?: unknown; answers?: unknown }, remove = false) {
 if (typeof input.id !== "string" || !input.id || !Number.isInteger(input.version) || input.version < 1) throw new Error("Please reload this response before making changes.");
 const active = await db.user.findFirst({ where: { id: userId, role: "PARENT", status: "ACTIVE" }, select: { id: true } });
 if (!active) throw new Error("Please sign in with an active parent account.");
 const details = remove ? null : validateDetails(input.details);
 const answers = remove ? null : validateAnswers(input.answers);
 const recipients = remove ? [] : await feedbackRecipients();
 return db.$transaction(async tx => {
  const response = await tx.monthlyParentFeedback.findFirst({ where: { id: input.id, submittedById: userId, student: { parents: { some: { parent: { userId } } } } } });
  if (!response) throw new FeedbackConflict("This response is no longer available to edit. Please reload the page.");
  if (response.schemaVersion === 1) await linkLegacyNotifications(tx, response);
  if (remove) {
   const result = await tx.monthlyParentFeedback.deleteMany({ where: { id: response.id, submittedById: userId, version: input.version } });
   if (!result.count) throw new FeedbackConflict("This response has changed in another tab. Reload before deleting it.");
   // Linked portal notifications are removed by the database cascade.
   await tx.billingEmailJob.deleteMany({ where: { kind: "MONTHLY_FEEDBACK", recordId: response.id } });
   return null;
  }
  const updatedDetails = { ...(response.details as Record<string, string>), ...details };
  const changed = await tx.monthlyParentFeedback.updateMany({ where: { id: response.id, submittedById: userId, version: input.version }, data: { schemaVersion: 2, details: updatedDetails, answers: answers as Prisma.InputJsonValue, version: { increment: 1 } } });
  if (!changed.count) throw new FeedbackConflict("This response has changed in another tab. Reload before saving so no answers are overwritten.");
  const saved = await tx.monthlyParentFeedback.findUniqueOrThrow({ where: { id: response.id } });
  await tx.notification.deleteMany({ where: { monthlyFeedbackId: saved.id } });
  await tx.billingEmailJob.updateMany({ where: { kind: "MONTHLY_FEEDBACK", recordId: saved.id, status: { in: ["FEEDBACK_PENDING", "FEEDBACK_PROCESSING"] } }, data: { status: "CANCELLED", lockToken: null, lockedUntil: null } });
  for (const recipient of recipients) {
   await tx.notification.create({ data: { monthlyFeedbackId: saved.id, userId: recipient.id, title: "Monthly feedback updated", body: `${updatedDetails.parentName} updated ${saved.month} feedback for ${updatedDetails.childName}.`, href: "/feedback/monthly?month=" + saved.month } });
   await tx.billingEmailJob.create({ data: { key: `feedback:${saved.id}:v${saved.version}:${recipient.id}`, kind: "MONTHLY_FEEDBACK", status: "FEEDBACK_PENDING", toEmail: recipient.email, recordId: saved.id, payload: { recipientId: recipient.id, version: saved.version } } });
  }
  return saved;
 }, { timeout: 15000 });
}

// Old submissions predate the explicit notification relation. Match only an
// unambiguous recipient/body/time combination, never another family's alert.
async function linkLegacyNotifications(tx: Prisma.TransactionClient, response: { id: string; month: string; details: Prisma.JsonValue; submittedAt: Date }) {
 const d = response.details as Record<string, string>;
 const jobs = await tx.billingEmailJob.findMany({ where: { kind: "MONTHLY_FEEDBACK", recordId: response.id }, select: { payload: true } });
 for (const job of jobs) {
  const recipientId = (job.payload as { recipientId?: string }).recipientId;
  if (!recipientId) continue;
  const matches = await tx.notification.findMany({ where: { monthlyFeedbackId: null, userId: recipientId, title: "Monthly parent feedback", href: "/feedback/monthly?month=" + response.month, body: d.parentName + " shared " + response.month + " feedback for " + d.childName + ".", createdAt: { gte: response.submittedAt, lte: new Date(response.submittedAt.getTime() + 30000) } }, select: { id: true } });
  if (matches.length === 1) await tx.notification.updateMany({ where: { id: matches[0].id, monthlyFeedbackId: null }, data: { monthlyFeedbackId: response.id } });
 }
}
