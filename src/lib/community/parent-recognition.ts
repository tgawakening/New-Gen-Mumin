import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendParentRecognitionEmail } from "@/lib/email/notifications";

export const MUM_CHARACTER_BADGES = [
  { key: "MUM_OF_WEEK", title: "Mum of the Week", description: "Recognises exceptional encouragement, participation, and support for her children and the Gen-Mumin community." },
  { key: "NURTURING_MUM", title: "The Nurturing Mum", description: "Nurtures faith, confidence, kindness, and beneficial habits at home." },
  { key: "ISLAMIC_ROLE_MODEL", title: "Islamic Role-Model Mum", description: "Models Islamic character, adab, patience, and sincerity for her family." },
  { key: "COMMUNITY_BUILDER_MUM", title: "Community Builder Mum", description: "Strengthens sisterhood and supports other families with generosity." },
  { key: "CONSISTENT_SUPPORTER_MUM", title: "The Consistent Supporter", description: "Reliably supports learning, attendance, communication, and steady growth." },
] as const;

export async function awardParentRecognition(input: { parentId: string; badgeKey: string; evidence: string; recipientName?: string; awardedByUserId: string; sourceId: string; featuredWeek?: string }) {
  const badge = MUM_CHARACTER_BADGES.find((item) => item.key === input.badgeKey);
  if (!badge) throw new Error("Choose an approved Mum character badge.");
  let award;
  try {
    award = await db.parentRecognitionAward.create({ data: { parentId: input.parentId, badgeKey: badge.key, title: badge.title, description: badge.description, evidence: input.evidence, recipientName: input.recipientName, awardedByUserId: input.awardedByUserId, sourceId: input.sourceId, featuredWeek: input.featuredWeek } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.parentRecognitionAward.findUnique({ where: { parentId_badgeKey_sourceId: { parentId: input.parentId, badgeKey: badge.key, sourceId: input.sourceId } } });
    if (!existing) throw error;
    if (input.recipientName && existing.recipientName !== input.recipientName) return db.parentRecognitionAward.update({ where: { id: existing.id }, data: { recipientName: input.recipientName } });
    return existing;
  }
  const parent = await db.parentProfile.findUnique({ where: { id: input.parentId }, include: { user: true } });
  if (parent) {
    const name = input.recipientName || `${parent.user.firstName} ${parent.user.lastName ?? ""}`.trim() || parent.user.email;
    const href = `/parent-certificates/${award.certificateCode}`;
    await db.notification.create({ data: { userId: parent.userId, title: "Mum of the Week recognition awarded!", body: `${badge.title}: ${input.evidence}`, href } });
    if (!parent.user.email.toLowerCase().endsWith("@genmumin.local")) await sendParentRecognitionEmail({ toEmail: parent.user.email, recipientName: name, badgeTitle: badge.title, evidence: input.evidence, certificatePath: href });
  }
  return award;
}