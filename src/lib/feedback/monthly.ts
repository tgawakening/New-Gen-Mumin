import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { validMonth, validateAnswers } from "./monthly-questions";

// Programme leads listed in the faculty directory; no partial-name matching.
export const FEEDBACK_LEAD_EMAILS = ["mehranraziq@gmail.com", "umm.abdissamee@gmail.com"];
export function isFeedbackReviewer(user: { role: string; email: string; status?: string }) {
 return (!user.status || user.status === "ACTIVE") && (user.role === "ADMIN" || (user.role === "TEACHER" && FEEDBACK_LEAD_EMAILS.includes(user.email.toLowerCase())));
}
export async function canReviewMonthlyFeedback(userId: string) {
 const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, email: true, status: true } });
 return Boolean(user && isFeedbackReviewer(user));
}
export async function feedbackRecipients() {
 return db.user.findMany({ where: { status: "ACTIVE", OR: [{ role: "ADMIN" }, { role: "TEACHER", email: { in: FEEDBACK_LEAD_EMAILS } }] }, select: { id: true, email: true, role: true } });
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
 if (!details.parentName || !details.childName) throw new Error("Parent and child names are required.");
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
  const saved = await tx.monthlyParentFeedback.create({ data: { studentId: child.id, submittedById: userId, month: input.month, details: { ...details, programmes: [...new Set(child.enrollments.map(e => e.program.title))].join(", "), qabila: child.houseMembership?.house.name ?? "" }, answers: answers as Prisma.InputJsonValue } });
  for (const recipient of recipients) {
   await tx.notification.create({ data: { userId: recipient.id, title: "Monthly parent feedback", body: `${details.parentName} shared ${input.month} feedback for ${details.childName}.`, href: "/feedback/monthly?month=" + input.month } });
   await tx.billingEmailJob.create({ data: { key: `feedback:${saved.id}:${recipient.id}`, kind: "MONTHLY_FEEDBACK", status: "FEEDBACK_PENDING", toEmail: recipient.email, recordId: saved.id, payload: { recipientId: recipient.id } } });
  }
  return saved;
 }, { timeout: 15000 });
}
