import "server-only";

import { db } from "@/lib/db";
import { createRecurringZoomMeeting, isZoomConfigured } from "@/lib/zoom/client";
import { durationMinutes, nextWeeklyOccurrence, toZoomLocalStartTime } from "@/lib/live-classes/time";

export type CreateLiveClassInput = {
  programId: string;
  teacherId: string;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createZoomMeeting: boolean;
};

export async function createLiveClass(input: CreateLiveClassInput, createdByUserId?: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { id: input.teacherId },
    include: { user: true },
  });
  if (!teacher) throw new Error("Teacher not found.");

  const program = await db.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program not found.");

  const meeting = input.createZoomMeeting
    ? await createRecurringZoomMeeting({
        topic: input.title,
        agenda: `${program.title} live class with ${teacher.user.firstName} ${teacher.user.lastName}`.trim(),
        timezone: input.timezone,
        startTime: toZoomLocalStartTime(nextWeeklyOccurrence(input.weekday, input.startTime)),
        durationMinutes: durationMinutes(input.startTime, input.endTime),
        weekday: input.weekday,
      })
    : null;

  const schedule = await db.classSchedule.create({
    data: {
      programId: input.programId,
      teacherId: input.teacherId,
      createdByUserId,
      title: input.title,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      meetingProvider: meeting ? "Zoom" : null,
      meetingUrl: meeting?.join_url ?? null,
      meetingId: meeting?.id ? String(meeting.id) : null,
      recurringSeriesId: meeting?.id ? String(meeting.id) : null,
      startsOn: nextWeeklyOccurrence(input.weekday, input.startTime),
    },
  });

  await db.teacherProgram.upsert({
    where: {
      teacherId_programId: {
        teacherId: input.teacherId,
        programId: input.programId,
      },
    },
    create: {
      teacherId: input.teacherId,
      programId: input.programId,
    },
    update: {},
  });

  await notifyEnrolledUsers(schedule.id);
  return schedule;
}

export async function syncScheduleToZoom(scheduleId: string) {
  if (!isZoomConfigured()) {
    throw new Error("Zoom is not configured.");
  }

  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: true,
      teacher: { include: { user: true } },
    },
  });
  if (!schedule) throw new Error("Class schedule not found.");

  const meeting = await createRecurringZoomMeeting({
    topic: schedule.title,
    agenda: `${schedule.program.title} live class with ${schedule.teacher.user.firstName} ${schedule.teacher.user.lastName}`.trim(),
    timezone: schedule.timezone,
    startTime: toZoomLocalStartTime(nextWeeklyOccurrence(schedule.weekday, schedule.startTime)),
    durationMinutes: durationMinutes(schedule.startTime, schedule.endTime),
    weekday: schedule.weekday,
  });

  const updated = await db.classSchedule.update({
    where: { id: schedule.id },
    data: {
      meetingProvider: "Zoom",
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
      recurringSeriesId: String(meeting.id),
      startsOn: schedule.startsOn ?? nextWeeklyOccurrence(schedule.weekday, schedule.startTime),
    },
  });

  await notifyEnrolledUsers(updated.id);
  return updated;
}

export async function notifyEnrolledUsers(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              parent: { include: { user: true } },
              student: { include: { user: true } },
            },
          },
        },
      },
      teacher: { include: { user: true } },
    },
  });
  if (!schedule) return;

  const users = new Map<string, { id: string; role: string }>();
  users.set(schedule.teacher.user.id, { id: schedule.teacher.user.id, role: "teacher" });

  for (const enrollment of schedule.program.enrollments) {
    users.set(enrollment.student.user.id, { id: enrollment.student.user.id, role: "student" });
    if (enrollment.parent?.user.id) {
      users.set(enrollment.parent.user.id, { id: enrollment.parent.user.id, role: "parent" });
    }
  }

  for (const user of users.values()) {
    await db.notification.create({
      data: {
        userId: user.id,
        title: "Live class scheduled",
        body: `${schedule.title} is now scheduled on Zoom. ${schedule.startTime}-${schedule.endTime} ${schedule.timezone}.`,
        href:
          user.role === "teacher"
            ? "/teacher/schedule"
            : user.role === "parent"
              ? "/parent/schedule"
              : "/student/schedule",
      },
    });
  }
}
