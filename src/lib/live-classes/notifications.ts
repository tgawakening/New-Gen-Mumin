import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  countryMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  isLiveClassVisibleToStudents,
} from "@/lib/live-classes/service";
import { nextWeeklyOccurrence } from "@/lib/live-classes/time";

type ScheduleForReminder = {
  id: string;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingUrl: string | null;
};

type ScheduleWithRosters = ScheduleForReminder & {
  scheduleRosters?: Array<{ studentId: string }>;
  teacher?: {
    programRosters?: Array<{ programId: string; studentId: string }>;
  };
};

function reminderMinutes() {
  return env.success ? env.data.LIVE_CLASS_REMINDER_MINUTES : 15;
}

async function createReminder(userId: string, schedule: ScheduleForReminder, href: string, now: Date) {
  const classStart = nextWeeklyOccurrence(schedule.weekday, schedule.startTime, now);
  const minutesUntilStart = Math.round((classStart.getTime() - now.getTime()) / 60000);
  if (minutesUntilStart < 0 || minutesUntilStart > reminderMinutes()) return;

  const existing = await db.notification.findFirst({
    where: {
      userId,
      title: "Live class starting soon",
      href,
      createdAt: {
        gte: new Date(now.getTime() - 60 * 60 * 1000),
      },
    },
  });
  if (existing) return;

  await db.notification.create({
    data: {
      userId,
      title: "Live class starting soon",
      body: `${schedule.title} starts in ${Math.max(minutesUntilStart, 0)} minutes. Join from your schedule page.`,
      href,
    },
  });
}

export async function ensureTeacherLiveClassReminders(userId: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId },
    include: {
      classSchedules: {
        where: { meetingUrl: { not: null } },
      },
    },
  });
  if (!teacher) return;

  const now = new Date();
  for (const schedule of teacher.classSchedules) {
    await createReminder(userId, schedule, "/teacher/schedule", now);
  }
}

export async function ensureStudentLiveClassReminders(userId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId },
    include: {
      registrationStudents: {
        select: {
          countryCode: true,
          countryName: true,
        },
      },
      enrollments: {
        where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
        include: {
          program: {
            include: {
              schedules: {
                where: { meetingUrl: { not: null } },
                include: {
                  scheduleRosters: {
                    select: { studentId: true },
                  },
                  teacher: {
                    include: {
                      programRosters: {
                        select: {
                          programId: true,
                          studentId: true,
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
  });
  if (!student) return;

  const now = new Date();
  for (const enrollment of student.enrollments) {
    for (const schedule of enrollment.program.schedules) {
      if (!scheduleVisibleToStudent(schedule, student.id, enrollment.program.id, [
        student.countryCode,
        student.countryName,
        ...student.registrationStudents.flatMap((entry) => [entry.countryCode, entry.countryName]),
      ])) {
        continue;
      }
      await createReminder(userId, schedule, "/student/schedule", now);
    }
  }
}

export async function ensureParentLiveClassReminders(userId: string) {
  const parent = await db.parentProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          phoneCountryCode: true,
        },
      },
      enrollments: {
        where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
        include: {
          student: {
            include: {
              registrationStudents: {
                select: {
                  countryCode: true,
                  countryName: true,
                },
              },
            },
          },
          program: {
            include: {
              schedules: {
                where: { meetingUrl: { not: null } },
                include: {
                  scheduleRosters: {
                    select: { studentId: true },
                  },
                  teacher: {
                    include: {
                      programRosters: {
                        select: {
                          programId: true,
                          studentId: true,
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
  });
  if (!parent) return;

  const now = new Date();
  for (const enrollment of parent.enrollments) {
    for (const schedule of enrollment.program.schedules) {
      if (!scheduleVisibleToStudent(schedule, enrollment.studentId, enrollment.program.id, [
        enrollment.student.countryCode,
        enrollment.student.countryName,
        ...enrollment.student.registrationStudents.flatMap((entry) => [entry.countryCode, entry.countryName]),
        parent.billingCountryCode,
        parent.billingCountryName,
        parent.user.phoneCountryCode,
      ])) {
        continue;
      }
      await createReminder(userId, schedule, "/parent/schedule", now);
    }
  }
}

function scheduleVisibleToStudent(
  schedule: ScheduleWithRosters,
  studentId: string,
  programId: string,
  countryCodes: Array<string | null | undefined>,
) {
  if (!isLiveClassVisibleToStudents(schedule.title)) return false;

  const scheduleRosterIds = schedule.scheduleRosters?.map((entry) => entry.studentId) ?? [];
  const teacherRosterIds =
    schedule.teacher?.programRosters
      ?.filter((entry) => entry.programId === programId)
      .map((entry) => entry.studentId) ?? [];
  const visibleRosterIds = scheduleRosterIds.length ? scheduleRosterIds : teacherRosterIds;
  if (visibleRosterIds.length && !visibleRosterIds.includes(studentId)) return false;

  return countryMatchesLiveClassAudience(countryCodes, getLiveClassAudienceGroup(schedule.title));
}

export async function getUnreadNotifications(userId: string, take = 5) {
  return db.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}
