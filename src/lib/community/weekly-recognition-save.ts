import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// A weekly certificate and its credit must commit together. The ledger's unique
// student/source key makes retries safe, including repair of an older partial save.
export async function saveWeeklyRecognition(data: Prisma.RecognitionAwardUncheckedCreateInput, houseId: string) {
  return db.$transaction(async tx => {
    const where = { studentId_badgeKey_sourceType_sourceId: {
      studentId: data.studentId, badgeKey: data.badgeKey,
      sourceType: data.sourceType, sourceId: data.sourceId,
    } };
    const previous = await tx.recognitionAward.findUnique({ where });
    const award = await tx.recognitionAward.upsert({ where, create: { ...data, pointsBonus: 150 }, update: {} });
    if (award.isPublic && !award.revokedAt) {
      await tx.housePointLedger.createMany({ data: [{
        studentId: award.studentId, houseId, points: 150,
        sourceType: "RECOGNITION_MUMIN_OF_WEEK", sourceId: award.id,
        reason: award.title + ": " + (award.evidence ?? "Weekly character recognition"),
        awardedAt: award.awardedAt,
      }], skipDuplicates: true });
    }
    return { award, existing: Boolean(previous) };
  });
}
