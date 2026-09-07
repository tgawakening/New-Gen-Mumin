import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ACTIVE_ENROLLMENTS = ["ACTIVE", "CONFIRMED", "COMPLETED"];

function normalized(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const registrations = await db.registrationStudent.findMany({
    where: {
      studentProfileId: { not: null },
      registration: { status: { in: ["PAID", "CONVERTED"] } },
    },
    include: {
      registration: { select: { parentEmail: true, status: true, createdAt: true } },
      studentProfile: {
        include: {
          user: true,
          enrollments: {
            where: { status: { in: ACTIVE_ENROLLMENTS } },
            select: { programId: true, program: { select: { title: true, slug: true } } },
          },
        },
      },
    },
    orderBy: { registration: { createdAt: "desc" } },
  });

  const matches = registrations.filter((entry) => {
    const registrationName = normalized(entry.displayName || `${entry.firstName} ${entry.lastName || ""}`);
    const profileName = normalized(entry.studentProfile?.displayName || `${entry.studentProfile?.user.firstName || ""} ${entry.studentProfile?.user.lastName || ""}`);
    return registrationName === "zarannisar" || profileName === "zarannisar";
  });
  const target = matches[0];
  if (!target?.studentProfile) { console.warn("[zaran-roster-sync] Paid learner Zaran Nisar was not found or is not linked yet; no roster changes made."); return; }

  const programIds = [...new Set(target.studentProfile.enrollments.map((entry) => entry.programId))];
  if (!programIds.length) { console.warn("[zaran-roster-sync] Zaran Nisar has no active Gen-M programme enrollments yet; no roster changes made."); return; }

  const assignments = await db.teacherProgram.findMany({
    where: { programId: { in: programIds }, teacher: { isActive: true, user: { status: "ACTIVE" } } },
    include: { teacher: { include: { user: true } }, program: true },
  });
  if (!assignments.length) { console.warn("[zaran-roster-sync] No active teachers are assigned to Zaran Nisar's programmes; no roster changes made."); return; }

  for (const assignment of assignments) {
    await db.teacherStudentRoster.upsert({
      where: { teacherId_programId_studentId: { teacherId: assignment.teacherId, programId: assignment.programId, studentId: target.studentProfile.id } },
      update: {},
      create: { teacherId: assignment.teacherId, programId: assignment.programId, studentId: target.studentProfile.id },
    });
  }

  console.log(`[zaran-roster-sync] ${target.studentProfile.displayName || "Zaran Nisar"} added to ${assignments.length} teacher-program rosters across ${programIds.length} active programmes.`);
  for (const assignment of assignments) console.log(`[zaran-roster-sync] ${assignment.teacher.user.email} -> ${assignment.program.slug}`);
}

main().catch((error) => {
  console.error("[zaran-roster-sync] failed", error);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());