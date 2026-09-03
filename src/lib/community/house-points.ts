import "server-only";

import { db } from "@/lib/db";

export const CANONICAL_HOUSES = [
  {
    slug: "red-house",
    name: "Red House",
    virtue: "Courage",
    description: "Earn points through courage, leadership, and thoughtful participation.",
    color: "#dc2626",
    sortOrder: 1,
  },
  {
    slug: "green-house",
    name: "Green House",
    virtue: "Growth",
    description: "Earn points through responsibility, participation, and steady teamwork.",
    color: "#16a34a",
    sortOrder: 2,
  },
  {
    slug: "yellow-house",
    name: "Yellow House",
    virtue: "Joy",
    description: "Earn points through regular practice, reflections, and weekly progress.",
    color: "#facc15",
    sortOrder: 3,
  },
  {
    slug: "blue-house",
    name: "Blue House",
    virtue: "Wisdom",
    description: "Earn points through learning, effort, attendance, quizzes, and tasks.",
    color: "#2563eb",
    sortOrder: 4,
  },
  {
    slug: "white-house",
    name: "White House",
    virtue: "Sincerity",
    description: "Earn points through sincere effort, adab, reflection, and kindness.",
    color: "#f8fafc",
    sortOrder: 5,
  },
] as const;

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const PAID_REGISTRATION_STATUSES = ["PAID", "CONVERTED"] as const;

const LEGACY_HOUSE_SLUGS: Record<string, (typeof CANONICAL_HOUSES)[number]["slug"]> = {
  ilm: "blue-house",
  amanah: "green-house",
  sabr: "yellow-house",
  shujaah: "red-house",
};

export const QUIZ_CORRECT_MESSAGE = "Excellent work! You got it correct and earned points for your house.";
export const QUIZ_INCORRECT_MESSAGE = "Good effort! Keep trying - your house is cheering you on!";
export const QUIZ_PARTICIPATION_MESSAGE = "Well done to everyone for taking part. Every effort counts.";

type HouseLike = {
  id?: string;
  slug?: string | null;
  name?: string | null;
  virtue?: string | null;
  color?: string | null;
  description?: string | null;
  sortOrder?: number | null;
};

function normalText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function canonicalHouseSlug(house?: HouseLike | null) {
  const slug = normalText(house?.slug);
  if (slug in LEGACY_HOUSE_SLUGS) return LEGACY_HOUSE_SLUGS[slug];
  if (CANONICAL_HOUSES.some((entry) => entry.slug === slug)) return slug as (typeof CANONICAL_HOUSES)[number]["slug"];

  const name = normalText(house?.name);
  const color = normalText(house?.color);
  if (name.includes("red") || ["#dc2626", "#ef4444", "#9a4545"].includes(color)) return "red-house";
  if (name.includes("green") || ["#16a34a", "#22c55e", "#2f6b4b"].includes(color)) return "green-house";
  if (name.includes("yellow") || ["#facc15", "#eab308", "#c27a2c", "#d97706"].includes(color)) return "yellow-house";
  if (name.includes("blue") || ["#2563eb", "#0f6d9d", "#245d85"].includes(color)) return "blue-house";
  if (name.includes("white") || ["#f8fafc", "#ffffff", "white"].includes(color)) return "white-house";
  return "blue-house";
}

export function canonicalHouseDefinition(house?: HouseLike | null) {
  const slug = canonicalHouseSlug(house);
  return CANONICAL_HOUSES.find((entry) => entry.slug === slug) ?? CANONICAL_HOUSES[3];
}

export function normalizeHouseDisplay<T extends HouseLike>(house: T): T & (typeof CANONICAL_HOUSES)[number] {
  const canonical = canonicalHouseDefinition(house);
  return {
    ...house,
    slug: canonical.slug,
    name: canonical.name,
    virtue: canonical.virtue,
    description: canonical.description,
    color: canonical.color,
    sortOrder: canonical.sortOrder,
  } as T & (typeof CANONICAL_HOUSES)[number];
}

export async function ensureDefaultHouses() {
  for (const house of CANONICAL_HOUSES) {
    await db.house.upsert({
      where: { slug: house.slug },
      create: house,
      update: {
        name: house.name,
        virtue: house.virtue,
        description: house.description,
        color: house.color,
        sortOrder: house.sortOrder,
      },
    });
  }

  return db.house.findMany({
    where: { slug: { in: CANONICAL_HOUSES.map((house) => house.slug) } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function ensureStudentHouseMembership(studentId: string) {
  const existing = await db.houseMembership.findUnique({
    where: { studentId },
    include: { house: true },
  });
  if (existing) {
    return { ...existing, house: normalizeHouseDisplay(existing.house) };
  }

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

  const membership = await db.houseMembership.create({
    data: {
      studentId,
      houseId: house.id,
    },
    include: { house: true },
  });
  return { ...membership, house: normalizeHouseDisplay(membership.house) };
}

async function allHouseIdsForCanonicalSlug(slug: string) {
  const houses = await db.house.findMany();
  return houses.filter((house) => canonicalHouseSlug(house) === slug).map((house) => house.id);
}

export async function getCanonicalHouseIdsForHouseId(houseId: string) {
  const house = await db.house.findUnique({ where: { id: houseId } });
  if (!house) return [houseId];
  return allHouseIdsForCanonicalSlug(canonicalHouseSlug(house));
}

export async function getHouseLeaderboard() {
  await ensureDefaultHouses();
  const [houses, rows] = await Promise.all([
    db.house.findMany(),
    db.housePointLedger.groupBy({
      by: ["houseId"],
      _sum: { points: true },
      _count: { houseId: true },
    }),
  ]);
  const canonicalBySlug = new Map(CANONICAL_HOUSES.map((house) => [house.slug, { ...house, id: house.slug, points: 0, entries: 0, houseIds: [] as string[] }]));
  const rowByHouseId = new Map(rows.map((row) => [row.houseId, row]));

  for (const house of houses) {
    const slug = canonicalHouseSlug(house);
    const entry = canonicalBySlug.get(slug);
    if (!entry) continue;
    const row = rowByHouseId.get(house.id);
    entry.points += row?._sum.points ?? 0;
    entry.entries += row?._count.houseId ?? 0;
    entry.houseIds.push(house.id);
  }

  return [...canonicalBySlug.values()].sort((left, right) => right.points - left.points || left.sortOrder - right.sortOrder);
}

export async function getHouseTeamMembers(houseId: string) {
  const houseIds = await getCanonicalHouseIdsForHouseId(houseId);
  const students = await db.studentProfile.findMany({
    where: {
      houseMembership: { houseId: { in: houseIds } },
      OR: [
        { enrollments: { some: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
        { registrationStudents: { some: { registration: { status: { in: [...PAID_REGISTRATION_STATUSES] } } } } },
      ],
    },
    include: {
      user: true,
      registrationStudents: { select: { age: true, gender: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
  });

  return students.map((student) => ({
    id: student.id,
    name: student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
    age: student.registrationStudents[0]?.age ?? null,
    gender: student.registrationStudents[0]?.gender ?? null,
  }));
}

export async function getRecentHousePointEvents(houseId: string, take = 8) {
  const houseIds = await getCanonicalHouseIdsForHouseId(houseId);
  const rows = await db.housePointLedger.findMany({
    where: { houseId: { in: houseIds } },
    orderBy: { awardedAt: "desc" },
    take: Math.max(take, take * 5),
    include: { student: { include: { user: true } }, house: true },
  });

  const grouped = new Map<string, { id: string; points: number; reason: string; awardedAt: Date; house: ReturnType<typeof normalizeHouseDisplay>; studentName: string; occurrenceCount: number }>();
  for (const row of rows) {
    const day = row.awardedAt.toISOString().slice(0, 10);
    const key = `${row.studentId}:${row.points}:${row.reason.trim().toLowerCase()}:${day}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.occurrenceCount += 1;
      continue;
    }
    grouped.set(key, { id: row.id, points: row.points, reason: row.reason, awardedAt: row.awardedAt, house: normalizeHouseDisplay(row.house), studentName: row.student.displayName || `${row.student.user.firstName} ${row.student.user.lastName}`.trim(), occurrenceCount: 1 });
  }
  return [...grouped.values()].slice(0, take);
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

  const participationPoints = Math.max(0, input.participationPoints ?? 0);
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
