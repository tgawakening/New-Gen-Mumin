import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = "genmumin.coprojectmanager@tgawakening.com";
const initialPasswordHash = "920f25a47435a4569f4701a2f11f4c38:645449115e91de340df20c0857e98143b6e23c77f56142e8e390cf2a14e90fe3a56df724c9575856d57f1e030c784b4cc6781f6e426391a3a6f245f95d23f02b";
const title = "GEN_MUMIN_CO_PROJECT_MANAGER_NO_FINANCE";


async function main() {
  const existing = await prisma.user.findUnique({ where: { email }, include: { adminProfile: true } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: initialPasswordHash,
        role: "ADMIN",
        status: "ACTIVE",
        firstName: "Gen-Mumin",
        lastName: "Co-Project Manager",
        emailVerifiedAt: new Date(),
        adminProfile: { create: { title } },
      },
    });
    console.log("[restricted-admin] Co-project-manager account created.");
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: "ADMIN",
      status: "ACTIVE",
      firstName: "Gen-Mumin",
      lastName: "Co-Project Manager",
      adminProfile: existing.adminProfile
        ? { update: { title } }
        : { create: { title } },
    },
  });
  console.log("[restricted-admin] Co-project-manager permissions synchronized.");
}

main().catch((error) => {
  console.error("[restricted-admin] Account synchronization failed:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());