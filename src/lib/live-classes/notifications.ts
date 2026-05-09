import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
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
      enrollments: {
        where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
        include: {
          program: {
            include: {
              schedules: {
                where: { meetingUrl: { not: null } },
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
      await createReminder(userId, schedule, "/student/schedule", now);
    }
  }
}

export async function ensureParentLiveClassReminders(userId: string) {
  const parent = await db.parentProfile.findUnique({
    where: { userId },
    include: {
      enrollments: {
        where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
        include: {
          program: {
            include: {
              schedules: {
                where: { meetingUrl: { not: null } },
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
      await createReminder(userId, schedule, "/parent/schedule", now);
    }
  }
}

export async function getUnreadNotifications(userId: string, take = 5) {
  return db.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}
