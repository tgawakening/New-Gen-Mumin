import "server-only";

import { db } from "@/lib/db";

export type TeacherDashboardData = {
  teacherName: string;
  profile: {
    bio: string | null;
    specialties: string[];
    timezone: string | null;
    email: string;
    phone: string | null;
  };
  metrics: {
    assignedClasses: number;
    upcomingLessons: number;
    students: number;
    quizzesToReview: number;
    journalReviews: number;
  };
  classes: Array<{
    id: string;
    programId: string;
    title: string;
    weekday: number;
    startTime: string;
    endTime: string;
    timezone: string;
    meetingUrl: string | null;
    provider: string | null;
    studentCount: number;
    activeEnrollments: number;
  }>;
  rosters: Array<{
    programId: string;
    title: string;
    assignmentCount: number;
    students: Array<{
      id: string;
      name: string;
      email: string;
      enrollmentStatus: string;
    }>;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    type: string;
    questionCount: number;
    published: boolean;
    attempts: number;
    pendingManualReview: number;
  }>;
  quizReviewQueue: Array<{
    id: string;
    studentName: string;
    quizTitle: string;
    submittedAt: Date | null;
    score: number | null;
    feedback: string | null;
  }>;
  journals: Array<{
    id: string;
    studentName: string;
    title: string;
    practiceMinutes: number;
    selfRating: string | null;
    submittedAt: Date;
    teacherFeedback: string | null;
  }>;
  lessonLogs: Array<{
    id: string;
    title: string;
    lessonDate: Date;
    topic: string;
    summary: string;
    homework: string | null;
  }>;
  assignments: Array<{
    id: string;
    programId: string;
    programTitle: string;
    title: string;
    instructions: string | null;
    dueDate: Date | null;
    submissions: number;
  }>;
  reports: Array<{
    id: string;
    studentName: string;
    programTitle: string;
    grade: string | null;
    attendancePct: number | null;
    reportPeriod: string;
  }>;
};

export async function getTeacherDashboardData(userId: string) {
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      classSchedules: {
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        include: {
          program: {
            include: {
              enrollments: {
                include: {
                  student: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
              quizzes: {
                include: {
                  questions: true,
                  attempts: true,
                },
              },
              assignments: {
                include: {
                  submissions: true,
                },
              },
            },
          },
          lessonLogs: {
            orderBy: { lessonDate: "desc" },
            take: 12,
          },
        },
      },
      programAssignments: {
        include: {
          program: {
            include: {
              enrollments: {
                include: {
                  student: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
              quizzes: {
                include: {
                  questions: true,
                  attempts: {
                    include: {
                      student: {
                        include: {
                          user: true,
                        },
                      },
                    },
                  },
                },
              },
              assignments: {
                include: {
                  submissions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teacherProfile) {
    return null;
  }

  const journals = await db.journalEntry.findMany({
    where: {
      enrollment: {
        program: {
          teacherAssignments: {
            some: {
              teacherId: teacherProfile.id,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 18,
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
  });

  const reports = await db.progressReport.findMany({
    where: {
      program: {
        teacherAssignments: {
          some: {
            teacherId: teacherProfile.id,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 18,
    include: {
      student: {
        include: {
          user: true,
        },
      },
      program: true,
    },
  });

  const classes = teacherProfile.classSchedules.map((schedule) => ({
    id: schedule.id,
    programId: schedule.program.id,
    title: schedule.title,
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    timezone: schedule.timezone,
    meetingUrl: schedule.meetingUrl,
    provider: schedule.meetingProvider,
    studentCount: schedule.program.enrollments.length,
    activeEnrollments: schedule.program.enrollments.filter((enrollment) =>
      ["ACTIVE", "CONFIRMED", "COMPLETED"].includes(enrollment.status),
    ).length,
  }));

  const rosterPrograms = teacherProfile.programAssignments.map((assignment) => ({
    programId: assignment.program.id,
    title: assignment.program.title,
    assignmentCount: assignment.program.assignments.length,
    students: assignment.program.enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      name:
        enrollment.student.displayName ||
        `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`.trim(),
      email: enrollment.student.user.email,
      enrollmentStatus: enrollment.status.replace(/_/g, " "),
    })),
  }));

  const quizLibrary = teacherProfile.programAssignments.flatMap((assignment) =>
    assignment.program.quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      type: quiz.type.replace(/_/g, " "),
      questionCount: quiz.questions.length,
      published: quiz.isPublished,
      attempts: quiz.attempts.length,
      pendingManualReview: quiz.attempts.filter(
        (attempt) => attempt.submittedAt && attempt.manualScore === null,
      ).length,
    })),
  );

  const quizReviewQueue = teacherProfile.programAssignments
    .flatMap((assignment) =>
      assignment.program.quizzes.flatMap((quiz) =>
        quiz.attempts
          .filter((attempt) => attempt.submittedAt)
          .map((attempt) => ({
            id: attempt.id,
            studentName:
              attempt.student.displayName ||
              `${attempt.student.user.firstName} ${attempt.student.user.lastName}`.trim(),
            quizTitle: quiz.title,
            submittedAt: attempt.submittedAt,
            score: attempt.manualScore ?? attempt.autoScore ?? null,
            feedback: attempt.feedback,
          })),
      ),
    )
    .sort((left, right) => {
      const leftTime = left.submittedAt?.getTime() ?? 0;
      const rightTime = right.submittedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, 12);

  const lessonLogs = teacherProfile.classSchedules
    .flatMap((schedule) =>
      schedule.lessonLogs.map((log) => ({
        id: log.id,
        title: schedule.title,
        lessonDate: log.lessonDate,
        topic: log.topic,
        summary: log.summary,
        homework: log.homework ?? null,
      })),
    )
    .sort((left, right) => right.lessonDate.getTime() - left.lessonDate.getTime())
    .slice(0, 12);

  const assignments = teacherProfile.programAssignments
    .flatMap((assignment) =>
      assignment.program.assignments.map((task) => ({
        id: task.id,
        programId: assignment.program.id,
        programTitle: assignment.program.title,
        title: task.title,
        instructions: task.instructions ?? null,
        dueDate: task.dueDate,
        submissions: task.submissions.length,
      })),
    )
    .sort((left, right) => {
      if (left.dueDate && right.dueDate) {
        return left.dueDate.getTime() - right.dueDate.getTime();
      }
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 12);

  const uniqueStudents = new Set(
    teacherProfile.programAssignments.flatMap((assignment) =>
      assignment.program.enrollments.map((enrollment) => enrollment.studentId),
    ),
  );

  return {
    teacherName: `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`.trim(),
    profile: {
      bio: teacherProfile.bio,
      specialties: Array.isArray(teacherProfile.specialties)
        ? teacherProfile.specialties.map(String)
        : [],
      timezone: teacherProfile.user.timezone,
      email: teacherProfile.user.email,
      phone:
        teacherProfile.user.phoneCountryCode && teacherProfile.user.phoneNumber
          ? `${teacherProfile.user.phoneCountryCode} ${teacherProfile.user.phoneNumber}`
          : teacherProfile.user.phoneNumber ?? null,
    },
    metrics: {
      assignedClasses: classes.length,
      upcomingLessons: classes.length,
      students: uniqueStudents.size,
      quizzesToReview: quizLibrary.reduce((sum, quiz) => sum + quiz.pendingManualReview, 0),
      journalReviews: journals.filter((entry) => !entry.teacherFeedback).length,
    },
    classes,
    rosters: rosterPrograms,
    quizzes: quizLibrary,
    quizReviewQueue,
    journals: journals.map((entry) => ({
      id: entry.id,
      studentName:
        entry.student.displayName ||
        `${entry.student.user.firstName} ${entry.student.user.lastName}`.trim(),
      title: entry.title,
      practiceMinutes: entry.practiceMinutes,
      selfRating: entry.selfRating,
      submittedAt: entry.submittedAt,
      teacherFeedback: entry.teacherFeedback,
    })),
    lessonLogs,
    assignments,
    reports: reports.map((report) => ({
      id: report.id,
      studentName:
        report.student.displayName ||
        `${report.student.user.firstName} ${report.student.user.lastName}`.trim(),
      programTitle: report.program.title,
      grade: report.grade,
      attendancePct: report.attendancePct,
      reportPeriod: report.reportPeriod,
    })),
  } satisfies TeacherDashboardData;
}
