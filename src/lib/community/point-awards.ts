import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";

export const HOUSE_POINT_RULES = {
  SUNNAH_DAILY_SUBMISSION: { points: 5, label: "Daily Sunnah tracker submission" },
  SUNNAH_TASK_COMPLETED: { points: 10, label: "Completed Sunnah tracker task" },
  ATTENDANCE_ON_TIME: { points: 25, label: "Joined class on time" },
  HOMEWORK_SUBMITTED: { points: 15, label: "Submitted homework" },
  CAMERA_STUDY_READY: { points: 10, label: "Camera on with a prepared study corner" },
  LIVE_QUIZ_ANSWER: { points: 10, label: "Strong live quiz answer" },
  POSITIVE_PARTICIPATION: { points: 10, label: "Positive and focused class participation" },
} as const;

export type ManualHousePointReason =
  | "CAMERA_STUDY_READY"
  | "LIVE_QUIZ_ANSWER"
  | "POSITIVE_PARTICIPATION";

export const MANUAL_HOUSE_POINT_REASONS: Array<{
  value: ManualHousePointReason;
  label: string;
  points: number;
  evidenceHint: string;
}> = [
  {
    value: "CAMERA_STUDY_READY",
    label: HOUSE_POINT_RULES.CAMERA_STUDY_READY.label,
    points: HOUSE_POINT_RULES.CAMERA_STUDY_READY.points,
    evidenceHint: "Camera shows the learner sitting properly with a dedicated chair/table, notebook or book, and pen ready.",
  },
  {
    value: "LIVE_QUIZ_ANSWER",
    label: HOUSE_POINT_RULES.LIVE_QUIZ_ANSWER.label,
    points: HOUSE_POINT_RULES.LIVE_QUIZ_ANSWER.points,
    evidenceHint: "Award for a teacher-observed answer that is not already automatically rewarded by the live quiz.",
  },
  {
    value: "POSITIVE_PARTICIPATION",
    label: HOUSE_POINT_RULES.POSITIVE_PARTICIPATION.label,
    points: HOUSE_POINT_RULES.POSITIVE_PARTICIPATION.points,
    evidenceHint: "Focused, helpful, respectful participation during this live class.",
  },
];

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function awardHousePointsOnce(input: {
  studentId: string;
  points: number;
  reason: string;
  sourceType: string;
  sourceId: string;
  notificationHref?: string;
}) {
  if (!input.sourceId.trim()) throw new Error("A point award must have a unique source.");
  if (!Number.isInteger(input.points) || input.points <= 0 || input.points > 100) {
    throw new Error("House point award must be between 1 and 100 points.");
  }

  const membership = await ensureStudentHouseMembership(input.studentId);
  let ledger;
  try {
    ledger = await db.housePointLedger.create({
      data: {
        houseId: membership.houseId,
        studentId: input.studentId,
        points: input.points,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) return { awarded: false as const, ledger: null, house: membership.house };
    throw error;
  }

  const student = await db.studentProfile.findUnique({
    where: { id: input.studentId },
    include: {
      user: true,
      parents: { include: { parent: { include: { user: true } } } },
    },
  });
  if (student) {
    const userIds = Array.from(new Set([student.userId, ...student.parents.map((link) => link.parent.userId)]));
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: "House points earned!",
        body: (student.displayName || student.user.firstName) + " earned " + input.points + " house points: " + input.reason + ".",
        href: input.notificationHref || (userId === student.userId ? "/student/missions?type=sunnah" : "/parent/community"),
      })),
    });
  }

  return { awarded: true as const, ledger, house: membership.house };
}

export function pointDayKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}