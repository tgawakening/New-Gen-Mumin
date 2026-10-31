import "server-only";
import { db } from "@/lib/db";
import { createReadOnlyRosterResolver, getTeacherProgramRosterEntries, getTeacherRosterAssignments } from "@/lib/live-classes/service";

export async function teacherRecognitionStudentIds(userId: string) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId }, include: { user: true, programAssignments: { include: { program: true } } } });
  if (!teacher || teacher.user.role !== "TEACHER" || teacher.user.status !== "ACTIVE") return [];
  const resolver = createReadOnlyRosterResolver();
  await resolver.warm();
  const entries = await getTeacherProgramRosterEntries(teacher.id, resolver.read);
  const ids = new Set<string>();
  for (const assignment of getTeacherRosterAssignments(teacher)) {
    const saved = new Set(entries.filter((entry) => entry.programId === assignment.program.id).map((entry) => entry.studentId));
    const eligible = await resolver.read.eligible(assignment.program.id);
    for (const student of eligible) if (!saved.size || saved.has(student.id)) ids.add(student.id);
  }
  return [...ids];
}

export async function notifyRosterTeachersOfAward(input: { id: string; studentId: string; studentName?: string; badgeKey: string; title: string; evidence: string | null; isPublic?: boolean; revokedAt?: Date | null }) {
  if (input.isPublic === false || input.revokedAt) return;
  const href = `/teacher/recognition?award=${encodeURIComponent(input.id)}&awardStudent=${encodeURIComponent(input.studentId)}&badgeImage=${encodeURIComponent(input.badgeKey)}#roster-awards`;
  if (await db.notification.findFirst({ where: { href }, select: { id: true } })) return;
  const student = input.studentName ? null : await db.studentProfile.findUnique({ where: { id: input.studentId }, include: { user: true } });
  const studentName = input.studentName || student?.displayName || `${student?.user.firstName ?? "Student"} ${student?.user.lastName ?? ""}`.trim();
  const teachers = await db.teacherProfile.findMany({ where: { user: { role: "TEACHER", status: "ACTIVE" } }, select: { userId: true } });
  const recipients = new Set<string>();
  // Resolve the same saved/eligible rosters used by the teacher dashboard, including programme scope.
  for (const teacher of teachers) {
    if ((await teacherRecognitionStudentIds(teacher.userId)).includes(input.studentId)) recipients.add(teacher.userId);
  }
  if (recipients.size) await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM RecognitionAward WHERE id = ${input.id} FOR UPDATE`;
    const alreadySent = await tx.notification.findMany({ where: { userId: { in: [...recipients] }, href }, select: { userId: true } });
    const existing = new Set(alreadySent.map((item) => item.userId));
    const userIds = [...recipients].filter((id) => !existing.has(id));
    if (userIds.length) await tx.notification.createMany({ data: userIds.map((userId) => ({
      userId,
      title: `${studentName} earned ${input.title}!`,
      body: `${input.evidence || "A new character achievement has been recorded."} Celebrate this achievement in class and encourage their continued effort.`,
      href,
    })) });
  });
}
