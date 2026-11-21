import "server-only";
import { homeworkAttachments, type HomeworkAttachment } from "@/lib/homework/attachments";
import { db } from "@/lib/db";

export async function saveHomeworkSubmission(input: { assignmentId: string; studentId: string; enrollmentId: string; submissionText: string; attachmentUrl?: string | null; attachmentFiles?: HomeworkAttachment[] }) {
  return db.$transaction(async (tx) => {
    // An enrollment row exists before any submission; lock it to prevent duplicate first submissions.
    await tx.$queryRaw`SELECT id FROM Enrollment WHERE id = ${input.enrollmentId} FOR UPDATE`;
    const existing = await tx.assignmentSubmission.findFirst({ where: { assignmentId: input.assignmentId, studentId: input.studentId }, orderBy: { createdAt: "asc" } });
    const attachmentFiles = homeworkAttachments({ attachmentUrl: existing?.attachmentUrl, attachmentFiles: [...homeworkAttachments(existing), ...homeworkAttachments(input)] });
    if (!input.submissionText && !attachmentFiles.length) throw new Error("Add an answer or upload a file before submitting.");
    const data = {
      enrollmentId: input.enrollmentId,
      submissionText: input.submissionText,
      attachmentUrl: existing?.attachmentUrl ?? attachmentFiles[0]?.url ?? null,
      attachmentFiles,
      status: "SUBMITTED" as const,
      submittedAt: existing?.submittedAt ?? new Date(),
    };
    const submission = existing
      ? tx.assignmentSubmission.update({ where: { id: existing.id }, data })
      : tx.assignmentSubmission.create({ data: { ...data, assignmentId: input.assignmentId, studentId: input.studentId } });
    const saved = await submission;
    const version = saved.updatedAt.toISOString();
    await tx.billingEmailJob.upsert({ where: { key: `homework-submission:${saved.id}:${version}` }, update: {}, create: { key: `homework-submission:${saved.id}:${version}`, kind: "HOMEWORK_SUBMISSION", recordId: saved.id, toEmail: "", payload: { version }, status: "HOMEWORK_PENDING" } });
    return saved;
  });
}
