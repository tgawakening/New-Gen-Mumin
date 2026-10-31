import "server-only";
import { db } from "@/lib/db";
import { genMTerms } from "@/lib/genm/curriculum";
import { canSeeTeacherProgramme } from "@/lib/teacher/programme-scope";

export type ModuleSharing = Record<string, boolean>;
export function curriculumModule(termId?: string | null, label?: string | null) {
  if (genMTerms.some((term) => term.id === termId)) return termId!;
  const text = (label || "").toLowerCase();
  return genMTerms.find((term) => text.includes(term.title.toLowerCase()) || text.includes(term.id.toLowerCase()))?.id || genMTerms[0].id;
}
export function moduleIsShared(sharing: ModuleSharing, programId: string, termId?: string | null, label?: string | null) {
  return sharing[`${programId}:${curriculumModule(termId, label)}`] !== false;
}
export async function loadModuleSharing(programIds: string[]): Promise<ModuleSharing> {
  if (!programIds.length) return {};
  const teachers = await db.teacherProfile.findMany({ where: { programAssignments: { some: { programId: { in: programIds } } } }, include: { user: true, programAssignments: { include: { program: true } } } });
  const latest = new Map<string, { enabled: boolean; updatedAt: string }>();
  for (const teacher of teachers) {
    const allowed = teacher.programAssignments.filter((item) => programIds.includes(item.programId) && canSeeTeacherProgramme(teacher.user, item.program)).map((item) => item.programId);
    const raw = teacher.specialties as { curriculumHandover?: Record<string, { enabled: boolean; updatedAt: string }> } | null;
    for (const [key, entry] of Object.entries(raw?.curriculumHandover || {})) {
      if (!allowed.some((id) => key.startsWith(`${id}:`)) || typeof entry?.enabled !== "boolean" || !Number.isFinite(Date.parse(entry.updatedAt))) continue;
      if (!latest.has(key) || latest.get(key)!.updatedAt < entry.updatedAt) latest.set(key, entry);
    }
  }
  return Object.fromEntries([...latest].map(([key, value]) => [key, value.enabled]));
}
export async function saveModuleSharing(teacherUserId: string, programId: string, termId: string, enabled: boolean) {
  if (!genMTerms.some((term) => term.id === termId)) throw new Error("Choose a valid module.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM TeacherProfile WHERE userId = ${teacherUserId} FOR UPDATE`;
    const teacher = await tx.teacherProfile.findUnique({ where: { userId: teacherUserId }, include: { user: true, programAssignments: { include: { program: true } } } });
    const assignment = teacher?.programAssignments.find((item) => item.programId === programId);
    if (!teacher || teacher.user.role !== "TEACHER" || !assignment || !canSeeTeacherProgramme(teacher.user, assignment.program)) throw new Error("This programme is not assigned to you.");
    const raw = teacher.specialties;
    const current = raw && !Array.isArray(raw) && typeof raw === "object" ? raw : { list: Array.isArray(raw) ? raw : [] };
    const previous = current.curriculumHandover && !Array.isArray(current.curriculumHandover) && typeof current.curriculumHandover === "object" ? current.curriculumHandover : {};
    await tx.teacherProfile.update({ where: { id: teacher.id }, data: { specialties: { ...current, curriculumHandover: { ...previous, [`${programId}:${termId}`]: { enabled, updatedAt: new Date().toISOString() } } } } });
    if (!enabled) await tx.notification.updateMany({ where: { readAt: null, href: { startsWith: "/parent/curriculum?" }, AND: [{ href: { contains: `program=${encodeURIComponent(programId)}&` } }, { href: { contains: `module=${encodeURIComponent(termId)}&` } }] }, data: { readAt: new Date() } });
  });
}
