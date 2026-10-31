import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const MUM_CHARACTER_BADGES = [
  { key: "MUM_OF_WEEK", title: "Mum of the Week", description: "Recognises exceptional encouragement, participation, and support for her children and the Gen-Mumin community." },
  { key: "NURTURING_MUM", title: "The Nurturing Mum", description: "Nurtures faith, confidence, kindness, and beneficial habits at home." },
  { key: "ISLAMIC_ROLE_MODEL", title: "Islamic Role-Model Mum", description: "Models Islamic character, adab, patience, and sincerity for her family." },
  { key: "COMMUNITY_BUILDER_MUM", title: "Community Builder Mum", description: "Strengthens sisterhood and supports other families with generosity." },
  { key: "CONSISTENT_SUPPORTER_MUM", title: "The Consistent Supporter", description: "Reliably supports learning, attendance, communication, and steady growth." },
] as const;

export async function awardParentRecognition(input: { parentId: string; badgeKey: string; evidence: string; recipientName?: string; awardedByUserId: string; sourceId: string; featuredWeek?: string; studentIdForPoints?: string }) {
  const badge = MUM_CHARACTER_BADGES.find((item) => item.key === input.badgeKey);
  if (!badge) throw new Error("Choose an approved Mum character badge.");
  let award;
  try {
    award = await db.parentRecognitionAward.create({ data: { parentId: input.parentId, pointsStudentId: input.studentIdForPoints, badgeKey: badge.key, title: badge.title, description: badge.description, evidence: input.evidence, recipientName: input.recipientName, awardedByUserId: input.awardedByUserId, sourceId: input.sourceId, featuredWeek: input.featuredWeek, isPublic: false } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.parentRecognitionAward.findUnique({ where: { parentId_badgeKey_sourceId: { parentId: input.parentId, badgeKey: badge.key, sourceId: input.sourceId } } });
    if (!existing) throw error;
    award = await db.parentRecognitionAward.update({
      where: { id: existing.id },
      data: {
        title: badge.title,
        description: badge.description,
        evidence: input.evidence,
        recipientName: input.recipientName,
        featuredWeek: input.featuredWeek,
        pointsStudentId: existing.pointsStudentId || input.studentIdForPoints,
        isPublic: existing.isPublic,
        revokedAt: null,
        revokedByUserId: null,
        awardedAt: new Date(),
      },
    });
  }
  return award;
}
