import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { awardHousePointsOnce, HOUSE_POINT_RULES, pointDayKey } from "@/lib/community/point-awards";
import { env } from "@/lib/env";
import { getZoomPastMeetingParticipants } from "@/lib/zoom/client";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const JOIN_MATCH_WINDOW_MS = 4 * 60 * 60 * 1000;

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function signJoinValue(value: string) {
  if (!env.success) throw new Error("Environment configuration is unavailable.");
  return createHmac("sha256", env.data.AUTH_SESSION_SECRET).update(value).digest("base64url");
}

export function buildTrackedZoomJoinUrl(scheduleId: string, studentId: string) {
  if (!env.success) return `/api/live-classes/${scheduleId}/join?student=${encodeURIComponent(studentId)}`;
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const value = `${scheduleId}:${studentId}:${expires}`;
  const query = new URLSearchParams({ student: studentId, expires: String(expires), signature: signJoinValue(value) });
  return `${env.data.APP_URL.replace(/\/$/, "")}/api/live-classes/${scheduleId}/join?${query.toString()}`;
}

export function verifyTrackedZoomJoin(scheduleId: string, studentId: string, expiresValue?: string | null, signature?: string | null) {
  if (!expiresValue || !signature) return false;
  const expires = Number(expiresValue);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = signJoinValue(`${scheduleId}:${studentId}:${expires}`);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function recordZoomJoinIntent(scheduleId: string, studentId: string, userId: string) {
  return db.zoomJoinIntent.create({ data: { scheduleId, studentId, userId } });
}

type ParticipantEvent = {
  meetingId: string;
  meetingUuid?: string | null;
  participantId?: string | null;
  email?: string | null;
  name?: string | null;
  occurredAt: Date;
};

async function eligibleStudentIds(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      programId: true,
      scheduleRosters: { select: { studentId: true } },
      program: {
        select: {
          enrollments: {
            where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
            select: { studentId: true },
          },
        },
      },
    },
  });
  if (!schedule) return [];
  return schedule.scheduleRosters.length
    ? schedule.scheduleRosters.map((item) => item.studentId)
    : schedule.program.enrollments.map((item) => item.studentId);
}

async function matchParticipantToStudent(scheduleId: string, event: ParticipantEvent) {
  const studentIds = await eligibleStudentIds(scheduleId);
  if (!studentIds.length) return { studentId: null, method: null };
  const email = normalize(event.email);
  if (email) {
    const student = await db.studentProfile.findFirst({
      where: {
        id: { in: studentIds },
        OR: [
          { user: { email } },
          { parents: { some: { parent: { user: { email } } } } },
        ],
      },
      select: { id: true },
    });
    if (student) return { studentId: student.id, method: "zoom-email" };
  }

  const intent = await db.zoomJoinIntent.findFirst({
    where: {
      scheduleId,
      studentId: { in: studentIds },
      clickedAt: { gte: new Date(event.occurredAt.getTime() - JOIN_MATCH_WINDOW_MS), lte: new Date(event.occurredAt.getTime() + 10 * 60 * 1000) },
    },
    orderBy: { clickedAt: "desc" },
    select: { studentId: true },
  });
  if (intent) return { studentId: intent.studentId, method: "tracked-link" };

  const participantName = normalize(event.name);
  if (participantName) {
    const students = await db.studentProfile.findMany({
      where: { id: { in: studentIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const matches = students.filter((student) => {
      const names = [student.displayName, `${student.user.firstName} ${student.user.lastName}`].map(normalize).filter(Boolean);
      return names.some((name) => participantName === name || participantName.includes(name) || name.includes(participantName));
    });
    if (matches.length === 1) return { studentId: matches[0].id, method: "display-name" };
  }
  return { studentId: null, method: null };
}

async function syncAttendanceRecord(scheduleId: string, studentId: string, sessionDate: Date) {
  const dayStart = new Date(sessionDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const attendanceDay = pointDayKey(sessionDate);
  const [schedule, intervals] = await Promise.all([
    db.classSchedule.findUnique({ where: { id: scheduleId }, select: { programId: true } }),
    db.zoomAttendanceInterval.findMany({
      where: { scheduleId, studentId, joinedAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  if (!schedule || !intervals.length) return;
  const enrollment = await db.enrollment.findFirst({
    where: { studentId, programId: schedule.programId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
    select: { id: true },
  });
  if (!enrollment) return;
  const joinedAt = intervals[0].joinedAt;
  const closed = intervals.filter((item) => item.leftAt);
  const leftAt = closed.length ? closed[closed.length - 1].leftAt : null;
  const durationMinutes = Math.max(0, Math.round(intervals.reduce((sum, item) => sum + item.durationSeconds, 0) / 60));
  const occurrence = await db.liveClassSessionOccurrence.findFirst({
    where: { scheduleId, startedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  const late = occurrence ? joinedAt.getTime() > occurrence.startedAt.getTime() + 10 * 60 * 1000 : false;
  const existing = await db.attendanceRecord.findFirst({
    where: { scheduleId, studentId, attendanceDay },
    orderBy: { updatedAt: "desc" },
  });
  const data = {
    enrollmentId: enrollment.id,
    studentId,
    scheduleId,
    lessonDate: occurrence?.startedAt ?? joinedAt,
    attendanceDay,
    status: late ? "LATE" as const : "PRESENT" as const,
    note: `Automatically tracked from Zoom (${durationMinutes} minutes).`,
    joinedAt,
    leftAt,
    durationMinutes,
    source: "zoom",
  };
  if (existing) await db.attendanceRecord.update({ where: { id: existing.id }, data });
  else {
    try {
      await db.attendanceRecord.create({ data });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      await db.attendanceRecord.updateMany({ where: { scheduleId, studentId, attendanceDay }, data });
    }
  }

  const joinedOnTime = Boolean(occurrence && joinedAt.getTime() <= occurrence.startedAt.getTime());
  if (joinedOnTime) {
    await awardHousePointsOnce({
      studentId,
      points: HOUSE_POINT_RULES.ATTENDANCE_ON_TIME.points,
      reason: HOUSE_POINT_RULES.ATTENDANCE_ON_TIME.label,
      sourceType: "ATTENDANCE_ON_TIME",
      sourceId: scheduleId + ":" + pointDayKey(occurrence!.startedAt),
      notificationHref: "/student/attendance",
    });
  }
}

export async function recordZoomParticipantJoined(scheduleId: string, event: ParticipantEvent) {
  const matched = await matchParticipantToStudent(scheduleId, event);
  const existing = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      zoomParticipantId: event.participantId ?? null,
      joinedAt: { gte: new Date(event.occurredAt.getTime() - 2000), lte: new Date(event.occurredAt.getTime() + 2000) },
    },
  });
  if (existing) return existing;
  return db.zoomAttendanceInterval.create({
    data: {
      scheduleId,
      studentId: matched.studentId,
      meetingId: event.meetingId,
      meetingUuid: event.meetingUuid,
      zoomParticipantId: event.participantId,
      participantEmail: normalize(event.email) || null,
      participantName: event.name?.trim() || null,
      joinedAt: event.occurredAt,
      matchMethod: matched.method,
    },
  });
}

export async function recordZoomParticipantLeft(scheduleId: string, event: ParticipantEvent & { durationSeconds?: number | null }) {
  const interval = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      leftAt: null,
      OR: [
        ...(event.participantId ? [{ zoomParticipantId: event.participantId }] : []),
        ...(event.email ? [{ participantEmail: normalize(event.email) }] : []),
      ],
    },
    orderBy: { joinedAt: "desc" },
  });
  if (!interval) {
    const joined = await recordZoomParticipantJoined(scheduleId, {
      ...event,
      occurredAt: new Date(event.occurredAt.getTime() - Math.max(0, event.durationSeconds ?? 0) * 1000),
    });
    const durationSeconds = Math.max(0, event.durationSeconds ?? Math.round((event.occurredAt.getTime() - joined.joinedAt.getTime()) / 1000));
    const updated = await db.zoomAttendanceInterval.update({ where: { id: joined.id }, data: { leftAt: event.occurredAt, durationSeconds } });
    if (updated.studentId) await syncAttendanceRecord(scheduleId, updated.studentId, updated.joinedAt);
    return updated;
  }
  const durationSeconds = Math.max(interval.durationSeconds, event.durationSeconds ?? Math.round((event.occurredAt.getTime() - interval.joinedAt.getTime()) / 1000));
  const updated = await db.zoomAttendanceInterval.update({ where: { id: interval.id }, data: { leftAt: event.occurredAt, durationSeconds } });
  if (updated.studentId) await syncAttendanceRecord(scheduleId, updated.studentId, updated.joinedAt);
  return updated;
}

async function markRosterAbsences(scheduleId: string, endedAt: Date) {
  const studentIds = await eligibleStudentIds(scheduleId);
  const schedule = await db.classSchedule.findUnique({ where: { id: scheduleId }, select: { programId: true } });
  if (!schedule || !studentIds.length) return;
  const attendanceDay = pointDayKey(endedAt);
  const [enrollments, existing] = await Promise.all([
    db.enrollment.findMany({ where: { studentId: { in: studentIds }, programId: schedule.programId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } }, select: { id: true, studentId: true } }),
    db.attendanceRecord.findMany({ where: { scheduleId, attendanceDay }, select: { studentId: true } }),
  ]);
  const recorded = new Set(existing.map((item) => item.studentId));
  const missing = enrollments.filter((item) => !recorded.has(item.studentId));
  if (missing.length) await db.attendanceRecord.createMany({ data: missing.map((item) => ({ enrollmentId: item.id, studentId: item.studentId, scheduleId, lessonDate: endedAt, attendanceDay, status: "ABSENT" as const, note: "No verified Zoom attendance was detected.", source: "zoom" })), skipDuplicates: true });
}

export async function reconcileZoomParticipantReport(scheduleId: string, meetingId: string) {
  const participants = await getZoomPastMeetingParticipants(meetingId);
  for (const participant of participants) {
    const joinedAt = participant.join_time ? new Date(participant.join_time) : null;
    const leftAt = participant.leave_time ? new Date(participant.leave_time) : null;
    if (!joinedAt) continue;
    await recordZoomParticipantJoined(scheduleId, { meetingId, participantId: participant.user_id ?? participant.id, email: participant.user_email, name: participant.name, occurredAt: joinedAt });
    if (leftAt) await recordZoomParticipantLeft(scheduleId, { meetingId, participantId: participant.user_id ?? participant.id, email: participant.user_email, name: participant.name, occurredAt: leftAt, durationSeconds: participant.duration });
  }
  return participants.length;
}

export async function closeOpenZoomAttendanceIntervals(scheduleId: string, meetingId: string, endedAt: Date) {
  const open = await db.zoomAttendanceInterval.findMany({ where: { scheduleId, meetingId, leftAt: null } });
  for (const interval of open) {
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - interval.joinedAt.getTime()) / 1000));
    await db.zoomAttendanceInterval.update({ where: { id: interval.id }, data: { leftAt: endedAt, durationSeconds } });
    if (interval.studentId) await syncAttendanceRecord(scheduleId, interval.studentId, interval.joinedAt);
  }
  await markRosterAbsences(scheduleId, endedAt);
}
