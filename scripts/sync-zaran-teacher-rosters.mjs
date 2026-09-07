import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ACTIVE_ENROLLMENTS = ["ACTIVE", "CONFIRMED", "COMPLETED"];
const PAID_REGISTRATIONS = ["PAID", "CONVERTED"];
const ABUBAKR_EMAIL = "abubakar98114@gmail.com";

function normalized(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function profileName(profile) {
  return profile.displayName || `${profile.user.firstName} ${profile.user.lastName || ""}`.trim();
}

async function findZaran() {
  const candidates = await db.studentProfile.findMany({
    where: {
      OR: [
        { displayName: { contains: "Zaran" } },
        { user: { firstName: { contains: "Zaran" } } },
        { registrationStudents: { some: { firstName: { contains: "Zaran" }, registration: { status: { in: PAID_REGISTRATIONS } } } } },
      ],
    },
    include: {
      user: true,
      parents: { include: { parent: { include: { user: true } } } },
      registrationStudents: { include: { registration: true } },
      enrollments: { where: { status: { in: ACTIVE_ENROLLMENTS } }, include: { program: true } },
    },
  });
  const exact = candidates.filter((profile) => normalized(profileName(profile)) === "zarannisar" || profile.registrationStudents.some((item) => normalized(item.displayName || `${item.firstName} ${item.lastName || ""}`) === "zarannisar"));
  exact.sort((left, right) => {
    const leftNadia = left.parents.some((link) => normalized(`${link.parent.user.firstName} ${link.parent.user.lastName || ""}`).includes("nadia")) ? 1 : 0;
    const rightNadia = right.parents.some((link) => normalized(`${link.parent.user.firstName} ${link.parent.user.lastName || ""}`).includes("nadia")) ? 1 : 0;
    const leftPaid = left.registrationStudents.some((item) => PAID_REGISTRATIONS.includes(item.registration.status)) ? 1 : 0;
    const rightPaid = right.registrationStudents.some((item) => PAID_REGISTRATIONS.includes(item.registration.status)) ? 1 : 0;
    return rightNadia - leftNadia || rightPaid - leftPaid || right.enrollments.length - left.enrollments.length || right.createdAt.getTime() - left.createdAt.getTime();
  });
  return exact[0] || null;
}

async function syncZaran() {
  const zaran = await findZaran();
  if (!zaran) { console.warn("[roster-repair] Paid learner Zaran Nisar (Nadia's child) was not found; no Zaran changes made."); return; }
  const enrolledBySlug = new Map(zaran.enrollments.map((entry) => [entry.program.slug, entry.program]));
  const corePrograms = ["seerah", "life-lessons"].map((slug) => enrolledBySlug.get(slug)).filter(Boolean);
  const coreAssignments = corePrograms.length ? await db.teacherProgram.findMany({ where: { programId: { in: corePrograms.map((program) => program.id) }, teacher: { isActive: true, user: { status: "ACTIVE" } } }, include: { teacher: { include: { user: true } }, program: true } }) : [];

  const abubakr = await db.teacherProfile.findFirst({ where: { isActive: true, user: { email: ABUBAKR_EMAIL, status: "ACTIVE" } }, include: { user: true } });
  if (!abubakr) console.warn(`[roster-repair] Ustadh Abubakr was not found at ${ABUBAKR_EMAIL}.`);
  const languagePrograms = ["arabic", "tajweed"].map((slug) => enrolledBySlug.get(slug)).filter(Boolean);
  const assignments = [...coreAssignments];
  if (abubakr) {
    for (const program of languagePrograms) {
      await db.teacherProgram.upsert({ where: { teacherId_programId: { teacherId: abubakr.id, programId: program.id } }, update: {}, create: { teacherId: abubakr.id, programId: program.id } });
      assignments.push({ teacherId: abubakr.id, programId: program.id, teacher: abubakr, program });
    }
  }

  const unique = new Map(assignments.map((assignment) => [`${assignment.teacherId}:${assignment.programId}`, assignment]));
  for (const assignment of unique.values()) {
    await db.teacherStudentRoster.upsert({ where: { teacherId_programId_studentId: { teacherId: assignment.teacherId, programId: assignment.programId, studentId: zaran.id } }, update: {}, create: { teacherId: assignment.teacherId, programId: assignment.programId, studentId: zaran.id } });
    console.log(`[roster-repair] Zaran Nisar -> ${assignment.teacher.user.email} -> ${assignment.program.slug}`);
  }
  console.log(`[roster-repair] Zaran Nisar synchronized to ${unique.size} required teacher-program rosters.`);
}

async function deduplicateSalaar() {
  const candidates = (await db.studentProfile.findMany({
    where: { OR: [{ displayName: { contains: "Salaar" } }, { displayName: { contains: "Salar" } }, { user: { firstName: { contains: "Salaar" } } }, { user: { firstName: { contains: "Salar" } } }] },
    include: { user: true, houseMembership: true, enrollments: true, registrationStudents: { include: { registration: true } }, programRosters: true, scheduleRosters: true },
  })).filter((profile) => ["salaarkhurram", "salarkhurram"].includes(normalized(profileName(profile))) || profile.registrationStudents.some((item) => ["salaarkhurram", "salarkhurram"].includes(normalized(item.displayName || `${item.firstName} ${item.lastName || ""}`))));
  if (candidates.length < 2) { console.log(`[roster-repair] Salaar Khurram has ${candidates.length} matching profile; no duplicate repair needed.`); return; }
  candidates.sort((left, right) => {
    const leftQabila = left.houseMembership?.qabilaGroup === "Qabila Banu Asad" ? 1 : 0;
    const rightQabila = right.houseMembership?.qabilaGroup === "Qabila Banu Asad" ? 1 : 0;
    const leftPaid = left.registrationStudents.some((item) => PAID_REGISTRATIONS.includes(item.registration.status)) ? 1 : 0;
    const rightPaid = right.registrationStudents.some((item) => PAID_REGISTRATIONS.includes(item.registration.status)) ? 1 : 0;
    const leftActive = left.enrollments.filter((item) => ACTIVE_ENROLLMENTS.includes(item.status)).length;
    const rightActive = right.enrollments.filter((item) => ACTIVE_ENROLLMENTS.includes(item.status)).length;
    return rightQabila - leftQabila || rightPaid - leftPaid || rightActive - leftActive || right.createdAt.getTime() - left.createdAt.getTime();
  });
  const canonical = candidates[0];
  for (const duplicate of candidates.slice(1)) {
    if (!duplicate.user.email.endsWith("@genmumin.local")) { console.warn(`[roster-repair] Kept possible real Salaar account ${duplicate.user.email}; manual review required.`); continue; }
    for (const roster of duplicate.programRosters) await db.teacherStudentRoster.upsert({ where: { teacherId_programId_studentId: { teacherId: roster.teacherId, programId: roster.programId, studentId: canonical.id } }, update: {}, create: { teacherId: roster.teacherId, programId: roster.programId, studentId: canonical.id } });
    for (const roster of duplicate.scheduleRosters) await db.classScheduleRoster.upsert({ where: { scheduleId_studentId: { scheduleId: roster.scheduleId, studentId: canonical.id } }, update: {}, create: { scheduleId: roster.scheduleId, studentId: canonical.id } });
    await db.$transaction([
      db.teacherStudentRoster.deleteMany({ where: { studentId: duplicate.id } }),
      db.classScheduleRoster.deleteMany({ where: { studentId: duplicate.id } }),
      db.enrollment.updateMany({ where: { studentId: duplicate.id, status: { in: ACTIVE_ENROLLMENTS } }, data: { status: "CANCELLED" } }),
      db.user.update({ where: { id: duplicate.userId }, data: { status: "SUSPENDED" } }),
    ]);
    console.log(`[roster-repair] Removed duplicate generated Salaar profile ${duplicate.user.email}; retained canonical ${canonical.user.email}.`);
  }
}

async function main() {
  await syncZaran();
  await deduplicateSalaar();
}

main().catch((error) => { console.error("[roster-repair] failed", error); process.exitCode = 1; }).finally(async () => db.$disconnect());