import "server-only";

import { MissionKind, MissionQuestionType, MissionStatus } from "@prisma/client";

import { db } from "@/lib/db";

const STARTER_HOUSES = [
  {
    slug: "ilm",
    name: "House of Ilm",
    virtue: "Knowledge",
    description: "Earn points through learning, curiosity, and careful revision.",
    color: "#245d85",
  },
  {
    slug: "amanah",
    name: "House of Amanah",
    virtue: "Trust",
    description: "Earn points through responsibility, honesty, and reliable teamwork.",
    color: "#2f6b4b",
  },
  {
    slug: "sabr",
    name: "House of Sabr",
    virtue: "Patience",
    description: "Earn points through consistency, reflection, and steady practice.",
    color: "#8a6326",
  },
  {
    slug: "shujaah",
    name: "House of Shuja'ah",
    virtue: "Courage",
    description: "Earn points through confidence, leadership, and thoughtful participation.",
    color: "#9a4545",
  },
] as const;

const STARTER_MISSIONS = [
  {
    title: "Seerah question of the day",
    description: "A quick check-in to keep the Prophet's life present in daily learning.",
    kind: MissionKind.DAILY,
    basePoints: 25,
    questions: [
      {
        prompt: "Which quality is most connected to Amanah?",
        type: MissionQuestionType.MCQ,
        points: 5,
        answer: "Trustworthiness",
        choices: ["Trustworthiness", "Carelessness", "Showing off", "Anger"],
      },
      {
        prompt: "The Prophet Muhammad was known as Al-Amin before prophethood.",
        type: MissionQuestionType.TRUE_FALSE,
        points: 5,
        answer: "true",
      },
    ],
  },
  {
    title: "Adab reflection challenge",
    description: "Write one practical way you can show better adab this week.",
    kind: MissionKind.REFLECTION,
    basePoints: 20,
    questions: [
      {
        prompt: "What is one adab goal you want to practice this week?",
        type: MissionQuestionType.SHORT_REFLECTION,
        points: 10,
        answer: "",
      },
    ],
  },
] as const;

function deterministicIndex(seed: string, length: number) {
  const score = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return score % length;
}

export async function ensureQuestFoundation() {
  await db.$transaction(async (tx) => {
    for (const [index, house] of STARTER_HOUSES.entries()) {
      await tx.house.upsert({
        where: { slug: house.slug },
        update: {
          name: house.name,
          virtue: house.virtue,
          description: house.description,
          color: house.color,
          sortOrder: index,
        },
        create: {
          ...house,
          sortOrder: index,
        },
      });
    }

    const existingMissionCount = await tx.mission.count({
      where: { status: MissionStatus.PUBLISHED },
    });
    if (existingMissionCount > 0) return;

    for (const mission of STARTER_MISSIONS) {
      await tx.mission.create({
        data: {
          title: mission.title,
          description: mission.description,
          kind: mission.kind,
          status: MissionStatus.PUBLISHED,
          basePoints: mission.basePoints,
          questions: {
            create: mission.questions.map((question, index) => ({
              prompt: question.prompt,
              type: question.type,
              points: question.points,
              sortOrder: index + 1,
              answerKey: question.answer ? { answer: question.answer } : undefined,
              meta: "choices" in question ? { choices: question.choices } : undefined,
            })),
          },
        },
      });
    }
  });
}

export async function ensureStudentHouse(studentId: string) {
  await ensureQuestFoundation();

  const existing = await db.houseMembership.findUnique({
    where: { studentId },
    include: { house: true },
  });
  if (existing) return existing;

  const houses = await db.house.findMany({ orderBy: { sortOrder: "asc" } });
  const house = houses[deterministicIndex(studentId, houses.length)];

  return db.houseMembership.create({
    data: {
      studentId,
      houseId: house.id,
    },
    include: { house: true },
  });
}

export async function getStudentQuestData(studentId: string, programIds: string[]) {
  const membership = await ensureStudentHouse(studentId);
  const now = new Date();
  const missions = await db.mission.findMany({
    where: {
      status: MissionStatus.PUBLISHED,
      OR: [{ programId: null }, { programId: { in: programIds.length ? programIds : ["__none__"] } }],
      AND: [
        { OR: [{ opensAt: null }, { opensAt: { lte: now } }] },
        { OR: [{ closesAt: null }, { closesAt: { gte: now } }] },
      ],
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      attempts: {
        where: { studentId },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
      },
    },
  });
  const pointLedger = await db.housePointLedger.findMany({
    where: { studentId },
    orderBy: { awardedAt: "desc" },
    take: 12,
  });
  const houseTotal = await db.housePointLedger.aggregate({
    where: { houseId: membership.houseId },
    _sum: { points: true },
  });
  const studentTotal = await db.housePointLedger.aggregate({
    where: { studentId },
    _sum: { points: true },
  });

  return {
    membership,
    missions,
    pointLedger,
    houseTotal: houseTotal._sum.points ?? 0,
    studentTotal: studentTotal._sum.points ?? 0,
  };
}

export async function submitMissionAttempt(input: {
  missionId: string;
  studentId: string;
  studentName: string;
  formData: FormData;
}) {
  const mission = await db.mission.findUnique({
    where: { id: input.missionId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!mission || mission.status !== MissionStatus.PUBLISHED) {
    throw new Error("Mission is not available.");
  }

  const membership = await ensureStudentHouse(input.studentId);
  const attemptCount = await db.missionAttempt.count({
    where: { missionId: mission.id, studentId: input.studentId },
  });
  let score = 0;
  let reflection = "";

  const attempt = await db.missionAttempt.create({
    data: {
      missionId: mission.id,
      studentId: input.studentId,
      attemptNumber: attemptCount + 1,
      submittedAt: new Date(),
    },
  });

  for (const question of mission.questions) {
    const answer = String(input.formData.get(`answer-${question.id}`) || "").trim();
    const answerKey = question.answerKey as { answer?: string } | null;
    const correctAnswer = answerKey?.answer?.trim().toLowerCase();
    const isObjective = ["MCQ", "TRUE_FALSE", "FILL_IN_BLANK"].includes(question.type);
    const isCorrect = Boolean(isObjective && correctAnswer && answer.toLowerCase() === correctAnswer);
    if (isObjective && isCorrect) score += question.points;
    if (question.type === MissionQuestionType.SHORT_REFLECTION && answer) {
      score += question.points;
      reflection = answer;
    }

    await db.missionAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        answer: { value: answer },
        isCorrect: isObjective ? isCorrect : null,
        earnedPoints: isObjective ? (isCorrect ? question.points : 0) : question.type === MissionQuestionType.SHORT_REFLECTION && answer ? question.points : 0,
      },
    });
  }

  const pointsAwarded = mission.basePoints + score;
  await db.missionAttempt.update({
    where: { id: attempt.id },
    data: { score, pointsAwarded, reflection: reflection || null },
  });
  await db.housePointLedger.create({
    data: {
      houseId: membership.houseId,
      studentId: input.studentId,
      points: pointsAwarded,
      reason: `${input.studentName} completed ${mission.title}`,
      sourceType: "MISSION",
      sourceId: mission.id,
    },
  });

  return { score, pointsAwarded };
}
