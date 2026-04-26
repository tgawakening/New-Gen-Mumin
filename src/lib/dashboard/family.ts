import "server-only";

import { PaymentStatus, SubmissionStatus, UserRole } from "@prisma/client";

import { db } from "@/lib/db";

type ChildCourseSummary = {
  id: string;
  title: string;
  status: string;
  startedAt: Date | null;
  meetingCount: number;
};

type ChildScheduleSummary = {
  id: string;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingUrl: string | null;
  teacherName: string | null;
  provider: string | null;
};

type ChildQuizSummary = {
  id: string;
  title: string;
  type: string;
  questionCount: number;
  totalPoints: number;
  timeLimitSeconds: number | null;
  bestScore: number | null;
  latestScore: number | null;
  latestSubmittedAt: Date | null;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    score: number | null;
    submittedAt: Date | null;
    feedback: string | null;
  }>;
};

type ChildAssignmentSummary = {
  id: string;
  programTitle: string;
  title: string;
  instructions: string | null;
  dueDate: Date | null;
  status: SubmissionStatus | "NOT_STARTED";
  grade: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: Date | null;
};

type ChildLessonUpdateSummary = {
  id: string;
  programTitle: string;
  scheduleTitle: string;
  lessonDate: Date;
  topic: string;
  summary: string;
  homework: string | null;
  teacherName: string | null;
};

type ChildBadgeSummary = {
  id: string;
  title: string;
  status: "earned" | "progress";
  description: string;
};

type ChildProgressSummary = {
  id: string;
  programTitle: string;
  reportPeriod: string;
  attendancePct: number | null;
  grade: string | null;
  strengths: string | null;
  nextSteps: string | null;
};

type ChildJournalSummary = {
  id: string;
  title: string;
  reflection: string;
  practiceMinutes: number;
  selfRating: string | null;
  teacherFeedback: string | null;
  status: SubmissionStatus;
  submittedAt: Date;
};

type ChildSummary = {
  id: string;
  name: string;
  statusLabel: string;
  accessLocked: boolean;
  attendanceRate: number;
  attendanceBreakdown: Array<{ label: string; value: number }>;
  courses: ChildCourseSummary[];
  schedule: ChildScheduleSummary[];
  nextClass: ChildScheduleSummary | null;
  quizzes: ChildQuizSummary[];
  assignments: ChildAssignmentSummary[];
  lessonUpdates: ChildLessonUpdateSummary[];
  badges: ChildBadgeSummary[];
  progress: ChildProgressSummary[];
  journals: ChildJournalSummary[];
  profile: {
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    timezone: string | null;
    countryName: string | null;
    age: number | null;
    currentGrade: string | null;
  };
};

export type ParentDashboardData = {
  parentName: string;
  parentProfile: {
    email: string;
    phone: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
    billingCountryCode: string | null;
    billingCountryName: string | null;
    preferredCurrency: string | null;
  };
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
    return "Finish the subscription checkout to unlock classes, quizzes, assignments, and schedule access.";
  }

  if (orderStatus === "REQUIRES_ACTION") {
    return "Your payment needs one more action before the dashboard can unlock.";
  }

  return "Your enrollment is being prepared. Please check back shortly.";
}

function computeAttendanceBreakdown(attendances: Array<{ status: string }>, totalEnrollments: number) {
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

function buildTeacherName(
  teacher?: { user?: { firstName: string; lastName: string } | null } | null,
) {
  if (!teacher?.user) {
    return null;
  }

  return `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
}

function mapScheduleEntries(enrollments: any[]): ChildScheduleSummary[] {
  return enrollments
    .flatMap((enrollment) =>
      enrollment.program.schedules.map((schedule: any) => ({
        id: schedule.id,
        title: enrollment.program.title,
        weekday: schedule.weekday,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: schedule.timezone,
        meetingUrl: schedule.meetingUrl,
        teacherName: buildTeacherName(schedule.teacher),
        provider: schedule.meetingProvider,
      })),
    )
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }

      return left.startTime.localeCompare(right.startTime);
    });
}

function mapQuizSummaries(quizzes: any[], quizAttempts: any[]) {
  return quizzes.map((quiz) => {
    const attempts = quizAttempts
      .filter((attempt) => attempt.quizId === quiz.id)
      .sort((left, right) => right.attemptNumber - left.attemptNumber);

    const scores = attempts
      .map((attempt) => attempt.manualScore ?? attempt.autoScore)
      .filter((score): score is number => score !== null && score !== undefined);

    return {
      id: quiz.id,
      title: quiz.title,
      type: quiz.type.replace(/_/g, " "),
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((total: number, question: any) => total + question.points, 0),
      timeLimitSeconds: quiz.timeLimitSeconds,
      bestScore: scores.length ? Math.max(...scores) : null,
      latestScore: attempts[0] ? attempts[0].manualScore ?? attempts[0].autoScore ?? null : null,
      latestSubmittedAt: attempts[0]?.submittedAt ?? null,
      attempts: attempts.slice(0, 5).map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        score: attempt.manualScore ?? attempt.autoScore ?? null,
        submittedAt: attempt.submittedAt,
        feedback: attempt.feedback,
      })),
    } satisfies ChildQuizSummary;
  });
}

function mapAssignmentSummaries(enrollments: any[], submissions: any[]) {
  const assignments = enrollments.flatMap((enrollment) =>
    enrollment.program.assignments.map((assignment: any) => {
      const submission = submissions.find((entry) => entry.assignmentId === assignment.id) ?? null;

      return {
        id: assignment.id,
        programTitle: enrollment.program.title,
        title: assignment.title,
        instructions: assignment.instructions ?? null,
        dueDate: assignment.dueDate,
        status: submission?.status ?? "NOT_STARTED",
        grade: submission?.grade ?? null,
        score: submission?.score ?? null,
        feedback: submission?.feedback ?? null,
        submittedAt: submission?.submittedAt ?? null,
      } satisfies ChildAssignmentSummary;
    }),
  );

  return assignments.sort((left, right) => {
    if (left.dueDate && right.dueDate) {
      return left.dueDate.getTime() - right.dueDate.getTime();
    }

    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return left.title.localeCompare(right.title);
  });
}

function mapLessonUpdates(enrollments: any[]) {
  return enrollments
    .flatMap((enrollment) =>
      enrollment.program.schedules.flatMap((schedule: any) =>
        (schedule.lessonLogs ?? []).map((log: any) => ({
          id: log.id,
          programTitle: enrollment.program.title,
          scheduleTitle: schedule.title,
          lessonDate: log.lessonDate,
          topic: log.topic,
          summary: log.summary,
          homework: log.homework ?? null,
          teacherName: buildTeacherName(schedule.teacher),
        })),
      ),
    )
    .sort((left, right) => right.lessonDate.getTime() - left.lessonDate.getTime())
    .slice(0, 8) satisfies ChildLessonUpdateSummary[];
}

function buildChildBadges({
  attendanceRate,
  quizCount,
  submittedAssignments,
  journalCount,
}: {
  attendanceRate: number;
  quizCount: number;
  submittedAssignments: number;
  journalCount: number;
}) {
  const badges: ChildBadgeSummary[] = [];

  badges.push({
    id: "attendance",
    title: attendanceRate >= 90 ? "Attendance Star" : "Attendance Journey",
    status: attendanceRate >= 90 ? "earned" : "progress",
    description:
      attendanceRate >= 90
        ? "Excellent consistency in joining lessons on time."
        : `Current attendance is ${attendanceRate}%. Keep showing up and this badge can unlock soon.`,
  });

  badges.push({
    id: "tasks",
    title: submittedAssignments >= 3 ? "Task Champion" : "Task Builder",
    status: submittedAssignments >= 3 ? "earned" : "progress",
    description:
      submittedAssignments >= 3
        ? "Weekly tasks are being completed consistently."
        : `${submittedAssignments} task submissions recorded so far. More regular submissions will unlock this badge.`,
  });

  badges.push({
    id: "reflection",
    title: journalCount >= 2 ? "Reflection Gem" : "Reflection Starter",
    status: journalCount >= 2 ? "earned" : "progress",
    description:
      journalCount >= 2
        ? "Journal reflections are building thoughtful learning habits."
        : "Journal entries and self-reflection will turn into visible recognition here.",
  });

  badges.push({
    id: "assessment",
    title: quizCount >= 2 ? "Quiz Explorer" : "Quiz Warm-up",
    status: quizCount >= 2 ? "earned" : "progress",
    description:
      quizCount >= 2
        ? "Assessment activity is active and developing nicely."
        : "As quizzes and lesson checks are completed, assessment badges will appear here.",
  });

  return badges;
}

function mapChildSummary(child: any, accessLocked: boolean): ChildSummary {
  const { attendanceRate, attendanceBreakdown } = computeAttendanceBreakdown(
    child.attendances,
    child.enrollments.length,
  );

  const schedule = mapScheduleEntries(child.enrollments);
  const programQuizzes = child.enrollments.flatMap((enrollment: any) => enrollment.program.quizzes);
  const quizzes = mapQuizSummaries(programQuizzes, child.quizAttempts);
  const assignments = mapAssignmentSummaries(child.enrollments, child.assignments);
  const lessonUpdates = mapLessonUpdates(child.enrollments);
  const submittedAssignments = assignments.filter((assignment) =>
    assignment.status === "SUBMITTED" || assignment.status === "REVIEWED",
  ).length;
  const badges = buildChildBadges({
    attendanceRate,
    quizCount: quizzes.filter((quiz) => quiz.attempts.length > 0).length,
    submittedAssignments,
    journalCount: child.journalEntries.length,
  });

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
      startedAt: enrollment.startedAt,
      meetingCount: enrollment.program.schedules.length,
    })),
    schedule,
    nextClass: schedule[0] ?? null,
    quizzes,
    assignments,
    lessonUpdates,
    badges,
    progress: child.progressReports.map((report: any) => ({
      id: report.id,
      programTitle: report.program.title,
      reportPeriod: report.reportPeriod,
      attendancePct: report.attendancePct,
      grade: report.grade,
      strengths: report.strengths,
      nextSteps: report.nextSteps,
    })),
    journals: child.journalEntries.map((entry: any) => ({
      id: entry.id,
      title: entry.title,
      reflection: entry.reflection,
      practiceMinutes: entry.practiceMinutes,
      selfRating: entry.selfRating,
      teacherFeedback: entry.teacherFeedback,
      status: entry.status,
      submittedAt: entry.submittedAt,
    })),
    profile: {
      displayName:
        child.displayName ||
        `${child.user.firstName} ${child.user.lastName}`.trim() ||
        child.user.firstName,
      firstName: child.user.firstName,
      lastName: child.user.lastName,
      email: child.user.email,
      phone:
        child.user.phoneCountryCode && child.user.phoneNumber
          ? `${child.user.phoneCountryCode} ${child.user.phoneNumber}`
          : child.user.phoneNumber ?? null,
      timezone: child.user.timezone,
      countryName: child.countryName,
      age: child.age,
      currentGrade: child.currentGrade,
    },
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
                        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                        include: {
                          teacher: {
                            include: {
                              user: true,
                            },
                          },
                          lessonLogs: {
                            orderBy: { lessonDate: "desc" },
                            take: 6,
                          },
                        },
                      },
                      quizzes: {
                        where: { isPublished: true },
                        include: {
                          questions: {
                            orderBy: { sortOrder: "asc" },
                          },
                        },
                      },
                      assignments: {
                        orderBy: { dueDate: "asc" },
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
                orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
                take: 20,
                include: {
                  quiz: true,
                },
              },
              assignments: {
                orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
                take: 20,
              },
              journalEntries: {
                orderBy: { submittedAt: "desc" },
                take: 8,
              },
              progressReports: {
                orderBy: { updatedAt: "desc" },
                take: 8,
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

  const accessLocked = !hasUnlockedAccess && (!!latestOrder || parentProfile.students.length > 0);
  const pendingReason = accessLocked
    ? resolvePendingReason(latestOrder?.status, latestOrder?.gateway ?? null)
    : null;

  return {
    parentName: `${parentProfile.user.firstName} ${parentProfile.user.lastName}`.trim(),
    parentProfile: {
      email: parentProfile.user.email,
      phone:
        parentProfile.user.phoneCountryCode && parentProfile.user.phoneNumber
          ? `${parentProfile.user.phoneCountryCode} ${parentProfile.user.phoneNumber}`
          : parentProfile.user.phoneNumber ?? null,
      phoneCountryCode: parentProfile.user.phoneCountryCode,
      phoneNumber: parentProfile.user.phoneNumber,
      billingCountryCode: parentProfile.billingCountryCode,
      billingCountryName: parentProfile.billingCountryName,
      preferredCurrency: parentProfile.preferredCurrency,
    },
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
    children: parentProfile.students.map(({ student }) => mapChildSummary(student, accessLocked)),
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
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                include: {
                  teacher: {
                    include: {
                      user: true,
                    },
                  },
                  lessonLogs: {
                    orderBy: { lessonDate: "desc" },
                    take: 6,
                  },
                },
              },
              quizzes: {
                where: { isPublished: true },
                include: {
                  questions: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
              assignments: {
                orderBy: { dueDate: "asc" },
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
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: { quiz: true },
      },
      assignments: {
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
      },
      journalEntries: {
        orderBy: { submittedAt: "desc" },
        take: 8,
      },
      progressReports: {
        orderBy: { updatedAt: "desc" },
        take: 8,
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
    child: mapChildSummary(studentProfile, accessLocked),
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
