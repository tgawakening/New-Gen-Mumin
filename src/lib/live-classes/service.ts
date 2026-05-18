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
export const LIVE_CLASS_AUDIENCE_GROUPS = ["ALL", "PK_UK", "US_CA", "AU"] as const;
export type LiveClassAudienceGroup = (typeof LIVE_CLASS_AUDIENCE_GROUPS)[number];

export type CreateLiveClassInput = {
  programId: string;
  teacherId?: string;
  teacherIds?: string[];
  title: string;
  startDate?: string;
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
  audienceGroup?: LiveClassAudienceGroup;
  showToStudents?: boolean;
};

const AUDIENCE_LABELS: Record<LiveClassAudienceGroup, string> = {
  ALL: "All students",
  PK_UK: "Pakistan and UK students",
  US_CA: "USA and Canada students",
  AU: "Australia students",
};
const HIDDEN_FROM_STUDENTS_MARKER = "[Students:hidden]";
const VISIBLE_TO_STUDENTS_MARKER = "[Students:visible]";

function normalizeAudienceGroup(value: unknown): LiveClassAudienceGroup {
  return LIVE_CLASS_AUDIENCE_GROUPS.includes(value as LiveClassAudienceGroup)
    ? (value as LiveClassAudienceGroup)
    : "ALL";
}

function audienceTitleMarker(group: LiveClassAudienceGroup) {
  return group === "ALL" ? "" : ` [Audience:${group}]`;
}

export function cleanLiveClassTitle(title: string) {
  return title
    .replace(/\s*\[Students:hidden\]\s*/gu, " ")
    .replace(/\s*\[Students:visible\]\s*/gu, " ")
    .replace(/\s*\[Audience:(PK_UK|US_CA|AU)\]\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function getLiveClassAudienceGroup(title: string): LiveClassAudienceGroup {
  const match = title.match(/\[Audience:(PK_UK|US_CA|AU)\]/u);
  return match ? (match[1] as LiveClassAudienceGroup) : "ALL";
}

export function isLiveClassVisibleToStudents(title: string) {
  return title.includes(VISIBLE_TO_STUDENTS_MARKER) && !title.includes(HIDDEN_FROM_STUDENTS_MARKER);
}

export function getLiveClassAudienceLabel(titleOrGroup: string) {
  const group = normalizeAudienceGroup(titleOrGroup) === "ALL" && !LIVE_CLASS_AUDIENCE_GROUPS.includes(titleOrGroup as LiveClassAudienceGroup)
    ? getLiveClassAudienceGroup(titleOrGroup)
    : normalizeAudienceGroup(titleOrGroup);
  return AUDIENCE_LABELS[group];
}

function withAudienceMarker(title: string, group: LiveClassAudienceGroup) {
  return `${cleanLiveClassTitle(title)}${audienceTitleMarker(group)}`;
}

function withClassMarkers(title: string, group: LiveClassAudienceGroup, showToStudents = true) {
  return `${withAudienceMarker(title, group)} ${showToStudents ? VISIBLE_TO_STUDENTS_MARKER : HIDDEN_FROM_STUDENTS_MARKER}`;
}

function getScheduleStartDate(input: Pick<CreateLiveClassInput, "weekday" | "startTime" | "startDate">) {
  if (input.startDate) {
    const parsed = new Date(`${input.startDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return nextWeeklyOccurrence(input.weekday, input.startTime, parsed);
    }
  }

  return nextWeeklyOccurrence(input.weekday, input.startTime);
}

function countryMatchesAudience(countryCode: string | null | undefined, group: LiveClassAudienceGroup) {
  const code = (countryCode ?? "").trim().toUpperCase();
  if (group === "ALL") return true;
  if (group === "PK_UK") return ["PK", "PAK", "GB", "UK", "GBR"].includes(code);
  if (group === "US_CA") return ["US", "USA", "CA", "CAN"].includes(code);
  if (group === "AU") return ["AU", "AUS"].includes(code);
  return true;
}

function teacherDisplayName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function isAlternativeHostLicenseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("alternative host") && (message.includes("not licensed") || message.includes("code 1115"));
}

async function createZoomMeetingAllowingBasicUsers(payload: Parameters<typeof createRecurringZoomMeeting>[0]) {
  try {
    return await createRecurringZoomMeeting(payload);
  } catch (error) {
    if (!payload.alternativeHosts?.length || !isAlternativeHostLicenseError(error)) {
      throw error;
    }

    const { alternativeHosts: _alternativeHosts, ...meetingWithoutAlternativeHosts } = payload;
    return createRecurringZoomMeeting(meetingWithoutAlternativeHosts);
  }
}

async function createZoomMeetingForTeacher(input: CreateLiveClassInput, programTitle: string, teacherEmail: string) {
  if (!input.createZoomMeeting) return null;

  return createZoomMeetingAllowingBasicUsers({
    topic: cleanLiveClassTitle(input.title),
    agenda: `${programTitle} teacher-created live session`,
    timezone: input.timezone,
    startTime: toZoomLocalStartTime(getScheduleStartDate(input)),
    durationMinutes: durationMinutes(input.startTime, input.endTime),
    weekday: input.weekday,
    waitingRoom: input.waitingRoom,
    joinBeforeHost: input.joinBeforeHost,
    muteUponEntry: input.muteUponEntry,
    autoRecording: input.autoRecording,
    passcode: input.passcode,
    alternativeHosts: [teacherEmail],
  });
}

export async function createLiveClass(input: CreateLiveClassInput, createdByUserId?: string) {
  const audienceGroup = normalizeAudienceGroup(input.audienceGroup);
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
    ? await createZoomMeetingAllowingBasicUsers({
        topic: cleanLiveClassTitle(input.title),
        agenda:
          input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID
            ? "Whole Gen-Mumin live session"
            : `${programs[0].title} live class`,
        timezone: input.timezone,
        startTime: toZoomLocalStartTime(getScheduleStartDate(input)),
        durationMinutes: durationMinutes(input.startTime, input.endTime),
        weekday: input.weekday,
        waitingRoom: input.waitingRoom,
        joinBeforeHost: input.joinBeforeHost,
        muteUponEntry: input.muteUponEntry,
        autoRecording: input.autoRecording,
        passcode: input.passcode,
        alternativeHosts: teachers.map((teacher) => teacher.user.email),
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
          title: withClassMarkers(
            input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID ? `Whole Gen-Mumin: ${input.title}` : input.title,
            audienceGroup,
            input.showToStudents,
          ),
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          meetingProvider: meeting ? "Zoom" : null,
          meetingUrl: meeting?.join_url ?? null,
          meetingId: meeting?.id ? String(meeting.id) : null,
          recurringSeriesId: meeting?.id ? String(meeting.id) : null,
          startsOn: getScheduleStartDate(input),
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
  const audienceGroup = normalizeAudienceGroup(input.audienceGroup);
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

  const meeting = await createZoomMeetingForTeacher(input, program.title, teacher.user.email);

  const schedule = await db.classSchedule.create({
    data: {
      programId: input.programId,
      teacherId: teacher.id,
      createdByUserId: teacherUserId,
      title: withClassMarkers(input.title, audienceGroup, input.showToStudents),
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      meetingProvider: meeting ? "Zoom" : null,
      meetingUrl: meeting?.join_url ?? null,
      meetingId: meeting?.id ? String(meeting.id) : null,
      recurringSeriesId: meeting?.id ? String(meeting.id) : null,
      startsOn: getScheduleStartDate(input),
    },
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Teacher scheduled a Zoom class",
        body: `${teacherDisplayName(teacher)} scheduled ${cleanLiveClassTitle(input.title)} for ${program.title} (${AUDIENCE_LABELS[audienceGroup]}).`,
        href: "/admin/classes",
      })),
    });
  }

  await sendAdminZoomMeetingRequestEmail({
    teacherName: teacherDisplayName(teacher),
    teacherEmail: teacher.user.email,
    programTitle: program.title,
    sessionTitle: cleanLiveClassTitle(input.title),
    schedule: `${input.startTime}-${input.endTime} ${input.timezone}`,
  });

  await notifyEnrolledUsers(schedule.id);

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
    topic: cleanLiveClassTitle(schedule.title),
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
      body: `${cleanLiveClassTitle(schedule.title)} has been approved and linked to Zoom.`,
      href: "/teacher/schedule",
    },
  });

  await sendTeacherZoomMeetingApprovedEmail({
    toEmail: schedule.teacher.user.email,
    teacherName: schedule.teacher.user.firstName,
    sessionTitle: cleanLiveClassTitle(schedule.title),
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
    topic: cleanLiveClassTitle(schedule.title),
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
  if (!schedule || !schedule.meetingUrl || !isLiveClassVisibleToStudents(schedule.title)) return;

  const audienceGroup = getLiveClassAudienceGroup(schedule.title);
  const visibleTitle = cleanLiveClassTitle(schedule.title);
  const users = new Map<string, { id: string; role: string }>();
  users.set(schedule.teacher.user.id, { id: schedule.teacher.user.id, role: "teacher" });

  for (const enrollment of schedule.program.enrollments) {
    if (!countryMatchesAudience(enrollment.student.countryCode, audienceGroup)) continue;
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
        body: `${visibleTitle} is now scheduled on Zoom. ${schedule.startTime}-${schedule.endTime} ${schedule.timezone}.`,
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
