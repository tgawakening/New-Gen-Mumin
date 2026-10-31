import { homeworkTiming } from "@/lib/homework/timing";

type Submission = { id: string; studentId: string; status: string; submittedAt: Date | null; submissionText: string | null; score: number | null; grade: string | null; feedback: string | null; attachmentUrl: string | null };

export function homeworkReviewRows(assignmentId: string, students: Array<{ id: string; name: string }>, submissions: Submission[], awards: ReadonlyMap<string, number>, dueDate: Date | null) {
  return students.map((student) => {
    const submission = submissions.find((entry) => entry.studentId === student.id);
    return {
      id: submission?.id ?? `missing:${assignmentId}:${student.id}`,
      canReview: Boolean(submission?.submittedAt) && submission?.status !== "DRAFT",
      studentName: student.name,
      submissionTiming: homeworkTiming(submission?.submittedAt ?? null, dueDate),
      submissionText: submission?.submissionText ?? null,
      status: submission?.status.replace(/_/g, " ") ?? "NOT SUBMITTED",
      score: submission?.score ?? null,
      homeworkPoints: submission ? awards.get(submission.id) ?? null : null,
      grade: submission?.grade?.replace(/_/g, " ") ?? null,
      submittedAt: submission?.submittedAt ?? null,
      feedback: submission?.feedback ?? null,
      attachmentUrl: submission?.attachmentUrl ?? null,
    };
  });
}
