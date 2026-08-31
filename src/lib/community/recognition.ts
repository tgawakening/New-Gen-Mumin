import "server-only";

import { db } from "@/lib/db";
import { awardHousePointsOnce } from "@/lib/community/point-awards";
import { ensureStudentHouseMembership, getCanonicalHouseIdsForHouseId, getRecentHousePointEvents } from "@/lib/community/house-points";

export const RECOGNITION_LEVELS = [
  { key: "ROOKIE", title: "Rookie Mumin", min: 0 },
  { key: "RISING", title: "Rising Mumin", min: 200 },
  { key: "MUJAHID", title: "Mujahid of Good", min: 500 },
  { key: "CHAMPION", title: "House Champion", min: 800 },
  { key: "ELITE", title: "Mumin Elite", min: 1000 },
] as const;

export const CHARACTER_BADGES = [
  { key: "RELIABLE", title: "The Reliable One", category: "RELIABILITY", description: "Shows up and can be counted on." },
  { key: "HELPER", title: "The Helper", category: "SERVICE", description: "Helps others with kindness and sincerity." },
  { key: "COURAGEOUS", title: "The Courageous One", category: "COURAGE", description: "Does what is right even when it is difficult." },
  { key: "SEEKER", title: "The Seeker", category: "KNOWLEDGE", description: "Actively learns, researches, and asks thoughtful questions." },
  { key: "NOTICER", title: "The Noticer", category: "SERVICE", description: "Notices who needs help and responds." },
  { key: "TRUTH_TELLER", title: "The Truth-Teller", category: "CHARACTER", description: "Practises honesty with courage and humility." },
  { key: "CONSISTENT", title: "The Consistent One", category: "CONSISTENCY", description: "Maintains a beneficial practice over time." },
  { key: "LEADER", title: "The Leader", category: "LEADERSHIP", description: "Helps other people succeed." },
  { key: "HOUSE_BUILDER", title: "House Builder", category: "ALLIANCE", description: "Makes another House stronger through service." },
  { key: "ALLIANCE_CHAMPION", title: "Alliance Champion", category: "ALLIANCE", description: "Demonstrates exceptional cross-House cooperation." },
] as const;

export const HOUSE_UNLOCKS = [
  { milestone: 100, title: "Mystery reward", description: "A small House surprise is ready." },
  { milestone: 250, title: "House badge", description: "A shared House achievement badge is unlocked." },
  { milestone: 500, title: "Special House challenge", description: "The House can enter a special team challenge." },
  { milestone: 750, title: "Custom House poster", description: "A custom House poster is unlocked." },
  { milestone: 1000, title: "House celebration", description: "The whole House has earned a celebration." },
  { milestone: 2000, title: "Special experience", description: "A major shared House experience is unlocked." },
] as const;

export function recognitionLevel(points: number) {
  return [...RECOGNITION_LEVELS].reverse().find((level) => points >= level.min) ?? RECOGNITION_LEVELS[0];
}

export async function awardRecognition(input: {
  studentId: string; badgeKey: string; evidence: string; awardedByUserId?: string;
  sourceType: string; sourceId: string; pointsBonus?: number; featuredWeek?: string; beneficiaryStudentId?: string;
}) {
  const definition = CHARACTER_BADGES.find((badge) => badge.key === input.badgeKey);
  if (!definition) throw new Error("Choose an approved character badge.");
  const award = await db.recognitionAward.upsert({
    where: { studentId_badgeKey_sourceType_sourceId: { studentId: input.studentId, badgeKey: definition.key, sourceType: input.sourceType, sourceId: input.sourceId } },
    create: { studentId: input.studentId, badgeKey: definition.key, title: definition.title, category: definition.category, description: definition.description, evidence: input.evidence, awardedByUserId: input.awardedByUserId, sourceType: input.sourceType, sourceId: input.sourceId, pointsBonus: input.pointsBonus ?? 0, featuredWeek: input.featuredWeek, beneficiaryStudentId: input.beneficiaryStudentId },
    update: { evidence: input.evidence, featuredWeek: input.featuredWeek, isPublic: true },
  });
  if ((input.pointsBonus ?? 0) > 0) await awardHousePointsOnce({ studentId: input.studentId, points: input.pointsBonus!, reason: definition.title + ": " + input.evidence, sourceType: "RECOGNITION_" + definition.key, sourceId: award.id, notificationHref: "/student/rewards" });
  if (input.beneficiaryStudentId && ["HOUSE_BUILDER", "ALLIANCE_CHAMPION"].includes(definition.key)) {
    const otherBonus = definition.key === "ALLIANCE_CHAMPION" ? 30 : 20;
    const [helperHouse, beneficiaryHouse] = await Promise.all([ensureStudentHouseMembership(input.studentId), ensureStudentHouseMembership(input.beneficiaryStudentId)]);
    if (helperHouse.houseId === beneficiaryHouse.houseId) throw new Error("Cross-House recognition requires a learner from another House.");
    await awardHousePointsOnce({ studentId: input.beneficiaryStudentId, points: otherBonus, reason: `${definition.title}: another House helped this learner`, sourceType: "CROSS_HOUSE_" + definition.key, sourceId: award.id, notificationHref: "/student/rewards" });
  }
  const student = await db.studentProfile.findUnique({ where: { id: input.studentId }, include: { parents: { include: { parent: true } } } });
  if (student) await db.notification.createMany({ data: [student.userId, ...student.parents.map((link) => link.parent.userId)].map((userId) => ({ userId, title: "Character recognition earned!", body: `${definition.title}: ${input.evidence}`, href: userId === student.userId ? "/student/rewards" : `/parent/rewards?child=${student.id}` })) });
  return award;
}

export async function syncAutomaticRecognition(studentId: string) {
  const rows = await db.housePointLedger.findMany({ where: { studentId }, select: { sourceType: true, points: true, sourceId: true } });
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.sourceType, (counts.get(row.sourceType) ?? 0) + 1);
  const rules = [
    { badgeKey: "RELIABLE", met: (counts.get("ATTENDANCE_ON_TIME") ?? 0) >= 4, evidence: "Joined at least four live classes on time." },
    { badgeKey: "CONSISTENT", met: (counts.get("SUNNAH_DAILY") ?? 0) >= 7, evidence: "Completed seven daily Sunnah tracker submissions." },
    { badgeKey: "SEEKER", met: (counts.get("HOMEWORK_SUBMITTED") ?? 0) >= 3, evidence: "Submitted at least three learning assignments." },
  ];
  for (const rule of rules) if (rule.met) await awardRecognition({ studentId, badgeKey: rule.badgeKey, evidence: rule.evidence, sourceType: "AUTOMATIC", sourceId: rule.badgeKey });
}

export async function getRecognitionDashboard(studentId: string) {
  await syncAutomaticRecognition(studentId);
  const membership = await ensureStudentHouseMembership(studentId);
  const houseIds = await getCanonicalHouseIdsForHouseId(membership.houseId);
  const [student, awards, studentPoints, housePoints, activity] = await Promise.all([
    db.studentProfile.findUnique({ where: { id: studentId }, include: { user: true, registrationStudents: { orderBy: { createdAt: "desc" }, take: 1, select: { gender: true } } } }),
    db.recognitionAward.findMany({ where: { studentId, isPublic: true }, orderBy: { awardedAt: "desc" } }),
    db.housePointLedger.aggregate({ where: { studentId }, _sum: { points: true } }),
    db.housePointLedger.aggregate({ where: { houseId: { in: houseIds } }, _sum: { points: true } }),
    getRecentHousePointEvents(membership.houseId, 8),
  ]);
  const total = studentPoints._sum.points ?? 0;
  const collective = housePoints._sum.points ?? 0;
  const level = recognitionLevel(total);
  const nextLevel = RECOGNITION_LEVELS.find((entry) => entry.min > total) ?? null;
  const nextUnlock = HOUSE_UNLOCKS.find((entry) => entry.milestone > collective) ?? null;
  for (const unlock of HOUSE_UNLOCKS.filter((entry) => collective >= entry.milestone)) await db.houseUnlock.upsert({ where: { houseId_milestone: { houseId: membership.houseId, milestone: unlock.milestone } }, create: { houseId: membership.houseId, ...unlock, unlockedAt: new Date() }, update: {} });
  return { student, membership, awards, total, collective, level, nextLevel, nextUnlock, activity, badgeDefinitions: CHARACTER_BADGES };
}