import "server-only";

import { FeedbackAudience, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function submitWeeklyFeedback(input: {
  audience: FeedbackAudience;
  submittedById: string;
  teacherUserId?: string | null;
  studentId?: string | null;
  weekLabel: string;
  moodRating?: number | null;
  confidence?: number | null;
  workload?: number | null;
  wins?: string | null;
  concerns?: string | null;
  supportNeeded?: string | null;
  rawPayload?: Prisma.InputJsonValue | null;
}) {
  return db.weeklyFeedbackResponse.create({
    data: {
      audience: input.audience,
      submittedById: input.submittedById,
      teacherUserId: input.teacherUserId ?? null,
      studentId: input.studentId ?? null,
      weekLabel: input.weekLabel.trim() || "Weekly feedback",
      moodRating: input.moodRating ?? null,
      confidence: input.confidence ?? null,
      workload: input.workload ?? null,
      wins: input.wins?.trim() || null,
      concerns: input.concerns?.trim() || null,
      supportNeeded: input.supportNeeded?.trim() || null,
      rawPayload: input.rawPayload ?? undefined,
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
    where: { OR: [{ submittedById: teacherUserId }, { teacherUserId }] },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });
}

export async function getTeacherParentFeedbackInbox(teacherUserId: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: { user: true, programAssignments: { include: { program: true } } },
  });
  if (!teacher) return { programmes: [], responses: [] };

  const programIds = new Set(teacher.programAssignments.map((assignment) => assignment.programId));
  const responses = await db.weeklyFeedbackResponse.findMany({
    where: { audience: FeedbackAudience.PARENT },
    orderBy: { submittedAt: "desc" },
    take: 120,
    include: {
      student: {
        include: {
          user: true,
          enrollments: { include: { program: true } },
        },
      },
      submittedBy: true,
    },
  });

  return {
    programmes: teacher.programAssignments.map((assignment) => assignment.program),
    responses: responses.filter((entry) =>
      entry.student?.enrollments.some((enrollment) => programIds.has(enrollment.programId)),
    ),
  };
}

export async function getAdminFeedbackOverview() {
  const [responses, totals] = await Promise.all([
    db.weeklyFeedbackResponse.findMany({
      orderBy: { submittedAt: "desc" },
      take: 80,
      include: {
        student: {
          include: {
            enrollments: {
              include: {
                program: {
                  select: {
                    title: true,
                  },
                },
              },
            },
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        submittedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    db.weeklyFeedbackResponse.groupBy({
      by: ["audience"],
      _count: { _all: true },
    }),
  ]);

  return {
    responses,
    totals,
  };
}
