import "server-only";
import { db } from "@/lib/db";
import { canSeeTeacherProgramme } from "@/lib/teacher/programme-scope";
import { buildTaskPayload, parseTaskPayload } from "@/lib/genm/published-content";
import { homeworkWindow, homeworkDateDefaults } from "@/lib/homework/timing";
import { uploadTeacherMaterial } from "@/lib/google-drive/materials";

export async function teacherHomeworkForManagement(userId: string, taskId: string) {
  const [teacher, task] = await Promise.all([
    db.teacherProfile.findUnique({ where: { userId }, include: { user: true, programAssignments: true } }),
    db.assignment.findUnique({ where: { id: taskId }, include: { program: true } }),
  ]);
  if (!teacher || teacher.user.role !== "TEACHER" || !task || !teacher.programAssignments.some((assignment) => assignment.programId === task.programId) || !canSeeTeacherProgramme(teacher.user, task.program)) throw new Error("This homework is not available for you to manage.");
  return { task, timezone: teacher.user.timezone || "Europe/London" };
}

export async function updateTeacherHomework(userId: string, formData: FormData) {
  const { task, timezone } = await teacherHomeworkForManagement(userId, String(formData.get("taskId") || ""));
  const saved = parseTaskPayload(task.instructions);
  const title = String(formData.get("title") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  if (!title || !instructions || title.length > 191) throw new Error("Enter a title and clear homework instructions.");
  const zone = saved.timezone || timezone;
  const launchRaw = String(formData.get("launchDate") || "");
  const dueRaw = String(formData.get("dueDate") || "");
  const dates = homeworkWindow(launchRaw || null, dueRaw || null, zone);
  if (saved.launchAt && launchRaw === homeworkDateDefaults(zone, new Date(saved.launchAt)).launch) dates.launchAt = saved.launchAt;
  if (task.dueDate && dueRaw === homeworkDateDefaults(zone, task.dueDate).launch) dates.dueDate = task.dueDate;
  const retainedIds = new Set(formData.getAll("keepAttachment").map(String));
  const attachments = saved.attachments.filter((attachment) => attachment && retainedIds.has(attachment.id));
  for (const file of formData.getAll("files")) {
    if (typeof file === "string" || !file.size) continue;
    const uploaded = await uploadTeacherMaterial({ programId: task.programId, teacherUserId: userId, file, title: file.name, folderName: `Tasks / ${title}`, purpose: "task", termId: saved.termId, publishToStudents: true, suppressNotifications: true });
    attachments.push({ id: uploaded.id, name: uploaded.name, url: uploaded.webViewLink ?? null, mimeType: uploaded.mimeType ?? null, thumbnailUrl: uploaded.thumbnailLink ?? null });
  }
  const resourceLinks = String(formData.get("resourceLinks") || "").split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
  for (const link of resourceLinks) {
    try { if (!["https:", "http:"].includes(new URL(link).protocol)) throw new Error(); }
    catch { throw new Error("Use a full http or https URL for each resource link."); }
  }
  // Updating the assignment leaves submissions, feedback and point awards untouched.
  return db.$transaction(async tx => {
    const updated = await tx.assignment.update({ where: { id: task.id }, data: { title, dueDate: dates.dueDate, instructions: buildTaskPayload({ ...saved, title, instructions, launchAt: dates.launchAt, timezone: saved.timezone || timezone, attachments, resourceLinks, familyNote: String(formData.get("familyNote") || "").trim() || null }) } });
    await tx.billingEmailJob.updateMany({ where: { kind: "HOMEWORK_LAUNCH", recordId: task.id, status: "HOMEWORK_PENDING" }, data: { nextAttemptAt: dates.launchAt ? new Date(dates.launchAt) : new Date() } });
    return updated;
  });
}

export async function deleteTeacherHomework(userId: string, taskId: string) {
  const { task } = await teacherHomeworkForManagement(userId, taskId);
  // The assignment relation cascades to submissions. Earned Qabila ledger entries remain intact.
  await db.$transaction(async tx => {
    await tx.assignment.delete({ where: { id: task.id } });
    await tx.billingEmailJob.updateMany({ where: { kind: "HOMEWORK_LAUNCH", recordId: task.id, status: { in: ["HOMEWORK_PENDING", "HOMEWORK_PROCESSING"] } }, data: { status: "CANCELLED", lockedUntil: null, lockToken: null } });
    await tx.notification.deleteMany({ where: { href: { startsWith: "/parent/homework?" }, AND: [{ href: { contains: `&task=${encodeURIComponent(task.id)}` } }] } });
  });
}
