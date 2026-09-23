import "server-only";
import { attendanceDayKey, connectedMinutes } from "@/lib/live-classes/attendance-policy";

import { createHmac, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";
import { pointDayKey } from "@/lib/community/point-awards";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { attendancePointState, lockAttendanceStudent } from "@/lib/live-classes/attendance-ledger";
import { env } from "@/lib/env";
import { getZoomPastMeetingParticipants } from "@/lib/zoom/client";
import { cleanLiveClassTitle, resolveScheduleStudentIds } from "@/lib/live-classes/service";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

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

async function matchParticipantToStudent(scheduleId: string, event: ParticipantEvent) {
  const studentIds = await resolveScheduleStudentIds(scheduleId);
  if (!studentIds.length) return { studentId: null, method: null };
  const email = normalize(event.email);
  const participantName = normalize(event.name);
  const students = await db.studentProfile.findMany({
    where: { id: { in: studentIds } },
    include: { user: { select: { firstName: true, lastName: true, email: true } }, parents: { include: { parent: { include: { user: { select: { email: true } } } } } } },
  });
  const named = students.filter((student) => [student.displayName, `${student.user.firstName} ${student.user.lastName ?? ""}`].map(normalize).filter(Boolean).includes(participantName));
  const emailed = email ? students.filter((student) => normalize(student.user.email) === email || student.parents.some((link) => normalize(link.parent.user.email) === email)) : [];
  if (emailed.length === 1) return { studentId: emailed[0].id, method: "zoom-email" };
  if (emailed.length > 1) {
    const exact = emailed.filter((student) => named.some((entry) => entry.id === student.id));
    if (exact.length === 1) return { studentId: exact[0].id, method: "zoom-email-and-name" };
    return { studentId: null, method: null };
  }
  if (named.length === 1) return { studentId: named[0].id, method: "display-name" };
  return { studentId: null, method: null };
}

async function syncAttendanceRecord(scheduleId: string, studentId: string, sessionDate: Date) {
  const dayStart = new Date(attendanceDayKey(sessionDate) + "T00:00:00+05:00");
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const attendanceDay = pointDayKey(sessionDate);
  const [schedule, intervals] = await Promise.all([
    db.classSchedule.findUnique({ where: { id: scheduleId }, select: { id: true, title: true, programId: true, program: { select: { title: true } } } }),
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
  const leftAt = closed.length ? new Date(Math.max(...closed.map((item) => item.leftAt!.getTime()))) : null;
  const durationMinutes = connectedMinutes(intervals);
  const occurrence = await db.liveClassSessionOccurrence.findFirst({
    where: { scheduleId, startedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  const membership = await ensureStudentHouseMembership(studentId);
  await db.$transaction(async (tx) => {
    await lockAttendanceStudent(tx, studentId);
    const existing = await tx.attendanceRecord.findFirst({ where: { scheduleId, studentId, attendanceDay }, orderBy: { updatedAt: "desc" } });
    const data = {
      enrollmentId: enrollment.id, studentId, scheduleId,
      lessonDate: occurrence?.startedAt ?? joinedAt, attendanceDay,
      status: "PRESENT" as const,
      note: `Automatically tracked from Zoom (${durationMinutes} minutes).`,
      joinedAt, leftAt, durationMinutes, source: "zoom", markedByUserId: null,
    };
    if (existing) await tx.attendanceRecord.update({ where: { id: existing.id }, data });
    else await tx.attendanceRecord.create({ data });
    if (occurrence) {
      const state = await attendancePointState(tx, studentId, schedule, occurrence.startedAt);
      if (state.parentBalance + state.verifiedBalance <= 0) await tx.housePointLedger.create({ data: {
        studentId, houseId: membership.houseId, points: 5,
        reason: `Attended class: ${cleanLiveClassTitle(schedule.title)} (${attendanceDay})`,
        sourceType: "ATTENDANCE_VERIFIED", sourceId: `${state.key}:zoom`,
      } });
    }
  }, { maxWait: 10000, timeout: 30000 });
}

export async function recordZoomParticipantJoined(scheduleId: string, event: ParticipantEvent) {
  const matched = await matchParticipantToStudent(scheduleId, event);
  const existing = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      ...(event.participantId ? { zoomParticipantId: event.participantId }
        : event.email ? { participantEmail: normalize(event.email) }
        : { participantName: event.name?.trim() || null }),
      joinedAt: { gte: new Date(event.occurredAt.getTime() - 2000), lte: new Date(event.occurredAt.getTime() + 2000) },
    },
  });
  const interval = existing
    ? (!existing.studentId && matched.studentId
      ? await db.zoomAttendanceInterval.update({ where: { id: existing.id }, data: { studentId: matched.studentId, matchMethod: matched.method } }) : existing)
    : await db.zoomAttendanceInterval.create({
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
  if (interval.studentId) await syncAttendanceRecord(scheduleId, interval.studentId, interval.joinedAt);
  return interval;
}

export async function recordZoomParticipantLeft(scheduleId: string, event: ParticipantEvent & { durationSeconds?: number | null; joinedAt?: Date }) {
  const interval = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      ...(event.joinedAt ? { joinedAt: event.joinedAt } : { leftAt: null }),
      OR: [
        ...(event.participantId ? [{ zoomParticipantId: event.participantId }] : []),
        ...(!event.participantId && event.email ? [{ participantEmail: normalize(event.email) }] : []),
        ...(!event.participantId && !event.email && event.name ? [{ participantName: event.name.trim() }] : []),
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
  const studentIds = await resolveScheduleStudentIds(scheduleId);
  const schedule = await db.classSchedule.findUnique({ where: { id: scheduleId }, select: { programId: true } });
  if (!schedule || !studentIds.length) return;
  const attendanceDay = pointDayKey(endedAt);
  const [enrollments, existing] = await Promise.all([
    db.enrollment.findMany({ where: { studentId: { in: studentIds }, programId: schedule.programId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } }, select: { id: true, studentId: true } }),
    db.attendanceRecord.findMany({ where: { scheduleId, attendanceDay }, select: { studentId: true } }),
  ]);
  const recorded = new Set(existing.map((item) => item.studentId));
  const missing = enrollments.filter((item) => !recorded.has(item.studentId));
  if (missing.length) await db.attendanceRecord.createMany({ data: missing.map((item) => ({ enrollmentId: item.id, studentId: item.studentId, scheduleId, lessonDate: endedAt, attendanceDay, status: "EXCUSED" as const, note: "Attendance needs confirmation because no matched Zoom attendance was detected.", source: "zoom-unverified" })), skipDuplicates: true });
}

export async function reconcileZoomParticipantReport(scheduleId: string, meetingId: string, meetingUuid?: string) {
  const participants = await getZoomPastMeetingParticipants(meetingUuid || meetingId);
  for (const participant of participants) {
    const joinedAt = participant.join_time ? new Date(participant.join_time) : null;
    const leftAt = participant.leave_time ? new Date(participant.leave_time) : null;
    if (!joinedAt) continue;
    const joined = await recordZoomParticipantJoined(scheduleId, { meetingId, meetingUuid, participantId: participant.user_id ?? participant.id, email: participant.user_email, name: participant.name, occurredAt: joinedAt });
    if (leftAt) await recordZoomParticipantLeft(scheduleId, { meetingId, participantId: participant.user_id ?? participant.id, email: participant.user_email, name: participant.name, occurredAt: leftAt, joinedAt: joined.joinedAt, durationSeconds: participant.duration });
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
