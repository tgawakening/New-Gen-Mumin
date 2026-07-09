import "server-only";

import { db } from "@/lib/db";

const DEFAULT_HOUSES = [
  { slug: "red-house", name: "Dar Al-Arqam", virtue: "Courage", color: "#dc2626", sortOrder: 1 },
  { slug: "green-house", name: "House of Khadijah", virtue: "Sincerity", color: "#16a34a", sortOrder: 2 },
  { slug: "yellow-house", name: "House of Abu Bakr", virtue: "Truthfulness", color: "#facc15", sortOrder: 3 },
  { slug: "blue-house", name: "House of Umar", virtue: "Justice", color: "#2563eb", sortOrder: 4 },
  { slug: "white-house", name: "House of Fatimah", virtue: "Service", color: "#f8fafc", sortOrder: 5 },
] as const;

export const QUIZ_CORRECT_MESSAGE = "Excellent work! You got it correct and earned points for your house.";
export const QUIZ_INCORRECT_MESSAGE = "Good effort! Keep trying - your house is cheering you on!";
export const QUIZ_PARTICIPATION_MESSAGE = "Well done to everyone for taking part. Every effort counts.";

export async function ensureDefaultHouses() {
  for (const house of DEFAULT_HOUSES) {
    await db.house.upsert({
      where: { slug: house.slug },
      create: house,
      update: {
        name: house.name,
        virtue: house.virtue,
        color: house.color,
        sortOrder: house.sortOrder,
      },
    });
  }

  return db.house.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function ensureStudentHouseMembership(studentId: string) {
  const existing = await db.houseMembership.findUnique({
    where: { studentId },
    include: { house: true },
  });
  if (existing) return existing;

  const houses = await ensureDefaultHouses();
  const counts = await db.houseMembership.groupBy({
    by: ["houseId"],
    _count: { houseId: true },
  });
  const countByHouse = new Map(counts.map((entry) => [entry.houseId, entry._count.houseId]));
  const house = [...houses].sort((left, right) => {
    const countDiff = (countByHouse.get(left.id) ?? 0) - (countByHouse.get(right.id) ?? 0);
    return countDiff || left.sortOrder - right.sortOrder;
  })[0];

  return db.houseMembership.create({
    data: {
      studentId,
      houseId: house.id,
    },
    include: { house: true },
  });
}

export async function getHouseLeaderboard() {
  const houses = await ensureDefaultHouses();
  const rows = await db.housePointLedger.groupBy({
    by: ["houseId"],
    _sum: { points: true },
    _count: { houseId: true },
  });
  const totals = new Map(rows.map((row) => [row.houseId, { points: row._sum.points ?? 0, entries: row._count.houseId }]));

  return houses
    .map((house) => ({
      id: house.id,
      slug: house.slug,
      name: house.name,
      virtue: house.virtue,
      color: house.color,
      points: totals.get(house.id)?.points ?? 0,
      entries: totals.get(house.id)?.entries ?? 0,
    }))
    .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name));
}

export async function awardHousePointsForQuizAttempt(input: {
  attemptId: string;
  studentId: string;
  quizTitle: string;
  objectiveScore: number;
  correctCount: number;
  totalObjectiveQuestions: number;
  participationPoints?: number;
  streakBonusPoints?: number;
}) {
  const membership = await ensureStudentHouseMembership(input.studentId);
  const alreadyAwarded = await db.housePointLedger.findFirst({
    where: {
      sourceType: "QUIZ",
      sourceId: input.attemptId,
      studentId: input.studentId,
    },
  });
  if (alreadyAwarded) {
    return {
      house: membership.house,
      pointsAwarded: 0,
      bonusPoints: 0,
      participationPoints: 0,
    };
  }

  const participationPoints = Math.max(0, input.participationPoints ?? 1);
  const bonusPoints =
    input.totalObjectiveQuestions > 0 && input.correctCount === input.totalObjectiveQuestions
      ? Math.max(0, input.streakBonusPoints ?? 5)
      : 0;
  const pointsAwarded = Math.max(0, input.objectiveScore) + participationPoints + bonusPoints;

  if (pointsAwarded > 0) {
    await db.housePointLedger.create({
      data: {
        houseId: membership.houseId,
        studentId: input.studentId,
        points: pointsAwarded,
        reason: `${input.quizTitle}: ${input.correctCount}/${input.totalObjectiveQuestions} correct`,
        sourceType: "QUIZ",
        sourceId: input.attemptId,
      },
    });
  }

  return {
    house: membership.house,
    pointsAwarded,
    bonusPoints,
    participationPoints,
  };
}

