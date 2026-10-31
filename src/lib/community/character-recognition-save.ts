import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Save the badge and its student's Qabila credit together; retries repair missing credits. */
export async function saveCharacterRecognition(data: Prisma.RecognitionAwardUncheckedCreateInput, houseId: string) {
  const points = data.pointsBonus ?? 0;
  if (!Number.isInteger(points) || points < 0 || points > 500) throw new Error("Badge points must be a whole number between 0 and 500.");
  async function save() {
    return db.$transaction(async (tx) => {
      const where = { studentId_badgeKey_sourceType_sourceId: { studentId: data.studentId, badgeKey: data.badgeKey, sourceType: data.sourceType, sourceId: data.sourceId } };
      const previous = await tx.recognitionAward.findUnique({ where });
      const award = await tx.recognitionAward.upsert({ where, create: data, update: {} });
      // Preserve historical badge values; an award retry must not change its original bonus.
      if (award.isPublic && !award.revokedAt && award.pointsBonus > 0) {
        await tx.housePointLedger.createMany({ data: [{ studentId: award.studentId, houseId, points: award.pointsBonus, sourceType: `RECOGNITION_${award.badgeKey}`, sourceId: award.id, reason: `${award.title}: ${award.evidence || award.description}`, awardedAt: award.awardedAt }], skipDuplicates: true });
      }
      return { award, existing: Boolean(previous) };
    });
  }
  try { return await save(); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return save();
    throw error;
  }
}
