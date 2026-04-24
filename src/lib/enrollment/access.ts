import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const STATUS_RANK = {
  PENDING: 0,
  CONFIRMED: 1,
  ACTIVE: 2,
  COMPLETED: 3,
  CANCELLED: -1,
} as const;

type MutableEnrollmentStatus = "PENDING" | "CONFIRMED" | "ACTIVE" | "COMPLETED";

function getDisplayName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function buildStudentEmail(registrationId: string, registrationStudentId: string) {
  return `student+${registrationId.slice(-6)}-${registrationStudentId.slice(-6)}@genmumin.local`;
}

function chooseEnrollmentStatus(
  currentStatus: string | null | undefined,
  targetStatus: MutableEnrollmentStatus,
) {
  if (!currentStatus) {
    return targetStatus;
  }

  const currentRank =
    STATUS_RANK[currentStatus as keyof typeof STATUS_RANK] ?? STATUS_RANK.PENDING;
  const targetRank = STATUS_RANK[targetStatus];

  return currentRank >= targetRank
    ? (currentStatus as MutableEnrollmentStatus)
    : targetStatus;
}

async function ensureRegistrationProfiles(
  tx: Prisma.TransactionClient,
  registrationId: string,
) {
  const registration = await tx.registration.findUnique({
    where: { id: registrationId },
    include: {
      parentProfile: {
        include: {
          user: true,
        },
      },
      students: true,
      items: {
        include: {
          offer: {
            include: {
              programs: {
                include: {
                  program: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!registration || !registration.parentProfileId || !registration.parentProfile) {
    throw new Error("Registration access cannot be prepared without a parent profile.");
  }

  const studentProfileLookup = new Map<string, string>();

  for (const registrationStudent of registration.students) {
    let studentProfileId = registrationStudent.studentProfileId;

    if (!studentProfileId) {
      const studentEmail = buildStudentEmail(registration.id, registrationStudent.id);
      const fullName = getDisplayName(
        registrationStudent.firstName,
        registrationStudent.lastName,
      );

      const createdStudent = await tx.user.create({
        data: {
          email: studentEmail,
          role: "STUDENT",
          status: "ACTIVE",
          firstName: registrationStudent.firstName,
          lastName: registrationStudent.lastName || registration.parentLastName,
          timezone: registrationStudent.timezone || "Europe/London",
          studentProfile: {
            create: {
              displayName: fullName || registrationStudent.firstName,
              age: registrationStudent.age ?? undefined,
              countryCode:
                registrationStudent.countryCode ??
                registration.selectedCountryCode ??
                undefined,
              countryName:
                registrationStudent.countryName ??
                registration.selectedCountryName ??
                undefined,
            },
          },
        },
        include: {
          studentProfile: true,
        },
      });

      if (!createdStudent.studentProfile) {
        throw new Error("Unable to create the student profile for this registration.");
      }

      studentProfileId = createdStudent.studentProfile.id;

      await tx.registrationStudent.update({
        where: { id: registrationStudent.id },
        data: {
          studentProfileId,
          displayName: fullName || registrationStudent.displayName,
        },
      });
    }

    studentProfileLookup.set(registrationStudent.id, studentProfileId);

    await tx.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: registration.parentProfileId,
          studentId: studentProfileId,
        },
      },
      update: {
        relation: "Guardian",
      },
      create: {
        parentId: registration.parentProfileId,
        studentId: studentProfileId,
        relation: "Guardian",
      },
    });
  }

  return { registration, studentProfileLookup };
}

export async function provisionRegistrationAccess(
  tx: Prisma.TransactionClient,
  registrationId: string,
  targetStatus: MutableEnrollmentStatus,
) {
  const { registration, studentProfileLookup } = await ensureRegistrationProfiles(
    tx,
    registrationId,
  );
  const parentId = registration.parentProfileId as string;

  for (const item of registration.items) {
    const studentProfileId = studentProfileLookup.get(item.registrationStudentId);

    if (!studentProfileId) {
      continue;
    }

    for (const offerProgram of item.offer.programs) {
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          studentId_programId: {
            studentId: studentProfileId,
            programId: offerProgram.programId,
          },
        },
      });

      const nextStatus = chooseEnrollmentStatus(existingEnrollment?.status, targetStatus);
      const activationDate =
        nextStatus === "ACTIVE" || nextStatus === "COMPLETED" ? new Date() : null;

      await tx.enrollment.upsert({
        where: {
          studentId_programId: {
            studentId: studentProfileId,
            programId: offerProgram.programId,
          },
        },
        update: {
          parentId,
          scholarshipPercent: item.scholarshipPercent ?? undefined,
          status: nextStatus,
          startedAt: existingEnrollment?.startedAt ?? activationDate ?? undefined,
          completedAt:
            nextStatus === "COMPLETED"
              ? existingEnrollment?.completedAt ?? new Date()
              : existingEnrollment?.completedAt ?? undefined,
        },
        create: {
          studentId: studentProfileId,
          parentId,
          programId: offerProgram.programId,
          status: targetStatus,
          scholarshipPercent: item.scholarshipPercent ?? undefined,
          startedAt: targetStatus === "ACTIVE" ? new Date() : undefined,
        },
      });
    }
  }
}

export async function activateOrderEnrollments(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      registrationId: true,
    },
  });

  if (!order?.registrationId) {
    return;
  }

  await db.$transaction(async (tx) => {
    await provisionRegistrationAccess(tx, order.registrationId!, "ACTIVE");
  });
}
