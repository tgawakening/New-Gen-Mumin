import "server-only";
import { db } from "@/lib/db";
import { curriculumModule, loadModuleSharing, moduleIsShared } from "@/lib/curriculum/handover";
import { sendCurriculumUpdateEmail } from "@/lib/email/notifications";

export async function notifyCurriculumParents(input: { programId: string; teacherUserId?: string | null; termId?: string | null; label?: string | null; title: string; kind: "lesson" | "material"; contentId: string; updated?: boolean; version: string }) {
  const moduleId = curriculumModule(input.termId, input.label);
  if (!moduleIsShared(await loadModuleSharing([input.programId]), input.programId, moduleId)) return;
  const [enrollments, roster, program] = await Promise.all([
    db.enrollment.findMany({ where: { programId: input.programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } }, include: { student: { include: { user: true, parents: { include: { parent: { include: { user: true } } } } } }, parent: { include: { user: true } } } }),
    input.teacherUserId ? db.teacherStudentRoster.findMany({ where: { teacher: { userId: input.teacherUserId }, programId: input.programId }, select: { studentId: true } }) : [],
    db.program.findUnique({ where: { id: input.programId }, select: { title: true } }),
  ]);
  const rosterIds = new Set(roster.map((item) => item.studentId));
  const recipients = new Map<string, { userId: string; email: string; name: string; href: string; studentName: string }>();
  for (const enrollment of enrollments) {
    if (rosterIds.size && !rosterIds.has(enrollment.studentId)) continue;
    const studentName = enrollment.student.displayName || enrollment.student.user.firstName;
    const href = `/parent/curriculum?program=${encodeURIComponent(input.programId)}&module=${encodeURIComponent(moduleId)}&child=${encodeURIComponent(enrollment.studentId)}&course=${encodeURIComponent(input.programId)}&${input.kind}=${encodeURIComponent(input.contentId)}&revision=${encodeURIComponent(input.version)}`;
    for (const parent of [enrollment.parent, ...enrollment.student.parents.map((link) => link.parent)]) recipients.set(`${parent.userId}:${enrollment.studentId}`, { userId: parent.userId, email: parent.user.email, name: parent.user.firstName, href, studentName });
  }
  for (const recipient of recipients.values()) {
    const title = `${input.updated ? "Updated" : "New"} curriculum ${input.kind}: ${input.title}`;
    const body = `${recipient.studentName}: ${input.title} in ${program?.title || "their programme"}. Please review this ${input.kind}.`;
    if (!(await db.notification.findFirst({ where: { userId: recipient.userId, href: recipient.href }, select: { id: true } }))) await db.notification.create({ data: { userId: recipient.userId, title, body, href: recipient.href } });
    if (!recipient.email.toLowerCase().endsWith("@genmumin.local")) await sendCurriculumUpdateEmail({ toEmail: recipient.email, recipientName: recipient.name, studentName: recipient.studentName, contentTitle: input.title, programTitle: program?.title || "their programme", kind: input.kind, updated: input.updated, curriculumPath: recipient.href, deduplicationKey: `curriculum:${input.kind}:${input.contentId}:${input.version}:${recipient.userId}:${recipient.studentName}` }).catch((error) => console.error("Curriculum email failed", error));
  }
}
