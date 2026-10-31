import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseTaskPayload } from "@/lib/genm/published-content";
import { homeworkIsOpen } from "@/lib/homework/timing";
import { loadModuleSharing, moduleIsShared } from "@/lib/curriculum/handover";
import { canSeeTeacherProgramme } from "@/lib/teacher/programme-scope";
import { sendStudentTaskAssignedEmail, sendHomeworkSubmittedEmail } from "@/lib/email/notifications";

export async function createHomeworkWithNotification(input: { data: Prisma.AssignmentUncheckedCreateInput }, teacherUserId: string, launchAt: string | null) {
  return db.$transaction(async tx => {
    const assignment = await tx.assignment.create(input);
    await tx.billingEmailJob.create({ data: { key: `homework-launch:${assignment.id}`, kind: "HOMEWORK_LAUNCH", recordId: assignment.id, toEmail: "", payload: { teacherUserId }, status: "HOMEWORK_PENDING", nextAttemptAt: launchAt ? new Date(launchAt) : new Date() } });
    return assignment;
  });
}

type DeliveryResult = { cancelled?: boolean; deferUntil?: Date; sent?: boolean };
export async function notifyHomeworkLaunch(assignmentId: string, teacherUserId: string): Promise<DeliveryResult> {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId }, include: { program: true } });
  if (!assignment) return { cancelled: true };
  const task = parseTaskPayload(assignment.instructions);
  if (!homeworkIsOpen(task.launchAt)) return { deferUntil: new Date(task.launchAt!) };
  if (!moduleIsShared(await loadModuleSharing([assignment.programId]), assignment.programId, task.termId, task.weekLabel)) return { deferUntil: new Date(Date.now() + 5 * 60000) };
  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherUserId }, include: { user: true, programAssignments: true, programRosters: { where: { programId: assignment.programId } } } });
  if (!teacher || !teacher.programAssignments.some(item => item.programId === assignment.programId) || !canSeeTeacherProgramme(teacher.user, assignment.program)) return { cancelled: true };
  const enrollments = await db.enrollment.findMany({ where: { programId: assignment.programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } }, include: { parent: { include: { user: true } }, student: { include: { user: true, parents: { include: { parent: { include: { user: true } } } } } } } });
  const roster = new Set(teacher.programRosters.map(item => item.studentId));
  const recipients = new Map<string, { userId: string; email: string; name: string; studentName: string; href: string; parent: boolean; studentId: string }>();
  for (const enrollment of enrollments) {
    if (roster.size && !roster.has(enrollment.studentId)) continue;
    const student = enrollment.student, studentName = student.displayName || student.user.firstName;
    const href = `/parent/homework?child=${encodeURIComponent(student.id)}&task=${encodeURIComponent(assignment.id)}`;
    for (const parent of [enrollment.parent, ...student.parents.map(link => link.parent)]) recipients.set(`${parent.userId}:${student.id}`, { userId: parent.userId, email: parent.user.email, name: parent.user.firstName, studentName, href, parent: true, studentId: student.id });
    recipients.set(`${student.userId}:${student.id}`, { userId: student.userId, email: student.user.email, name: studentName, studentName, href: `/student/homework?task=${encodeURIComponent(assignment.id)}`, parent: false, studentId: student.id });
  }
  // Publish all portal alerts even if an email is deferred by the global quota.
  for (const recipient of recipients.values()) {
    const id = `homework-${createHash("sha256").update(`${assignment.id}:${recipient.userId}:${recipient.studentId}`).digest("hex")}`;
    await db.notification.upsert({ where: { id }, update: {}, create: { id, userId: recipient.userId, title: "Homework is live", body: `${recipient.studentName}: ${assignment.title} in ${assignment.program.title}${task.weekLabel ? ` (${task.weekLabel})` : ""} is live now.`, href: recipient.href } });
  }
  const dueDateLabel = assignment.dueDate ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: task.timezone || teacher.user.timezone || "Europe/London" }).format(assignment.dueDate) : "No deadline";
  for (const recipient of recipients.values()) {
    if (!recipient.email || recipient.email.toLowerCase().endsWith("@genmumin.local")) continue;
    const result = await sendStudentTaskAssignedEmail({ toEmail: recipient.email, recipientName: recipient.name, studentName: recipient.studentName, programTitle: assignment.program.title, taskTitle: assignment.title, teacherName: task.instructorName || teacher.user.firstName, dueDateLabel, weekLabel: task.weekLabel || undefined, completionPath: recipient.href, parentView: recipient.parent, deduplicationKey: `homework:${assignment.id}:${recipient.userId}:${recipient.studentId}` });
    if (result.skipped || result.failed) throw new Error("Homework email deferred by provider configuration, quota or delivery status.");
  }
  return { sent: true };
}

export async function notifyHomeworkSubmission(submissionId: string, version?: string): Promise<DeliveryResult> {
  const submission = await db.assignmentSubmission.findUnique({ where: { id: submissionId }, include: { student: { include: { user: true } }, assignment: { include: { program: { include: { teacherAssignments: { include: { teacher: { include: { user: true, programRosters: true } } } } } } } } } });
  if (!submission || !submission.submittedAt || (version && submission.updatedAt.toISOString() !== version)) return { cancelled: true };
  const assignment = submission.assignment;
  const ownerJob = await db.billingEmailJob.findUnique({ where: { key: `homework-launch:${assignment.id}` } });
  const ownerId = (ownerJob?.payload as { teacherUserId?: string } | undefined)?.teacherUserId;
  const teachers = assignment.program.teacherAssignments.map(link => link.teacher).filter(teacher => {
    const roster = teacher.programRosters.filter(row => row.programId === assignment.programId);
    return (!ownerId || teacher.userId === ownerId) && teacher.user.status === "ACTIVE" && teacher.user.role === "TEACHER" && canSeeTeacherProgramme(teacher.user, assignment.program) && (!roster.length || roster.some(row => row.studentId === submission.studentId));
  });
  const href = `/teacher/homework?task=${encodeURIComponent(assignment.id)}#homework-${encodeURIComponent(assignment.id)}`;
  for (const teacher of teachers) {
    const key = `homework:submitted:${submission.id}:${version || submission.updatedAt.toISOString()}:${teacher.userId}`;
    const id = `homework-${createHash("sha256").update(key).digest("hex")}`;
    const studentName = submission.student.displayName || submission.student.user.firstName;
    await db.notification.upsert({ where: { id }, update: {}, create: { id, userId: teacher.userId, title: "Homework submitted", body: `${studentName} submitted ${assignment.title} for ${assignment.program.title}.`, href } });
    if (!teacher.user.email.toLowerCase().endsWith("@genmumin.local")) {
      const result = await sendHomeworkSubmittedEmail({ toEmail: teacher.user.email, teacherName: teacher.user.firstName, studentName, programTitle: assignment.program.title, taskTitle: assignment.title, reviewPath: href, deduplicationKey: key });
      if (result.skipped || result.failed) throw new Error("Teacher homework email deferred.");
    }
  }
  return { sent: true };
}

export async function deliverHomeworkNotifications(limit = 5, assignmentId?: string) {
  const now = new Date();
  const available = [{ status: "HOMEWORK_PENDING" }, { status: "HOMEWORK_PROCESSING", lockedUntil: { lt: now } }];
  const jobs = await db.billingEmailJob.findMany({ where: { kind: { in: ["HOMEWORK_LAUNCH", "HOMEWORK_SUBMISSION"] }, ...(assignmentId ? { recordId: assignmentId } : {}), nextAttemptAt: { lte: now }, OR: available }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  for (const job of jobs) {
    const token = randomUUID();
    if (!(await db.billingEmailJob.updateMany({ where: { id: job.id, OR: available }, data: { status: "HOMEWORK_PROCESSING", lockToken: token, lockedUntil: new Date(Date.now() + 10 * 60000), attempts: { increment: 1 } } })).count) continue;
    try {
      const teacherUserId = (job.payload as { teacherUserId?: string }).teacherUserId;
      const result: DeliveryResult = job.kind === "HOMEWORK_SUBMISSION" && job.recordId
        ? await notifyHomeworkSubmission(job.recordId, (job.payload as { version?: string }).version)
        : job.recordId && teacherUserId ? await notifyHomeworkLaunch(job.recordId, teacherUserId) : { cancelled: true };
      await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: result.deferUntil ? "HOMEWORK_PENDING" : result.cancelled ? "CANCELLED" : "SENT", nextAttemptAt: result.deferUntil || now, sentAt: result.sent ? new Date() : null, lockedUntil: null, lockToken: null, lastError: null } });
    } catch (error) {
      await db.billingEmailJob.updateMany({ where: { id: job.id, lockToken: token }, data: { status: "HOMEWORK_PENDING", nextAttemptAt: new Date(Date.now() + Math.min(24 * 3600000, 15 * 60000 * (job.attempts + 1))), lockedUntil: null, lockToken: null, lastError: error instanceof Error ? error.message : "Homework notification failed" } });
    }
  }
}

export function startHomeworkNotificationWorker() {
  const state = globalThis as typeof globalThis & { homeworkNotificationTimer?: ReturnType<typeof setTimeout> };
  if (state.homeworkNotificationTimer) return;
  const tick = async () => { try { await deliverHomeworkNotifications(); } catch (error) { console.error("Homework notification worker unavailable", error); } state.homeworkNotificationTimer = setTimeout(tick, 60000); state.homeworkNotificationTimer.unref(); };
  state.homeworkNotificationTimer = setTimeout(tick, 15000); state.homeworkNotificationTimer.unref();
}
