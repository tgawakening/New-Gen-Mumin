import { createHash } from "node:crypto";
import { matchZoomIdentity } from "@/lib/live-classes/zoom-presence-policy";
import "server-only";
import { ATTENDANCE_POINTS, attendanceDayKey, connectedMinutes } from "@/lib/live-classes/attendance-policy";

import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";
import { pointDayKey } from "@/lib/community/point-awards";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";
import { attendancePointState, lockAttendanceStudent } from "@/lib/live-classes/attendance-ledger";
import { env } from "@/lib/env";
import { getZoomPastMeetingParticipants } from "@/lib/zoom/client";
import { cleanLiveClassTitle, isParentalLiveClass, resolveScheduleStudentIds } from "@/lib/live-classes/service";

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
  evidenceSource?: string;
  deferSync?: boolean;
  identityMatch?: { studentId: string | null; parentId?: string | null; method: string | null };
};

type ZoomIdentityMatch = { studentId: string | null; parentId?: string | null; method: string | null };
async function loadIdentityMatcher(scheduleId: string): Promise<(event: Pick<ParticipantEvent, "name" | "email">) => ZoomIdentityMatch> {
  const schedule = await db.classSchedule.findUnique({ where: { id: scheduleId }, select: { title: true, programId: true } });
  if (isParentalLiveClass(schedule?.title)) {
    const parents = await db.parentProfile.findMany({ where: { students: { some: { student: { enrollments: { some: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } } } } }, include: { user: true } });
    const candidates = parents.map(p => ({ id: p.id, names: [[p.user.firstName, p.user.lastName].filter(Boolean).join(" ")], emails: [p.user.email] }));
    return event => { const matched = matchZoomIdentity("parent", candidates, event.name, event.email); return { studentId: null, parentId: matched?.id ?? null, method: matched?.method ?? null }; };
  }
  const studentIds = await resolveScheduleStudentIds(scheduleId);
  const enrolled = schedule?.programId ? await db.enrollment.findMany({ where: { programId: schedule.programId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } }, select: { studentId: true } }) : [];
  const ids = [...new Set([...studentIds, ...enrolled.map(e => e.studentId)])];
  if (!ids.length) return () => ({ studentId: null, method: null });
  const students = await db.studentProfile.findMany({ where: { id: { in: ids } }, include: { user: { select: { firstName: true, lastName: true, email: true } }, parents: { include: { parent: { include: { user: { select: { email: true } } } } } } } });
  const candidates = students.map(student => ({ id: student.id, names: [student.displayName ?? "", [student.user.firstName, student.user.lastName].filter(Boolean).join(" ")], emails: [student.user.email, ...student.parents.map(link => link.parent.user.email)] }));
  return event => { const matched = matchZoomIdentity("student", candidates, event.name, event.email); return { studentId: matched?.id ?? null, method: matched?.method ?? null }; };
}

const identityCache = new Map<string, { until: number; match: (event: Pick<ParticipantEvent, "name" | "email">) => ZoomIdentityMatch }>();
async function buildIdentityMatcher(scheduleId: string) {
  const cached = identityCache.get(scheduleId);
  if (cached && cached.until > Date.now()) return cached.match;
  const match = await loadIdentityMatcher(scheduleId);
  for (const [key, entry] of identityCache) if (entry.until <= Date.now()) identityCache.delete(key);
  if (identityCache.size >= 50) identityCache.delete(identityCache.keys().next().value!);
  identityCache.set(scheduleId, { until: Date.now() + 15_000, match });
  return match;
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
      const delta = Math.max(0, ATTENDANCE_POINTS - state.parentBalance - state.verifiedBalance);
      if (delta) await tx.housePointLedger.create({ data: {
        studentId, houseId: membership.houseId, points: delta,
        reason: `Attended class: ${cleanLiveClassTitle(schedule.title)} (${attendanceDay})`,
        sourceType: "ATTENDANCE_VERIFIED", sourceId: `${state.key}:zoom:${randomUUID()}`,
      } });
    }
  }, { maxWait: 10000, timeout: 30000 });
}

export async function recordZoomParticipantJoined(scheduleId: string, event: ParticipantEvent) {
  const matched = event.identityMatch ?? (await buildIdentityMatcher(scheduleId))(event);
  const participantKey = event.participantId || "anon:" + createHash("sha256").update(normalize(event.email) + ":" + normalize(event.name)).digest("hex").slice(0, 32);
  const existing = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      ...(event.meetingUuid ? { OR: [{ meetingUuid: event.meetingUuid }, { meetingUuid: null }] } : {}),
      ...(event.participantId ? { zoomParticipantId: event.participantId }
        : event.email ? { participantEmail: normalize(event.email) }
        : { participantName: event.name?.trim() || null }),
      joinedAt: { gte: new Date(event.occurredAt.getTime() - 2000), lte: new Date(event.occurredAt.getTime() + 2000) },
    },
  });
  const interval = existing
    ? await db.zoomAttendanceInterval.update({ where: { id: existing.id }, data: { ...(event.meetingUuid ? { meetingUuid: event.meetingUuid } : {}), ...(matched.studentId ? { studentId: matched.studentId, matchMethod: matched.method } : {}), ...("parentId" in matched && matched.parentId ? { parentId: matched.parentId, matchMethod: matched.method } : {}), ...(event.evidenceSource === "zoom-report" ? { evidenceSource: "zoom-report" } : {}) } })
    : await db.zoomAttendanceInterval.create({
    data: {
      scheduleId,
      studentId: matched.studentId,
      parentId: "parentId" in matched ? matched.parentId : null,
      evidenceSource: event.evidenceSource ?? "webhook",
      meetingId: event.meetingId,
      meetingUuid: event.meetingUuid,
      zoomParticipantId: participantKey,
      participantEmail: normalize(event.email) || null,
      participantName: event.name?.trim() || null,
      joinedAt: event.occurredAt,
      matchMethod: matched.method,
    },
  });
  if (interval.studentId && !event.deferSync) await syncAttendanceRecord(scheduleId, interval.studentId, interval.joinedAt);
  return interval;
}

export async function recordZoomParticipantLeft(scheduleId: string, event: ParticipantEvent & { durationSeconds?: number | null; joinedAt?: Date }) {
  const interval = await db.zoomAttendanceInterval.findFirst({
    where: {
      scheduleId,
      meetingId: event.meetingId,
      ...(event.meetingUuid ? { meetingUuid: event.meetingUuid } : {}),
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
    if (!event.joinedAt && !(event.durationSeconds && event.durationSeconds > 0)) throw new Error("Join event not yet available; awaiting Zoom report reconciliation.");
    const joined = await recordZoomParticipantJoined(scheduleId, {
      ...event,
      occurredAt: event.joinedAt ?? new Date(event.occurredAt.getTime() - Math.max(0, event.durationSeconds ?? 0) * 1000),
    });
    if (joined.evidenceSource === "zoom-report" && event.evidenceSource !== "zoom-report") return joined;
    const durationSeconds = Math.max(0, event.durationSeconds ?? Math.round((event.occurredAt.getTime() - joined.joinedAt.getTime()) / 1000));
    const updated = await db.zoomAttendanceInterval.update({ where: { id: joined.id }, data: { leftAt: event.occurredAt, durationSeconds, ...(event.evidenceSource === "zoom-report" ? { evidenceSource: "zoom-report" } : {}) } });
    if (updated.studentId && !event.deferSync) await syncAttendanceRecord(scheduleId, updated.studentId, updated.joinedAt);
    return updated;
  }
  if (interval.evidenceSource === "zoom-report" && event.evidenceSource !== "zoom-report") return interval;
  if (event.occurredAt < interval.joinedAt) throw new Error("Zoom leave time precedes join time.");
  const durationSeconds = event.evidenceSource === "zoom-report" ? Math.max(0, Math.round((event.occurredAt.getTime() - interval.joinedAt.getTime()) / 1000)) : Math.max(interval.durationSeconds, event.durationSeconds ?? Math.round((event.occurredAt.getTime() - interval.joinedAt.getTime()) / 1000));
  const updated = await db.zoomAttendanceInterval.update({ where: { id: interval.id }, data: { leftAt: event.occurredAt, durationSeconds, ...(event.evidenceSource === "zoom-report" ? { evidenceSource: "zoom-report" } : {}) } });
  if (updated.studentId && !event.deferSync) await syncAttendanceRecord(scheduleId, updated.studentId, updated.joinedAt);
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
  await reconcileZoomParticipantRows(scheduleId, meetingId, meetingUuid, participants);
  return participants.length;
}

export async function reconcileZoomParticipantRows(scheduleId: string, meetingId: string, meetingUuid: string | undefined, participants: Awaited<ReturnType<typeof getZoomPastMeetingParticipants>>) {
  const matcher = await buildIdentityMatcher(scheduleId);
  const changed = new Map<string, { studentId: string; day: Date }>();
  for (const participant of participants) {
    const joinedAt = participant.join_time ? new Date(participant.join_time) : null;
    const leftAt = participant.leave_time ? new Date(participant.leave_time) : null;
    if (!joinedAt || !Number.isFinite(joinedAt.getTime())) continue;
    const identityMatch = matcher({ name: participant.name, email: participant.user_email });
    const joined = await recordZoomParticipantJoined(scheduleId, { meetingId, meetingUuid, participantId: participant.user_id ?? participant.id, evidenceSource: "zoom-report", deferSync: true, identityMatch, email: participant.user_email, name: participant.name, occurredAt: joinedAt });
    if (joined.studentId) changed.set(joined.studentId + ":" + attendanceDayKey(joinedAt), { studentId: joined.studentId, day: joinedAt });
    if (leftAt && Number.isFinite(leftAt.getTime()) && leftAt >= joinedAt) await recordZoomParticipantLeft(scheduleId, { meetingId, meetingUuid, evidenceSource: "zoom-report", deferSync: true, identityMatch, participantId: participant.user_id ?? participant.id, email: participant.user_email, name: participant.name, occurredAt: leftAt, joinedAt: joined.joinedAt, durationSeconds: participant.duration });
  }
  for (const item of changed.values()) await syncAttendanceRecord(scheduleId, item.studentId, item.day);
  return participants.length;
}

export async function closeOpenZoomAttendanceIntervals(scheduleId: string, meetingId: string, endedAt: Date) {
  const open = await db.zoomAttendanceInterval.findMany({ where: { scheduleId, meetingId, leftAt: null } });
  for (const interval of open) {
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - interval.joinedAt.getTime()) / 1000));
    await db.zoomAttendanceInterval.update({ where: { id: interval.id }, data: { leftAt: endedAt, durationSeconds, evidenceSource: "inferred-close" } });
    if (interval.studentId) await syncAttendanceRecord(scheduleId, interval.studentId, interval.joinedAt);
  }
  await markRosterAbsences(scheduleId, endedAt);
}
