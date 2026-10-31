import { loadModuleSharing } from "@/lib/curriculum/handover";
import { hasScheduleEnded } from "@/lib/live-classes/schedule-lifecycle";
import { parseTaskPayload } from "@/lib/genm/published-content";
import { homeworkReviewRows } from "@/lib/homework/review-roster";
import "server-only";
import { canSeeTeacherProgramme, isSeerahParentalTeacher, scopeTeacherAssignments } from "@/lib/teacher/programme-scope";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  cleanLiveClassTitle,
  enrollmentMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  getLiveClassAudienceLabel,
  createReadOnlyRosterResolver,
  getTeacherProgramRosterEntries,
  getTeacherRosterAssignments,
} from "@/lib/live-classes/service";
import { getStudentRoomAssignment, type StudentRoomAssignment } from "@/lib/live-classes/rooms";
import { displayProgramTitle } from "@/lib/genm/curriculum";
const PROGRAMME_LEAD_EMAIL = "globalawakeningchannel@gmail.com";

export type TeacherDashboardData = {
  teacherName: string;
  moduleSharing: Record<string, boolean>;
  profile: {
    bio: string | null;
    specialties: string[];
    curriculumOverrides: Record<string, { title: string; description: string; weekLabel?: string | null }>;
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
    startsOn: Date | null;
    startTime: string;
    endTime: string;
    timezone: string;
    meetingUrl: string | null;
    provider: string | null;
    audience: string;
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
      roomAssignment: StudentRoomAssignment | null;
    }>;
  }>;
  quizzes: Array<{
    id: string;
    programId: string;
    title: string;
    description: string | null;
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
    scheduleId: string;
    programId: string;
    title: string;
    lessonDate: Date;
    topic: string;
    summary: string;
    homework: string | null;
  }>;
  recordings: Array<{
    id: string;
    programId: string;
    title: string;
    recordingStart: Date | null;
    availableAt: Date;
    durationMinutes: number | null;
  }>;
  assignments: Array<{
    id: string;
    programId: string;
    programTitle: string;
    title: string;
    instructions: string | null;
    launchAt: string | null;
    dueDate: Date | null;
    submissions: number;
    submissionDetails: Array<{
      id: string;
      canReview: boolean;
      submissionTiming: string;
      submissionText: string | null;
      studentName: string;
      status: string;
      score: number | null;
      homeworkPoints: number | null;
      grade: string | null;
      submittedAt: Date | null;
      feedback: string | null;
      attachmentUrl: string | null;
    }>;
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

export const getTeacherDashboardData = cache(async function getTeacherDashboardData(userId: string) {
  const resolveRoster = createReadOnlyRosterResolver();
  const [teacherProfile] = await Promise.all([db.teacherProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      classSchedules: {
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        include: {
          program: {
            include: {
              enrollments: {
                where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
                include: {
                  parent: {
                    include: {
                      user: true,
                    },
                  },
                  student: {
                    include: {
                      user: true,
                      registrationStudents: {
                        select: {
                          countryCode: true,
                          countryName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          lessonLogs: {
            orderBy: { lessonDate: "desc" },
            take: 12,
          },
          recordings: {
            where: { deletedAt: null, driveFileId: { not: null }, storageProvider: "google-drive" },
            orderBy: { availableAt: "desc" },
            take: 40,
          },
        },
      },
      programAssignments: {
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
                    take: 18,
                  },
                  recordings: {
                    where: { deletedAt: null, driveFileId: { not: null }, storageProvider: "google-drive" },
                    orderBy: { availableAt: "desc" },
                    take: 40,
                  },
                },
              },
              enrollments: {
                where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
                include: {
                  parent: {
                    include: {
                      user: true,
                    },
                  },
                  student: {
                    include: {
                      user: true,
                      registrationStudents: {
                        select: {
                          countryCode: true,
                          countryName: true,
                        },
                      },
                    },
                  },
                },
              },
              quizzes: {
                include: {
                  _count: { select: { questions: true } },
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
                  submissions: {
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
            },
          },
        },
      },
    },
  }), resolveRoster.warm()]);

  if (!teacherProfile) {
    return null;
  }
  const isProgrammeLead = teacherProfile.user.email.toLowerCase() === PROGRAMME_LEAD_EMAIL;
  teacherProfile.programAssignments = scopeTeacherAssignments(teacherProfile.user, teacherProfile.programAssignments);
  teacherProfile.classSchedules = teacherProfile.classSchedules.filter(schedule => canSeeTeacherProgramme(teacherProfile.user, schedule.program));
  const visibleProgramIds = teacherProfile.programAssignments.map(assignment => assignment.programId);

  const journals = await db.journalEntry.findMany({
    where: {
      enrollment: {
        program: {
          id: { in: visibleProgramIds },
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
        id: { in: visibleProgramIds },
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

  const programmeSchedules = isProgrammeLead
    ? teacherProfile.programAssignments.flatMap((assignment) =>
        assignment.program.schedules.map((schedule) => ({
          ...schedule,
          program: assignment.program,
        })),
      )
    : teacherProfile.classSchedules;
  const uniqueSchedules = Array.from(new Map(programmeSchedules.map((schedule) => [schedule.id, schedule])).values());
  await resolveRoster.preload(uniqueSchedules.map(schedule => schedule.id));
  const scheduleRosterIdsBySchedule = new Map(
    await Promise.all(
      uniqueSchedules.map(async (schedule) => [schedule.id, new Set(await resolveRoster(schedule.id))] as const),
    ),
  );

  const classes = uniqueSchedules.filter(schedule => !hasScheduleEnded(schedule)).map((schedule) => {
    const audienceGroup = getLiveClassAudienceGroup(schedule.title);
    const rosterStudentIds = scheduleRosterIdsBySchedule.get(schedule.id) ?? new Set<string>();
    const visibleEnrollments = schedule.program.enrollments.filter((enrollment) => {
      if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) return false;
      return !rosterStudentIds.size || rosterStudentIds.has(enrollment.studentId);
    });
    const learnerCount = new Set(visibleEnrollments.map((enrollment) => enrollment.student.user.email.toLowerCase())).size;

    return {
      id: schedule.id,
      programId: schedule.program.id,
      title: cleanLiveClassTitle(schedule.title),
      weekday: schedule.weekday,
      startsOn: schedule.startsOn,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      timezone: schedule.timezone,
      meetingUrl: schedule.meetingUrl,
      provider: schedule.meetingProvider,
      audience: getLiveClassAudienceLabel(schedule.title),
      studentCount: learnerCount,
      activeEnrollments: learnerCount,
    };
  });

  const programRosterEntries = await getTeacherProgramRosterEntries(teacherProfile.id, resolveRoster.read);
  const rosterStudentIdsByProgram = new Map<string, Set<string>>();
  for (const rosterEntry of programRosterEntries) {
    const studentSet = rosterStudentIdsByProgram.get(rosterEntry.programId) ?? new Set<string>();
    studentSet.add(rosterEntry.studentId);
    rosterStudentIdsByProgram.set(rosterEntry.programId, studentSet);
  }

  const rosterAssignments = getTeacherRosterAssignments(teacherProfile);

  const eligibleStudentsByProgram = new Map(
    await Promise.all(
      rosterAssignments.map(async (assignment) => [
        assignment.program.id,
        await resolveRoster.read.eligible(assignment.program.id),
      ] as const),
    ),
  );

  const rosterPrograms = rosterAssignments.map((assignment) => {
    const rosterStudentIds = rosterStudentIdsByProgram.get(assignment.program.id);
    const eligibleStudents = eligibleStudentsByProgram.get(assignment.program.id) ?? [];
    const students = rosterStudentIds && rosterStudentIds.size
      ? eligibleStudents.filter((student) => rosterStudentIds.has(student.id))
      : eligibleStudents;

    return {
      programId: assignment.program.id,
      title: displayProgramTitle(assignment.program.slug || assignment.program.title),
      assignmentCount: assignment.program.assignments.length,
      students: Array.from(
        new Map(
          students
            .map((student) => [
              student.user.email.toLowerCase(),
              {
                id: student.id,
                name:
                  student.displayName ||
                  `${student.user.firstName} ${student.user.lastName}`.trim(),
                email: student.user.email,
                enrollmentStatus: "ACTIVE",
                roomAssignment: getStudentRoomAssignment(student.learningNotes, assignment.program.id),
              },
            ]),
        ).values(),
      ),
    };
  });

  const quizLibrary = teacherProfile.programAssignments.flatMap((assignment) =>
    assignment.program.quizzes.map((quiz) => ({
      id: quiz.id,
      programId: assignment.program.id,
      title: quiz.title,
      description: quiz.description,
      type: quiz.type.replace(/_/g, " "),
      questionCount: quiz._count.questions,
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

  const lessonLogs = uniqueSchedules
    .flatMap((schedule) =>
      schedule.lessonLogs.map((log) => ({
        id: log.id,
        scheduleId: schedule.id,
        programId: schedule.program.id,
        title: schedule.title,
        lessonDate: log.lessonDate,
        topic: log.topic,
        summary: log.summary,
        homework: log.homework ?? null,
      })),
    )
    .sort((left, right) => right.lessonDate.getTime() - left.lessonDate.getTime())
    .slice(0, 12);

  const recordings = uniqueSchedules
    .flatMap((schedule) =>
      (schedule.recordings ?? []).map((recording) => ({
        id: recording.id,
        programId: schedule.program.id,
        title: cleanLiveClassTitle(recording.topic || schedule.title),
        recordingStart: recording.recordingStart,
        availableAt: recording.availableAt,
        durationMinutes:
          recording.recordingStart && recording.recordingEnd
            ? Math.max(0, Math.round((recording.recordingEnd.getTime() - recording.recordingStart.getTime()) / 60000))
            : null,
      })),
    )
    .sort((left, right) => (right.recordingStart ?? right.availableAt).getTime() - (left.recordingStart ?? left.availableAt).getTime())
    .slice(0, 80);
  const homeworkSubmissionIds = teacherProfile.programAssignments.flatMap(({ program }) => program.assignments.flatMap((task) => task.submissions.map(({ id }) => id)));
  const homeworkAwards = homeworkSubmissionIds.length ? await db.housePointLedger.findMany({
    where: { sourceType: "HOMEWORK_PERFORMANCE", sourceId: { in: homeworkSubmissionIds } },
    select: { sourceId: true, points: true },
  }) : [];
  const homeworkPointsBySubmission = new Map(homeworkAwards.flatMap((award) => award.sourceId ? [[award.sourceId, award.points] as const] : []));
  const assignments = teacherProfile.programAssignments
    .flatMap((assignment) =>
      assignment.program.assignments.map((task) => ({
        id: task.id,
        programId: assignment.program.id,
        programTitle: displayProgramTitle(assignment.program.slug || assignment.program.title),
        title: task.title,
        instructions: task.instructions ?? null,
        launchAt: parseTaskPayload(task.instructions).launchAt,
        dueDate: task.dueDate,
        submissions: task.submissions.filter((submission) => submission.submittedAt && rosterPrograms.find((roster) => roster.programId === assignment.program.id)?.students.some((student) => student.id === submission.studentId)).length,
        submissionDetails: homeworkReviewRows(task.id, rosterPrograms.find((roster) => roster.programId === assignment.program.id)?.students ?? [], task.submissions, homeworkPointsBySubmission, task.dueDate),
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
    rosterPrograms.flatMap((roster) => roster.students.map((student) => student.email.toLowerCase())),
  );

  const specialtyList = Array.isArray(teacherProfile.specialties)
    ? teacherProfile.specialties.map(String)
    : teacherProfile.specialties &&
        typeof teacherProfile.specialties === "object" &&
        !Array.isArray(teacherProfile.specialties) &&
        "list" in teacherProfile.specialties &&
        Array.isArray(teacherProfile.specialties.list)
      ? teacherProfile.specialties.list.map(String)
      : [];
  const curriculumOverrides =
    teacherProfile.specialties &&
    typeof teacherProfile.specialties === "object" &&
    !Array.isArray(teacherProfile.specialties) &&
    "curriculumOverrides" in teacherProfile.specialties &&
    teacherProfile.specialties.curriculumOverrides &&
    typeof teacherProfile.specialties.curriculumOverrides === "object" &&
    !Array.isArray(teacherProfile.specialties.curriculumOverrides)
      ? (teacherProfile.specialties.curriculumOverrides as Record<string, { title: string; description: string; weekLabel?: string | null }>)
      : {};

  return {
    moduleSharing: await loadModuleSharing(visibleProgramIds),
    teacherName: `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`.trim(),
    profile: {
      bio: isSeerahParentalTeacher(teacherProfile.user) ? "Teaches Seerah and parental sessions." : teacherProfile.bio,
      specialties: isSeerahParentalTeacher(teacherProfile.user) ? specialtyList.filter(value => !/arabic|tajweed/i.test(value)) : specialtyList,
      curriculumOverrides: isSeerahParentalTeacher(teacherProfile.user) ? Object.fromEntries(Object.entries(curriculumOverrides).filter(([slug]) => canSeeTeacherProgramme(teacherProfile.user, { slug }))) : curriculumOverrides,
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
    recordings,
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
});
