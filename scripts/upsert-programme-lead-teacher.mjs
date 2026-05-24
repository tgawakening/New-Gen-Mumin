import { randomBytes, scryptSync } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teacher = {
  email: "globalawakeningchannel@gmail.com",
  firstName: "Programme",
  lastName: "Lead",
  password: process.env.PROGRAMME_LEAD_PASSWORD || "GenM-ProgrammeLead2026!",
  bio: "Founder & Director of TGA Platform and Gen-Mumin Programme Lead Coordinator.",
  specialties: {
    list: [
      "Whole programme coordination",
      "PGDE in Primary Education - University of Dundee",
      "BA (Hons) in E-Commerce - Glasgow Caledonian University",
      "Primary education",
      "Tafsir, Tajweed, and Seerah learning",
      "Curriculum quality assurance",
    ],
    programmeLead: true,
  },
  programSlugs: ["seerah", "life-lessons", "arabic", "tajweed"],
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
  const programIds = new Map(
    (await prisma.program.findMany({
      where: { slug: { in: teacher.programSlugs } },
      select: { id: true, slug: true },
    })).map((program) => [program.slug, program.id]),
  );

  const missing = teacher.programSlugs.filter((slug) => !programIds.has(slug));
  if (missing.length) {
    throw new Error(`Missing programmes: ${missing.join(", ")}. Run the main seed first.`);
  }

  const user = await prisma.user.upsert({
    where: { email: teacher.email },
    update: {
      passwordHash: hashPassword(teacher.password),
      role: "TEACHER",
      status: "ACTIVE",
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: teacher.email,
      passwordHash: hashPassword(teacher.password),
      role: "TEACHER",
      status: "ACTIVE",
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      emailVerifiedAt: new Date(),
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {
      bio: teacher.bio,
      specialties: teacher.specialties,
      isActive: true,
    },
    create: {
      userId: user.id,
      bio: teacher.bio,
      specialties: teacher.specialties,
      isActive: true,
    },
  });

  for (const slug of teacher.programSlugs) {
    await prisma.teacherProgram.upsert({
      where: {
        teacherId_programId: {
          teacherId: teacherProfile.id,
          programId: programIds.get(slug),
        },
      },
      update: {},
      create: {
        teacherId: teacherProfile.id,
        programId: programIds.get(slug),
      },
    });
  }

  console.log(`Programme lead teacher ready: ${teacher.email}`);
  console.log(`Password: ${teacher.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
