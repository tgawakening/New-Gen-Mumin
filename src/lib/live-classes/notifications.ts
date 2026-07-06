import "server-only";

import { db } from "@/lib/db";
import { sendLiveClassStartedEmail } from "@/lib/email/notifications";
import { env } from "@/lib/env";
import {
  cleanLiveClassTitle,
  countryMatchesLiveClassAudience,
  enrollmentMatchesLiveClassAudience,
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

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function notificationPersonName(user: { firstName: string; lastName: string | null; email: string }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.firstName || user.email;
}

function canSendLiveClassEmail(email: string | null | undefined) {
  return Boolean(email && !email.endsWith("@genmumin.local"));
}

function teacherName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return notificationPersonName(teacher.user);
}

export async function notifyRosteredUsersClassStarted(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      scheduleRosters: { select: { studentId: true } },
      teacher: {
        include: {
          user: true,
          programRosters: { select: { programId: true, studentId: true } },
        },
      },
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              parent: { include: { user: true } },
              student: {
                include: {
                  user: true,
                  registrationStudents: { select: { countryCode: true, countryName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!schedule?.meetingUrl || !isLiveClassVisibleToStudents(schedule.title)) return;

  const now = new Date();
  const title = cleanLiveClassTitle(schedule.title);
  const audienceGroup = getLiveClassAudienceGroup(schedule.title);
  const scheduleRosterIds = schedule.scheduleRosters.map((entry) => entry.studentId);
  const defaultRosterIds = schedule.teacher.programRosters
    .filter((entry) => entry.programId === schedule.programId)
    .map((entry) => entry.studentId);
  const visibleRosterIds = new Set(scheduleRosterIds.length ? scheduleRosterIds : defaultRosterIds);
  const hasRosterFilter = visibleRosterIds.size > 0;
  const scheduleLabel = `${WEEKDAY_LABELS[schedule.weekday] ?? "Weekly class"} ${schedule.startTime}-${schedule.endTime} ${schedule.timezone}`;
  const emailRecipients = new Map<string, { toEmail: string; recipientName: string }>();
  const notificationRecipients = new Map<string, { href: string }>();

  for (const enrollment of schedule.program.enrollments) {
    if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) continue;
    if (hasRosterFilter && !visibleRosterIds.has(enrollment.studentId)) continue;

    notificationRecipients.set(enrollment.student.user.id, { href: "/student/schedule" });
    if (canSendLiveClassEmail(enrollment.student.user.email)) {
      emailRecipients.set(enrollment.student.user.email.toLowerCase(), {
        toEmail: enrollment.student.user.email,
        recipientName: notificationPersonName(enrollment.student.user),
      });
    }

    if (enrollment.parent?.user.id) {
      notificationRecipients.set(enrollment.parent.user.id, { href: `/parent/schedule?child=${enrollment.studentId}` });
      if (canSendLiveClassEmail(enrollment.parent.user.email)) {
        emailRecipients.set(enrollment.parent.user.email.toLowerCase(), {
          toEmail: enrollment.parent.user.email,
          recipientName: notificationPersonName(enrollment.parent.user),
        });
      }
    }
  }

  for (const [userId, recipient] of notificationRecipients.entries()) {
    const existing = await db.notification.findFirst({
      where: {
        userId,
        title: "Live class is now open",
        href: recipient.href,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    await db.notification.create({
      data: {
        userId,
        title: "Live class is now open",
        body: `${title} has started on Zoom. Click to join as a participant.`,
        href: recipient.href,
      },
    });
  }

  const recentEmailLogs = await db.emailLog.findMany({
    where: {
      template: "liveClassStarted",
      toEmail: { in: [...emailRecipients.values()].map((recipient) => recipient.toEmail) },
      createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
    select: { toEmail: true },
  });
  const recentlyEmailed = new Set(recentEmailLogs.map((log) => log.toEmail.toLowerCase()));
  const emailResults = await Promise.allSettled(
    [...emailRecipients.values()]
      .filter((recipient) => !recentlyEmailed.has(recipient.toEmail.toLowerCase()))
      .map((recipient) =>
        sendLiveClassStartedEmail({
          ...recipient,
          programTitle: schedule.program.title,
          sessionTitle: title,
          teacherName: teacherName(schedule.teacher),
          schedule: scheduleLabel,
          joinUrl: schedule.meetingUrl!,
        }),
      ),
  );

  for (const result of emailResults) {
    if (result.status === "rejected") {
      console.error("Unable to send live class started email", result.reason);
    }
  }
}
