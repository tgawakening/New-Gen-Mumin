import "server-only";

import { MissionKind, MissionQuestionType, MissionStatus } from "@prisma/client";

import { db } from "@/lib/db";

const STARTER_HOUSES = [
  {
    slug: "ilm",
    name: "Blue House",
    virtue: "Learning",
    description: "Earn points through learning, effort, attendance, quizzes, and tasks.",
    color: "#245d85",
  },
  {
    slug: "amanah",
    name: "Green House",
    virtue: "Teamwork",
    description: "Earn points through responsibility, participation, and steady teamwork.",
    color: "#2f6b4b",
  },
  {
    slug: "sabr",
    name: "Yellow House",
    virtue: "Consistency",
    description: "Earn points through regular practice, reflections, and weekly progress.",
    color: "#c27a2c",
  },
  {
    slug: "shujaah",
    name: "Red House",
    virtue: "Confidence",
    description: "Earn points through courage, leadership, and thoughtful participation.",
    color: "#9a4545",
  },
] as const;

const STARTER_HOUSE_SLUGS = STARTER_HOUSES.map((house) => house.slug);

const STARTER_MISSIONS = [
  {
    title: "Seerah question of the day",
    description: "A quick check-in to keep the Prophet's life present in daily learning.",
    kind: MissionKind.DAILY,
    basePoints: 25,
    questions: [
      {
        prompt: "Which quality helps a house team grow?",
        type: MissionQuestionType.MCQ,
        points: 5,
        answer: "Teamwork",
        choices: ["Teamwork", "Carelessness", "Showing off", "Anger"],
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
export const SUNNAH_TRACKER_PREFIX = "__SUNNAH_TRACKER__:";

export function buildSunnahTrackerDescription(description?: string | null) {
  return `${SUNNAH_TRACKER_PREFIX}${JSON.stringify({ description: description?.trim() || null })}`;
}

export function parseSunnahTrackerDescription(description?: string | null) {
  if (!description?.startsWith(SUNNAH_TRACKER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(description.slice(SUNNAH_TRACKER_PREFIX.length)) as { description?: unknown };
    return { description: typeof parsed.description === "string" ? parsed.description : null };
  } catch {
    return { description: null };
  }
}

export function isSunnahTrackerMission(mission: { description?: string | null }) {
  return Boolean(parseSunnahTrackerDescription(mission.description));
}
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

  const houses = await db.house.findMany({ where: { slug: { in: [...STARTER_HOUSE_SLUGS] } }, orderBy: { sortOrder: "asc" } });
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
  const houses = await db.house.findMany({ where: { slug: { in: [...STARTER_HOUSE_SLUGS] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const houseRows = await db.housePointLedger.groupBy({
    by: ["houseId"],
    _sum: { points: true },
    _count: { houseId: true },
  });
  const totals = new Map(houseRows.map((row) => [row.houseId, { points: row._sum.points ?? 0, entries: row._count.houseId }]));
  const leaderboard = houses
    .map((house) => ({
      id: house.id,
      slug: house.slug,
      name: house.name,
      virtue: house.virtue,
      color: house.color,
      description: house.description,
      points: totals.get(house.id)?.points ?? 0,
      entries: totals.get(house.id)?.entries ?? 0,
      isMine: house.id === membership.houseId,
    }))
    .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name));

  return {
    membership,
    missions,
    pointLedger,
    leaderboard,
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
  const sunnahTracker = isSunnahTrackerMission(mission);
  const generalReflection = String(input.formData.get("reflection") || "").trim();
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
    const rawAnswer = input.formData.get(`answer-${question.id}`);
    const answer = rawAnswer === null && sunnahTracker ? "false" : String(rawAnswer || "").trim();
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

  if (generalReflection) {
    reflection = generalReflection;
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
      sourceType: sunnahTracker ? "SUNNAH_TRACKER" : "MISSION",
      sourceId: mission.id,
    },
  });

  return { score, pointsAwarded };
}

