import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ABDUL_EMAIL = "abdelbadeaghonamy@gmail.com";
const ABDUL_PASSWORD_HASH = "adfd1d13368b24449e1b91066218665c:633334817ea5f0790f2f8a669826d0fadeae4c13ac64971b2497d9c842c82fd212f3150341fef79c6d2aab95e5e3ffefe02f0db7460c0db57b28119d998cb741";
const ADVANCED_TEACHER_EMAILS = ["zainab.tajweed.genm@gmail.com", "abubakarsaeed.genm@gmail.com"];
const REMOVED_TEACHER_EMAILS = [...ADVANCED_TEACHER_EMAILS, "mussab.gardening.genm@gmail.com"];
const TARGET_PROGRAM_SLUGS = ["arabic", "tajweed"];

async function preserveScheduleRosterAndTransfer(tx, schedule, oldTeacherId, newTeacherId) {
  const roster = await tx.teacherStudentRoster.findMany({
    where: { teacherId: oldTeacherId, programId: schedule.programId },
    select: { studentId: true },
  });
  if (roster.length) {
    await tx.classScheduleRoster.createMany({
      data: roster.map((entry) => ({ scheduleId: schedule.id, studentId: entry.studentId })),
      skipDuplicates: true,
    });
  }
  await tx.classSchedule.update({ where: { id: schedule.id }, data: { teacherId: newTeacherId } });
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const programs = await tx.program.findMany({
      where: { slug: { in: TARGET_PROGRAM_SLUGS } },
      select: { id: true, slug: true },
    });
    if (programs.length !== TARGET_PROGRAM_SLUGS.length) throw new Error("Arabic and Tajweed programmes must exist before teacher transition.");
    const targetProgramIds = new Set(programs.map((program) => program.id));

    const user = await tx.user.upsert({
      where: { email: ABDUL_EMAIL },
      update: { role: "TEACHER", status: "ACTIVE", firstName: "Abdul", lastName: "Badee", emailVerifiedAt: new Date() },
      create: { email: ABDUL_EMAIL, passwordHash: ABDUL_PASSWORD_HASH, role: "TEACHER", status: "ACTIVE", firstName: "Abdul", lastName: "Badee", emailVerifiedAt: new Date(), timezone: "Europe/London" },
    });
    const abdul = await tx.teacherProfile.upsert({
      where: { userId: user.id },
      update: { isActive: true, bio: "Advanced Arabic and Qur'anic Tajweed teacher.", specialties: ["Advanced Arabic", "Qur'anic Tajweed", "Recitation and pronunciation"] },
      create: { userId: user.id, isActive: true, bio: "Advanced Arabic and Qur'anic Tajweed teacher.", specialties: ["Advanced Arabic", "Qur'anic Tajweed", "Recitation and pronunciation"] },
    });

    await tx.teacherProgram.deleteMany({ where: { teacherId: abdul.id, programId: { notIn: [...targetProgramIds] } } });
    for (const program of programs) {
      await tx.teacherProgram.upsert({
        where: { teacherId_programId: { teacherId: abdul.id, programId: program.id } },
        update: {},
        create: { teacherId: abdul.id, programId: program.id },
      });
    }

    const removedTeachers = await tx.teacherProfile.findMany({
      where: { user: { email: { in: REMOVED_TEACHER_EMAILS } } },
      include: { user: true, classSchedules: true, programRosters: true },
    });
    const advancedTeachers = removedTeachers.filter((teacher) => ADVANCED_TEACHER_EMAILS.includes(teacher.user.email.toLowerCase()));

    for (const teacher of advancedTeachers) {
      for (const roster of teacher.programRosters.filter((entry) => targetProgramIds.has(entry.programId))) {
        await tx.teacherStudentRoster.upsert({
          where: { teacherId_programId_studentId: { teacherId: abdul.id, programId: roster.programId, studentId: roster.studentId } },
          update: {},
          create: { teacherId: abdul.id, programId: roster.programId, studentId: roster.studentId },
        });
      }
      for (const schedule of teacher.classSchedules.filter((entry) => targetProgramIds.has(entry.programId))) {
        await preserveScheduleRosterAndTransfer(tx, schedule, teacher.id, abdul.id);
      }
    }

    const mussab = removedTeachers.find((teacher) => teacher.user.email.toLowerCase() === "mussab.gardening.genm@gmail.com");
    if (mussab?.classSchedules.length) {
      const coordinator = await tx.teacherProfile.findFirst({
        where: {
          isActive: true,
          user: { status: "ACTIVE", email: { in: ["globalawakeningchannel@gmail.com", "javeriariaz145@gmail.com"] } },
        },
        orderBy: { user: { email: "asc" } },
      });
      if (!coordinator) throw new Error("A programme coordinator is required to preserve Sir Mussab's historical schedules.");
      for (const schedule of mussab.classSchedules) await preserveScheduleRosterAndTransfer(tx, schedule, mussab.id, coordinator.id);
    }

    for (const teacher of removedTeachers) {
      await tx.session.deleteMany({ where: { userId: teacher.userId } });
      await tx.teacherProgram.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherStudentRoster.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherProfile.update({ where: { id: teacher.id }, data: { isActive: false } });
      await tx.user.update({ where: { id: teacher.userId }, data: { status: "SUSPENDED" } });
    }

    return { transferredTeachers: advancedTeachers.length, removedTeachers: removedTeachers.length, abdulEmail: user.email };
  }, { maxWait: 10000, timeout: 30000 });
  console.log("Teacher transition complete", result);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
