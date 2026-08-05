import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const RUN_KEY = "restore-2026-08-04-1400-live-quiz-house-points-v1";
const WINDOW_START = new Date("2026-08-04T08:45:00.000Z");
const WINDOW_END = new Date("2026-08-04T10:00:00.000Z");

async function main() {
  const previousRun = await prisma.maintenanceRun.findUnique({ where: { key: RUN_KEY } });
  if (previousRun) {
    console.log("[house-points] Recovery already completed.");
    return;
  }
  const sessions = await prisma.quizLiveSession.findMany({
    where: { status: "ENDED", responses: { some: { answeredAt: { gte: WINDOW_START, lt: WINDOW_END } } } },
    include: { responses: { where: { answeredAt: { gte: WINDOW_START, lt: WINDOW_END }, isCorrect: true, housePointsAwarded: { gt: 0 } } } },
  });
  const responses = sessions.flatMap((session) => session.responses);
  if (!responses.length) {
    console.warn("[house-points] No saved correct responses found in the Aug 4 2 PM class window; recovery will retry on the next start.");
    return;
  }
  const memberships = await prisma.houseMembership.findMany({
    where: { studentId: { in: [...new Set(responses.map((response) => response.studentId))] } },
  });
  const membershipByStudent = new Map(memberships.map((membership) => [membership.studentId, membership]));
  if (responses.some((response) => !membershipByStudent.has(response.studentId))) {
    throw new Error("A saved quiz response belongs to a student without a house membership.");
  }

  let restoredAnswerPoints = 0;
  let restoredBonusPoints = 0;
  await prisma.$transaction(async (tx) => {
    for (const response of responses) {
      const existing = await tx.housePointLedger.findFirst({
        where: { sourceType: "QUIZ_LIVE_ANSWER", sourceId: response.id, studentId: response.studentId },
        select: { id: true },
      });
      if (existing) continue;
      await tx.housePointLedger.create({
        data: {
          houseId: membershipByStudent.get(response.studentId).houseId,
          studentId: response.studentId,
          points: response.housePointsAwarded,
          reason: "Aug 4 live quiz: restored correct-answer house points",
          sourceType: "QUIZ_LIVE_ANSWER",
          sourceId: response.id,
          awardedAt: response.answeredAt,
        },
      });
      restoredAnswerPoints += response.housePointsAwarded;
    }

    for (const session of sessions) {
      const questionCount = await tx.quizQuestion.count({ where: { quizId: session.quizId } });
      if (!questionCount) continue;
      const correctByStudent = new Map();
      for (const response of session.responses) {
        const questionIds = correctByStudent.get(response.studentId) ?? new Set();
        questionIds.add(response.questionId);
        correctByStudent.set(response.studentId, questionIds);
      }
      for (const [studentId, questionIds] of correctByStudent) {
        if (questionIds.size !== questionCount) continue;
        const existing = await tx.housePointLedger.findFirst({
          where: { sourceType: "QUIZ_LIVE_COMPLETE", sourceId: session.id, studentId },
          select: { id: true },
        });
        if (existing) continue;
        await tx.housePointLedger.create({
          data: {
            houseId: membershipByStudent.get(studentId).houseId,
            studentId,
            points: 10,
            reason: "Aug 4 live quiz: restored perfect-quiz bonus",
            sourceType: "QUIZ_LIVE_COMPLETE",
            sourceId: session.id,
            awardedAt: session.endedAt ?? session.updatedAt,
          },
        });
        restoredBonusPoints += 10;
      }
    }
    await tx.maintenanceRun.create({
      data: { key: RUN_KEY, details: { sessionIds: sessions.map((session) => session.id), responseCount: responses.length, restoredAnswerPoints, restoredBonusPoints } },
    });
  });
  console.log("[house-points] Restored " + restoredAnswerPoints + " answer point(s) and " + restoredBonusPoints + " bonus point(s) from " + sessions.length + " session(s).");
}
main().catch((error) => {
  console.error("[house-points] Recovery failed:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());