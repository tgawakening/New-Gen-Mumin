import { db } from "@/lib/db";

export async function getAdminDashboardData() {
  const [
    totalStudents,
    activeEnrollments,
    pendingRegistrations,
    unreadMessages,
    paidRevenue,
    recentRegistrations,
    paymentReviewQueue,
    scholarshipQueue,
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
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        students: true,
        items: { include: { offer: true } },
        order: true,
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
  ]);

  return {
    metrics: {
      totalStudents,
      activeEnrollments,
      pendingRegistrations,
      unreadMessages,
      revenueGbp: paidRevenue._sum.totalAmount ?? 0,
    },
    recentRegistrations,
    paymentReviewQueue,
    scholarshipQueue,
  };
}
