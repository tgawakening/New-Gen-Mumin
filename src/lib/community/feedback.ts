import "server-only";

import { FeedbackAudience } from "@prisma/client";

import { db } from "@/lib/db";

export async function submitWeeklyFeedback(input: {
  audience: FeedbackAudience;
  submittedById: string;
  studentId?: string | null;
  weekLabel: string;
  moodRating?: number | null;
  confidence?: number | null;
  workload?: number | null;
  wins?: string | null;
  concerns?: string | null;
  supportNeeded?: string | null;
}) {
  return db.weeklyFeedbackResponse.create({
    data: {
      audience: input.audience,
      submittedById: input.submittedById,
      studentId: input.studentId ?? null,
      weekLabel: input.weekLabel.trim() || "Weekly feedback",
      moodRating: input.moodRating ?? null,
      confidence: input.confidence ?? null,
      workload: input.workload ?? null,
      wins: input.wins?.trim() || null,
      concerns: input.concerns?.trim() || null,
      supportNeeded: input.supportNeeded?.trim() || null,
    },
  });
}

export async function getStudentFeedbackSummary(studentId: string) {
  return db.weeklyFeedbackResponse.findMany({
    where: { studentId },
    orderBy: { submittedAt: "desc" },
    take: 8,
    include: {
      submittedBy: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });
}

export async function getTeacherFeedbackSummary(teacherUserId: string) {
  return db.weeklyFeedbackResponse.findMany({
    where: { submittedById: teacherUserId },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });
}
