import { PrismaClient } from "@prisma/client";

// Run after deploying actual-score quiz credits. Default mode reports only totals.
const apply = process.argv.includes("--apply");
const raw = process.env.APP_DATABASE_URL || process.env.GEN_MUMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!raw) throw new Error("Set the application's database environment before running this script.");
const url = raw.trim().replace(/^["']|["']$/g, "").replace(/ssl-mode=REQUIRED/gi, "sslaccept=accept_invalid_certs");
const db = new PrismaClient({ datasources: { db: { url } } });

async function report(client) {
  const rows = await client.$queryRaw`
    SELECT COUNT(*) AS responses,
      COALESCE(SUM(CASE WHEN l.id IS NOT NULL AND l.points <> r.housePointsAwarded AND l.points <> r.earnedPoints THEN 1 ELSE 0 END), 0) AS conflicts,
      COALESCE(SUM(CASE WHEN r.earnedPoints < 0 OR (r.earnedPoints > 0 AND l.id IS NULL AND m.id IS NULL) THEN 1 ELSE 0 END), 0) AS invalid,
      COALESCE(SUM(CASE WHEN COALESCE(l.points, 0) <> r.earnedPoints THEN 1 ELSE 0 END), 0) AS creditsToRepair,
      COALESCE(SUM(CASE WHEN r.housePointsAwarded <> r.earnedPoints THEN 1 ELSE 0 END), 0) AS responseMetadataToRepair,
      COALESCE(SUM(r.earnedPoints - COALESCE(l.points, 0)), 0) AS pointsAdjustment
    FROM QuizLiveResponse r
    LEFT JOIN HousePointLedger l ON l.studentId = r.studentId AND l.sourceType = 'QUIZ_LIVE_ANSWER' AND l.sourceId = r.id
    LEFT JOIN HouseMembership m ON m.studentId = r.studentId
  `;
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
}

try {
  const plan = await report(db);
  console.log(JSON.stringify({ mode: apply ? "apply" : "report-only", ...plan }, null, 2));
  if (apply) {
    await db.$transaction(async tx => {
      const current = await report(tx);
      if (current.conflicts || current.invalid) throw new Error("Manual credit conflicts or invalid/missing membership records need review. No repair applied.");
      await tx.$executeRaw`
        UPDATE HousePointLedger l
        JOIN QuizLiveResponse r ON l.studentId = r.studentId AND l.sourceType = 'QUIZ_LIVE_ANSWER' AND l.sourceId = r.id
        SET l.points = r.earnedPoints, l.reason = CONCAT('Live quiz answer: ', r.earnedPoints, ' earned Qabila points')
        WHERE r.earnedPoints >= 0 AND l.points = r.housePointsAwarded AND l.points <> r.earnedPoints
      `;
      await tx.$executeRaw`
        INSERT INTO HousePointLedger (id, houseId, studentId, points, reason, sourceType, sourceId, awardedAt)
        SELECT CONCAT('quiz-credit-repair:', r.id), m.houseId, r.studentId, r.earnedPoints,
          CONCAT('Live quiz answer: ', r.earnedPoints, ' earned Qabila points'), 'QUIZ_LIVE_ANSWER', r.id, r.answeredAt
        FROM QuizLiveResponse r
        JOIN HouseMembership m ON m.studentId = r.studentId
        LEFT JOIN HousePointLedger l ON l.studentId = r.studentId AND l.sourceType = 'QUIZ_LIVE_ANSWER' AND l.sourceId = r.id
        WHERE l.id IS NULL AND r.earnedPoints > 0
      `;
      await tx.$executeRaw`
        UPDATE QuizLiveResponse r
        LEFT JOIN HousePointLedger l ON l.studentId = r.studentId AND l.sourceType = 'QUIZ_LIVE_ANSWER' AND l.sourceId = r.id
        SET r.housePointsAwarded = COALESCE(l.points, 0)
        WHERE r.earnedPoints >= 0 AND COALESCE(l.points, 0) = r.earnedPoints AND r.housePointsAwarded <> r.earnedPoints
      `;
      const after = await report(tx);
      if (after.creditsToRepair || after.responseMetadataToRepair || after.conflicts || after.invalid) throw new Error("Repair verification failed; transaction rolled back.");
    }, { maxWait: 10000, timeout: 60000 });
    console.log("Verified: answer credits now equal saved earned scores. Quiz bonuses and other activity credits were preserved.");
  }
} finally { await db.$disconnect(); }
