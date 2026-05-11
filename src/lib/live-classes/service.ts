import "server-only";

import { db } from "@/lib/db";
import {
  sendAdminZoomMeetingRequestEmail,
  sendTeacherZoomMeetingApprovedEmail,
} from "@/lib/email/notifications";
import { durationMinutes, nextWeeklyOccurrence, toZoomLocalStartTime } from "@/lib/live-classes/time";
import { createRecurringZoomMeeting, isZoomConfigured } from "@/lib/zoom/client";

export const WHOLE_GEN_MUMIN_PROGRAM_ID = "__whole_gen_mumin__";
export const PENDING_ZOOM_PROVIDER = "Zoom Pending Approval";

export type CreateLiveClassInput = {
  programId: string;
  teacherId?: string;
  teacherIds?: string[];
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createZoomMeeting: boolean;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  muteUponEntry?: boolean;
  autoRecording?: "none" | "local" | "cloud";
  passcode?: string;
};

function teacherDisplayName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

export async function createLiveClass(input: CreateLiveClassInput, createdByUserId?: string) {
  const teacherIds = input.teacherIds?.length ? input.teacherIds : input.teacherId ? [input.teacherId] : [];
  if (!teacherIds.length) throw new Error("Choose at least one teacher.");

  const teachers = await db.teacherProfile.findMany({
    where: { id: { in: teacherIds } },
    include: { user: true },
  });
  if (!teachers.length) throw new Error("Teacher not found.");

  const programs =
    input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID
      ? await db.program.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { sortOrder: "asc" } })
      : await db.program.findMany({ where: { id: input.programId } });
  if (!programs.length) throw new Error("Program not found.");

  const meeting = input.createZoomMeeting
    ? await createRecurringZoomMeeting({
        topic: input.title,
        agenda:
          input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID
            ? "Whole Gen-Mumin live session"
            : `${programs[0].title} live class`,
        timezone: input.timezone,
        startTime: toZoomLocalStartTime(nextWeeklyOccurrence(input.weekday, input.startTime)),
        durationMinutes: durationMinutes(input.startTime, input.endTime),
        weekday: input.weekday,
        waitingRoom: input.waitingRoom,
        joinBeforeHost: input.joinBeforeHost,
        muteUponEntry: input.muteUponEntry,
        autoRecording: input.autoRecording,
        passcode: input.passcode,
      })
    : null;

  const createdSchedules = [];

  for (const program of programs) {
    for (const teacher of teachers) {
      const schedule = await db.classSchedule.create({
        data: {
          programId: program.id,
          teacherId: teacher.id,
          createdByUserId,
          title: input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID ? `Whole Gen-Mumin: ${input.title}` : input.title,
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
            teacherId: teacher.id,
            programId: program.id,
          },
        },
        create: {
          teacherId: teacher.id,
          programId: program.id,
        },
        update: {},
      });

      createdSchedules.push(schedule);
    }
  }

  for (const schedule of createdSchedules) {
    await notifyEnrolledUsers(schedule.id);
  }

  return createdSchedules[0];
}

export async function requestTeacherLiveClass(input: CreateLiveClassInput, teacherUserId: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: { user: true, programAssignments: true },
  });
  if (!teacher) throw new Error("Teacher not found.");
  if (!teacher.programAssignments.some((assignment) => assignment.programId === input.programId)) {
    throw new Error("You can only request sessions for assigned programs.");
  }

  const program = await db.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program not found.");

  const meeting = input.createZoomMeeting
    ? await createRecurringZoomMeeting({
        topic: input.title,
        agenda: `${program.title} teacher-created live session`,
        timezone: input.timezone,
        startTime: toZoomLocalStartTime(nextWeeklyOccurrence(input.weekday, input.startTime)),
        durationMinutes: durationMinutes(input.startTime, input.endTime),
        weekday: input.weekday,
        waitingRoom: input.waitingRoom,
        joinBeforeHost: input.joinBeforeHost,
        muteUponEntry: input.muteUponEntry,
        autoRecording: input.autoRecording,
        passcode: input.passcode,
      })
    : null;

  const schedule = await db.classSchedule.create({
    data: {
      programId: input.programId,
      teacherId: teacher.id,
      createdByUserId: teacherUserId,
      title: input.title,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      meetingProvider: meeting ? "Zoom" : PENDING_ZOOM_PROVIDER,
      meetingUrl: meeting?.join_url ?? null,
      meetingId: meeting?.id ? String(meeting.id) : null,
      recurringSeriesId: meeting?.id ? String(meeting.id) : null,
      startsOn: nextWeeklyOccurrence(input.weekday, input.startTime),
    },
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: meeting ? "Teacher scheduled a Zoom class" : "Zoom meeting approval needed",
        body: meeting
          ? `${teacherDisplayName(teacher)} scheduled ${input.title} for ${program.title}.`
          : `${teacherDisplayName(teacher)} requested ${input.title} for ${program.title}.`,
        href: "/admin/classes",
      })),
    });
  }

  await sendAdminZoomMeetingRequestEmail({
    teacherName: teacherDisplayName(teacher),
    teacherEmail: teacher.user.email,
    programTitle: program.title,
    sessionTitle: input.title,
    schedule: `${input.startTime}-${input.endTime} ${input.timezone}`,
  });

  if (meeting) await notifyEnrolledUsers(schedule.id);

  return schedule;
}

export async function approveTeacherLiveClass(scheduleId: string, approvedByUserId: string) {
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
    agenda: `${schedule.program.title} approved live session`,
    timezone: schedule.timezone,
    startTime: toZoomLocalStartTime(nextWeeklyOccurrence(schedule.weekday, schedule.startTime)),
    durationMinutes: durationMinutes(schedule.startTime, schedule.endTime),
    weekday: schedule.weekday,
  });

  const updated = await db.classSchedule.update({
    where: { id: schedule.id },
    data: {
      createdByUserId: schedule.createdByUserId ?? approvedByUserId,
      meetingProvider: "Zoom",
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
      recurringSeriesId: String(meeting.id),
    },
  });

  await db.notification.create({
    data: {
      userId: schedule.teacher.user.id,
      title: "Zoom meeting approved",
      body: `${schedule.title} has been approved and linked to Zoom.`,
      href: "/teacher/schedule",
    },
  });

  await sendTeacherZoomMeetingApprovedEmail({
    toEmail: schedule.teacher.user.email,
    teacherName: schedule.teacher.user.firstName,
    sessionTitle: schedule.title,
    programTitle: schedule.program.title,
  });

  await notifyEnrolledUsers(updated.id);
  return updated;
}

export async function rejectTeacherLiveClass(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { teacher: { include: { user: true } } },
  });
  if (!schedule) throw new Error("Class schedule not found.");

  await db.classSchedule.delete({ where: { id: scheduleId } });
  await db.notification.create({
    data: {
      userId: schedule.teacher.user.id,
      title: "Zoom meeting request declined",
      body: `${schedule.title} was not approved by admin.`,
      href: "/teacher/schedule",
    },
  });
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
  if (!schedule || !schedule.meetingUrl) return;

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
