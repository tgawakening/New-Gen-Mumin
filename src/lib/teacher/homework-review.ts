import "server-only";

import { db } from "@/lib/db";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { teacherRecognitionStudentIds } from "@/lib/teacher/recognition-roster";

export function homeworkPoints(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const points = Number(raw);
  if (!Number.isInteger(points) || points < 0 || points > 500) {
    throw new Error("Homework points must be a whole number between 0 and 500.");
  }
  return points;
}

export async function reviewHomework(teacherUserId: string, formData: FormData) {
  const points = homeworkPoints(formData.get("homeworkPoints"));
  const status = String(formData.get("reviewStatus") || "REVIEWED");
  if (!["REVIEWED", "PENDING"].includes(status)) throw new Error("Invalid review status.");
  const grade = String(formData.get("grade") || "");
  if (grade && !["EXCELLENT", "GOOD", "SATISFACTORY", "NEEDS_IMPROVEMENT"].includes(grade)) throw new Error("Invalid grade.");
  const rawScore = String(formData.get("score") || "").trim();
  const score = rawScore ? Number(rawScore) : null;
  if (score !== null && (!Number.isInteger(score) || score < 0 || score > 2147483647)) throw new Error("Score must be a positive whole number or zero.");
  const submission = await db.assignmentSubmission.findFirst({
    where: {
      id: String(formData.get("submissionId") || ""),
      assignment: { program: { teacherAssignments: { some: { teacher: { userId: teacherUserId } } } } },
    },
    include: { student: { include: { user: true } }, assignment: true },
  });
  if (!submission) throw new Error("Submission is not available for this teacher.");
  if (!(await teacherRecognitionStudentIds(teacherUserId)).includes(submission.studentId)) throw new Error("This student is not in your current roster.");
  if (!submission.submittedAt || submission.status === "DRAFT") throw new Error("The student has not submitted this homework yet.");
  const membership = status === "REVIEWED" && points !== null
    ? await ensureStudentHouseMembership(submission.studentId) : null;
  return db.$transaction(async (tx) => {
    // Updating the submission first serialises concurrent reviews of the same work.
    const reviewed = await tx.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: status === "PENDING" ? "SUBMITTED" : "REVIEWED",
        grade: (grade || null) as "EXCELLENT" | "GOOD" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | null,
        score,
        feedback: String(formData.get("feedback") || "").trim() || null,
        reviewedByUserId: teacherUserId,
      },
    });
    if (membership && points !== null) {
      await tx.housePointLedger.upsert({
        where: { studentId_sourceType_sourceId: { studentId: submission.studentId, sourceType: "HOMEWORK_PERFORMANCE", sourceId: submission.id } },
        create: { studentId: submission.studentId, houseId: membership.houseId, sourceType: "HOMEWORK_PERFORMANCE", sourceId: submission.id, points, reason: "Homework performance" },
        update: { points },
      });
    }
    await tx.notification.create({
      data: {
        userId: submission.student.userId,
        title: "Homework reviewed",
        body: `${submission.assignment.title}: ${status === "PENDING" ? "review pending" : "review complete"}${membership && points !== null ? `. Homework performance: ${points} Qabila points` : ""}.`,
        href: "/student/courses",
      },
    });
    return reviewed;
  });
}
