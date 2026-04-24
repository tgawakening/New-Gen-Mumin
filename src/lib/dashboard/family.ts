import "server-only";

import { PaymentStatus, UserRole } from "@prisma/client";

import { db } from "@/lib/db";

type ChildSummary = {
  id: string;
  name: string;
  statusLabel: string;
  accessLocked: boolean;
  attendanceRate: number;
  attendanceBreakdown: Array<{ label: string; value: number }>;
  courses: Array<{ id: string; title: string; status: string }>;
  nextClass: {
    title: string;
    weekday: number;
    startTime: string;
    meetingUrl: string | null;
    teacherName: string | null;
  } | null;
  quizzes: Array<{ title: string; submittedAt: Date | null; score: number | null; type: string }>;
  progress: Array<{ programTitle: string; grade: string | null; attendancePct: number | null }>;
  journals: Array<{ title: string; submittedAt: Date; practiceMinutes: number; selfRating: string | null }>;
};

export type ParentDashboardData = {
  parentName: string;
  accessLocked: boolean;
  accessStateLabel: string;
  pendingReason: string | null;
  latestOrder: {
    orderNumber: string;
    status: PaymentStatus;
    totalAmount: number;
    currency: string;
    gateway: string;
  } | null;
  children: ChildSummary[];
};

export type StudentDashboardData = {
  studentName: string;
  accessLocked: boolean;
  accessStateLabel: string;
  pendingReason: string | null;
  child: ChildSummary;
};

function formatAccessState(accessLocked: boolean) {
  return accessLocked ? "Pending activation" : "Learning unlocked";
}

function resolvePendingReason(orderStatus?: PaymentStatus | null, gateway?: string | null) {
  if (!orderStatus) {
    return "Complete enrollment and payment to unlock the learning workspace.";
  }

  if (gateway === "BANK_TRANSFER" && orderStatus === "UNDER_REVIEW") {
    return "Your manual payment proof is under review. Courses will unlock after admin confirmation.";
  }

  if (orderStatus === "PENDING" || orderStatus === "INITIATED") {
    return "Finish the subscription checkout to unlock classes, quizzes, and schedule access.";
  }

  if (orderStatus === "REQUIRES_ACTION") {
    return "Your payment needs another action before the dashboard can unlock.";
  }

  return "Your enrollment is being prepared. Please check back shortly.";
}

function computeAttendanceBreakdown(
  attendances: Array<{ status: string }>,
  totalEnrollments: number,
) {
  const breakdown = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
  };

  for (const attendance of attendances) {
    if (attendance.status in breakdown) {
      breakdown[attendance.status as keyof typeof breakdown] += 1;
    }
  }

  const totalRecords = attendances.length || totalEnrollments || 1;
  const attendanceRate = Math.round((breakdown.PRESENT / totalRecords) * 100);

  return {
    attendanceRate,
    attendanceBreakdown: [
      { label: "Present", value: breakdown.PRESENT },
      { label: "Late", value: breakdown.LATE },
      { label: "Absent", value: breakdown.ABSENT },
      { label: "Excused", value: breakdown.EXCUSED },
    ],
  };
}

function getWeekdayLabel(weekday: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday] ?? "Class";
}

function mapChildSummary(child: any, accessLocked: boolean): ChildSummary {
  const allAttendances = child.attendances;
  const { attendanceRate, attendanceBreakdown } = computeAttendanceBreakdown(
    allAttendances,
    child.enrollments.length,
  );

  const upcomingSchedules = child.enrollments
    .flatMap((enrollment: any) =>
      enrollment.program.schedules.map((schedule: any) => ({
        title: enrollment.program.title,
        weekday: schedule.weekday,
        startTime: schedule.startTime,
        meetingUrl: schedule.meetingUrl,
        teacherName: schedule.teacher?.user
          ? `${schedule.teacher.user.firstName} ${schedule.teacher.user.lastName}`.trim()
          : null,
      })),
    )
    .sort((left: any, right: any) => left.weekday - right.weekday);

  return {
    id: child.id,
    name:
      child.displayName ||
      `${child.user.firstName} ${child.user.lastName}`.trim() ||
      child.user.firstName,
    statusLabel: accessLocked
      ? "Pending payment confirmation"
      : child.enrollments.some((enrollment: any) => enrollment.status === "ACTIVE")
        ? "Active learner"
        : "Ready",
    accessLocked,
    attendanceRate,
    attendanceBreakdown,
    courses: child.enrollments.map((enrollment: any) => ({
      id: enrollment.id,
      title: enrollment.program.title,
      status: enrollment.status.replace(/_/g, " "),
    })),
    nextClass: upcomingSchedules[0] ?? null,
    quizzes: child.quizAttempts.slice(0, 4).map((attempt: any) => ({
      title: attempt.quiz.title,
      submittedAt: attempt.submittedAt,
      score:
        attempt.manualScore ?? attempt.autoScore ?? null,
      type: attempt.quiz.type.replace(/_/g, " "),
    })),
    progress: child.progressReports.slice(0, 4).map((report: any) => ({
      programTitle: report.program.title,
      grade: report.grade,
      attendancePct: report.attendancePct,
    })),
    journals: child.journalEntries.slice(0, 3).map((entry: any) => ({
      title: entry.title,
      submittedAt: entry.submittedAt,
      practiceMinutes: entry.practiceMinutes,
      selfRating: entry.selfRating,
    })),
  };
}

async function getParentProfile(userId: string) {
  return db.parentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      students: {
        include: {
          student: {
            include: {
              user: true,
              enrollments: {
                orderBy: { createdAt: "desc" },
                include: {
                  program: {
                    include: {
                      schedules: {
                        orderBy: { weekday: "asc" },
                        include: {
                          teacher: {
                            include: {
                              user: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              attendances: {
                orderBy: { lessonDate: "desc" },
                take: 18,
              },
              quizAttempts: {
                orderBy: { submittedAt: "desc" },
                take: 6,
                include: {
                  quiz: true,
                },
              },
              journalEntries: {
                orderBy: { submittedAt: "desc" },
                take: 4,
              },
              progressReports: {
                orderBy: { updatedAt: "desc" },
                take: 4,
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
}

export async function getParentDashboardData(userId: string) {
  const parentProfile = await getParentProfile(userId);

  if (!parentProfile) {
    return null;
  }

  const latestOrder = parentProfile.orders[0] ?? null;
  const hasUnlockedAccess = parentProfile.students.some(({ student }) =>
    student.enrollments.some((enrollment) =>
      ["ACTIVE", "COMPLETED", "CONFIRMED"].includes(enrollment.status),
    ),
  );

  const accessLocked =
    !hasUnlockedAccess &&
    (!!latestOrder || parentProfile.students.length > 0);

  const pendingReason = accessLocked
    ? resolvePendingReason(latestOrder?.status, latestOrder?.gateway ?? null)
    : null;

  return {
    parentName: `${parentProfile.user.firstName} ${parentProfile.user.lastName}`.trim(),
    accessLocked,
    accessStateLabel: formatAccessState(accessLocked),
    pendingReason,
    latestOrder: latestOrder
      ? {
          orderNumber: latestOrder.orderNumber,
          status: latestOrder.status,
          totalAmount: latestOrder.totalAmount,
          currency: latestOrder.currency,
          gateway: latestOrder.gateway,
        }
      : null,
    children: parentProfile.students.map(({ student }) =>
      mapChildSummary(student, accessLocked),
    ),
  } satisfies ParentDashboardData;
}

export async function getStudentDashboardData(userId: string) {
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      parents: {
        include: {
          parent: {
            include: {
              orders: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          program: {
            include: {
              schedules: {
                orderBy: { weekday: "asc" },
                include: {
                  teacher: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      attendances: {
        orderBy: { lessonDate: "desc" },
        take: 18,
      },
      quizAttempts: {
        orderBy: { submittedAt: "desc" },
        take: 6,
        include: { quiz: true },
      },
      journalEntries: {
        orderBy: { submittedAt: "desc" },
        take: 4,
      },
      progressReports: {
        orderBy: { updatedAt: "desc" },
        take: 4,
        include: { program: true },
      },
    },
  });

  if (!studentProfile) {
    return null;
  }

  const latestOrder = studentProfile.parents[0]?.parent.orders[0] ?? null;
  const accessLocked = !studentProfile.enrollments.some((enrollment) =>
    ["ACTIVE", "COMPLETED", "CONFIRMED"].includes(enrollment.status),
  );

  const child = mapChildSummary(
    {
      ...studentProfile,
      user: studentProfile.user,
    },
    accessLocked,
  );

  return {
    studentName:
      studentProfile.displayName ||
      `${studentProfile.user.firstName} ${studentProfile.user.lastName}`.trim() ||
      studentProfile.user.firstName,
    accessLocked,
    accessStateLabel: formatAccessState(accessLocked),
    pendingReason: accessLocked
      ? resolvePendingReason(latestOrder?.status, latestOrder?.gateway ?? null)
      : null,
    child,
  } satisfies StudentDashboardData;
}

export function getDashboardHomeForRole(role: UserRole) {
  switch (role) {
    case "PARENT":
      return "/parent";
    case "STUDENT":
      return "/student";
    case "TEACHER":
      return "/teacher";
    case "ADMIN":
      return "/admin";
    default:
      return "/auth/login";
  }
}
