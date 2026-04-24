import { db } from "@/lib/db";

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.split(":").slice(1).join(":").trim() : null;
}

export async function getAdminDashboardData() {
  const [
    totalStudents,
    activeEnrollments,
    pendingRegistrations,
    unreadMessages,
    paidRevenue,
    activePrograms,
    activeTeachers,
    recentRegistrations,
    recentOrders,
    paymentReviewQueue,
    scholarshipQueue,
    latestStudents,
    contactInbox,
    programsSnapshot,
  ] = await Promise.all([
    db.studentProfile.count(),
    db.enrollment.count({ where: { status: "ACTIVE" } }),
    db.registration.count({
      where: {
        status: { in: ["DRAFT", "SUBMITTED", "PENDING_PAYMENT", "PAYMENT_REVIEW"] },
      },
    }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.order.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { totalAmount: true },
    }),
    db.program.count({ where: { status: "PUBLISHED" } }),
    db.teacherProfile.count({ where: { isActive: true } }),
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        students: true,
        items: { include: { offer: true } },
        order: true,
      },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        parent: {
          include: {
            user: true,
          },
        },
        payments: true,
      },
    }),
    db.paymentTransaction.findMany({
      where: { status: { in: ["PENDING", "UNDER_REVIEW", "REQUIRES_ACTION"] } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            parent: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.scholarshipApplication.findMany({
      where: { status: "PENDING" },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        offer: { select: { title: true } },
      },
    }),
    db.studentProfile.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        parents: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            program: true,
          },
        },
      },
    }),
    db.contactMessage.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    db.program.findMany({
      take: 8,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            schedules: true,
            enrollments: true,
            quizzes: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      totalStudents,
      activeEnrollments,
      pendingRegistrations,
      unreadMessages,
      revenueGbp: paidRevenue._sum.totalAmount ?? 0,
      activePrograms,
      activeTeachers,
    },
    recentRegistrations,
    recentOrders,
    paymentReviewQueue,
    scholarshipQueue,
    latestStudents,
    contactInbox,
    programsSnapshot,
  };
}

export async function getExternalAdminOverview() {
  const data = await getAdminDashboardData();

  return {
    metrics: data.metrics,
    recentRegistrations: data.recentRegistrations.map((registration) => ({
      id: registration.id,
      parentName: `${registration.parentFirstName} ${registration.parentLastName}`.trim(),
      parentEmail: registration.parentEmail,
      status: registration.status,
      currency: registration.selectedCurrency,
      totalAmount: registration.totalAmount,
      studentCount: registration.students.length,
      createdAt: registration.createdAt,
      country: registration.selectedCountryName,
      source: extractNoteValue(registration.notes, "Source"),
      referrer: extractNoteValue(registration.notes, "Referrer"),
    })),
  };
}
