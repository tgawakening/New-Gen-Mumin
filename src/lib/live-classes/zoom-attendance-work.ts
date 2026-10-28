import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getZoomPastMeetingParticipants, getZoomPastMeetingInstances } from "@/lib/zoom/client";
import { recordZoomParticipantJoined, recordZoomParticipantLeft, reconcileZoomParticipantRows } from "./attendance";
import { recordLiveClassSessionEnd, recordLiveClassSessionOccurrence } from "./occurrences";
import { selectZoomAttendanceSchedule } from "./zoom-presence-policy";

export type ZoomPresencePayload = {
  event?: string; event_ts?: number;
  payload?: { object?: {
    id?: string | number; uuid?: string; topic?: string; host_email?: string;
    start_time?: string; end_time?: string;
    participant?: { id?: string; user_id?: string; participant_uuid?: string; user_name?: string; email?: string; join_time?: string; leave_time?: string; duration?: number };
  } };
};
type WorkPayload = ZoomPresencePayload & { report?: Awaited<ReturnType<typeof getZoomPastMeetingParticipants>>; reportReady?: boolean; cursor?: number };
const supported = new Set(["meeting.started", "meeting.ended", "meeting.participant_joined", "meeting.participant_left", "recording.completed"]);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function zoomPresenceEnabled() { return process.env.ZOOM_ATTENDANCE_PIPELINE_ENABLED === "true"; }
export function zoomAttendanceBackfillDays() { return Math.min(365, Math.max(35, Number(process.env.ZOOM_ATTENDANCE_BACKFILL_DAYS) || 90)); }

/** Return only after durable storage. Queue failures must reach Zoom as a failed webhook. */
export async function captureZoomPresence(payload: ZoomPresencePayload) {
  if (!zoomPresenceEnabled()) return false;
  const object = payload.payload?.object;
  if (!supported.has(payload.event ?? "") || !object?.id) return false;
  const report = ["meeting.ended", "recording.completed"].includes(payload.event!);
  const kind = report ? "REPORT" : payload.event === "meeting.started" ? "CONTEXT" : "EVENT";
  const participant = object.participant ? {
    id: object.participant.id, user_id: object.participant.user_id, participant_uuid: object.participant.participant_uuid,
    user_name: object.participant.user_name, email: object.participant.email,
    join_time: object.participant.join_time, leave_time: object.participant.leave_time, duration: object.participant.duration,
  } : undefined;
  const envelope = { event: payload.event, event_ts: payload.event_ts, payload: { object: { id: String(object.id), uuid: object.uuid, topic: object.topic, host_email: object.host_email, start_time: object.start_time, end_time: object.end_time, participant } } };
  // Keep only attendance evidence, not recording download URLs/tokens or unrelated Zoom metadata.
  const savedPayload = JSON.parse(JSON.stringify(envelope)) as Prisma.InputJsonValue;
  // Reports reconcile the same occurrence once, regardless of duplicate ended/recording events.
  const eventKey = digest(report ? `REPORT:${object.uuid ?? `${object.id}:${object.start_time ?? object.end_time ?? "missing-uuid"}`}` : JSON.stringify([payload.event, object.uuid, String(object.id), participant, kind === "CONTEXT" ? object.start_time : null]));
  await db.zoomAttendanceWork.upsert({ where: { eventKey }, update: {}, create: {
    eventKey, kind, status: kind === "CONTEXT" ? "CONTEXT" : "PENDING",
    meetingId: String(object.id), meetingUuid: object.uuid,
    payload: savedPayload,
    availableAt: new Date(Date.now() + (report ? 90_000 : 0)),
  } });
  return true;
}

function validDate(raw: string | undefined, fallback?: number) {
  const date = raw ? new Date(raw) : fallback ? new Date(fallback) : null;
  if (!date || !Number.isFinite(date.getTime())) throw new Error("Zoom event is missing a valid occurrence timestamp.");
  return date;
}

async function processOne(work: { id: string; kind: string; meetingId: string; meetingUuid: string | null; payload: Prisma.JsonValue }, lockToken: string) {
  if (work.kind === "SEED") {
    const schedules = await db.classSchedule.findMany({ where: { meetingId: { not: null }, OR: [{ endsOn: null }, { endsOn: { gte: new Date(Date.now() - zoomAttendanceBackfillDays() * 86400000) } }] }, select: { meetingId: true, recurringSeriesId: true } });
    const ids = [...new Set(schedules.flatMap(s => [s.meetingId, s.recurringSeriesId]).filter((id): id is string => Boolean(id)))];
    const day = new Date().toISOString().slice(0, 10);
    await db.zoomAttendanceWork.createMany({ data: ids.map(meetingId => ({ id: randomUUID(), eventKey: digest(`DISCOVERY:${meetingId}:${day}`), kind: "DISCOVERY", meetingId, payload: {}, status: "PENDING" })), skipDuplicates: true });
    await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { status: "DONE", lockedAt: null, lockToken: null, lastError: null } });
    return;
  }
  if (work.kind === "DISCOVERY") {
    const instances = await getZoomPastMeetingInstances(work.meetingId);
    const since = Date.now() - zoomAttendanceBackfillDays() * 86400000;
    for (const instance of instances) {
      if (new Date(instance.start_time).getTime() < since) continue;
      await captureZoomPresence({ event: "meeting.ended", payload: { object: { id: work.meetingId, uuid: instance.uuid, start_time: instance.start_time } } });
    }
    await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { status: "DONE", lockedAt: null, lockToken: null, lastError: null } });
    return;
  }
  const payload = work.payload as WorkPayload;
  const object = payload.payload?.object;
  if (!object || !work.meetingUuid) throw new Error("Meeting occurrence UUID is missing. Cannot safely associate a recurring meeting.");
  if (work.kind === "REPORT" && (!payload.report || payload.reportReady === false)) {
    const report = await getZoomPastMeetingParticipants(work.meetingUuid);
    payload.report = report;
    payload.cursor = 0;
    payload.reportReady = report.length > 0 && report.every(row => row.join_time && row.leave_time && Number.isFinite(Date.parse(row.join_time)) && Number.isFinite(Date.parse(row.leave_time)) && Date.parse(row.leave_time) >= Date.parse(row.join_time)) && report.some(row => row.join_time && row.leave_time && Date.parse(row.leave_time) > Date.parse(row.join_time));
    await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { payload: payload as Prisma.InputJsonValue } });
    if (!payload.reportReady) throw new Error("Zoom participant report is still incomplete; saved snapshot will be retried.");
  }
  const context = await db.zoomAttendanceWork.findFirst({ where: { meetingUuid: work.meetingUuid, kind: "CONTEXT" }, orderBy: { createdAt: "desc" } });
  const meeting = (context?.payload as WorkPayload | undefined)?.payload?.object;
  const reportStarts = payload.report?.flatMap(row => row.join_time ? [new Date(row.join_time).getTime()] : []).filter(Number.isFinite) ?? [];
  const reportStart = reportStarts.length ? new Date(Math.min(...reportStarts)).toISOString() : undefined;
  const at = validDate(meeting?.start_time ?? object.start_time ?? reportStart ?? object.participant?.join_time ?? object.participant?.leave_time ?? object.end_time, payload.event_ts);
  const schedules = await db.classSchedule.findMany({ where: { OR: [{ meetingId: work.meetingId }, { recurringSeriesId: work.meetingId }] }, include: { teacher: { include: { user: true } } } });
  const schedule = selectZoomAttendanceSchedule(schedules, at, object.topic ?? meeting?.topic, object.host_email ?? meeting?.host_email);
  if (!schedule) throw new Error("No unique schedule matches this Zoom occurrence. Check meeting IDs, timetable and topic.");

  if (work.kind === "REPORT") {
    if (object.end_time) await recordLiveClassSessionEnd({ scheduleId: schedule.id, meetingId: work.meetingId, endedAt: validDate(object.end_time), startedAt: meeting?.start_time || object.start_time ? validDate(meeting?.start_time ?? object.start_time) : undefined });
    if (!payload.report) {
      const report = await getZoomPastMeetingParticipants(work.meetingUuid);
      if (!report.length) throw new Error("Zoom participant report is not yet available or is empty.");
      payload.report = report;
      payload.cursor = 0;
    }
    const start = payload.cursor ?? 0;
    const batch = payload.report.slice(start, start + 20);
    const firstJoin = payload.report.flatMap(row => row.join_time ? [new Date(row.join_time).getTime()] : []).filter(Number.isFinite);
    // Do not invent class start from a portal click; use Zoom timestamps only.
    if (firstJoin.length) {
      const startedAt = meeting?.start_time || object.start_time ? validDate(meeting?.start_time ?? object.start_time) : new Date(Math.min(...firstJoin));
      const existing = await db.liveClassSessionOccurrence.findFirst({ where: { scheduleId: schedule.id, meetingId: work.meetingId, startedAt: { gte: new Date(startedAt.getTime() - 60_000), lte: new Date(startedAt.getTime() + 60_000) } }, select: { id: true } });
      if (!existing) await recordLiveClassSessionOccurrence({ scheduleId: schedule.id, meetingId: work.meetingId, teacherUserId: schedule.teacher.user.id, source: "zoom-report", startedAt });
    }
    await reconcileZoomParticipantRows(schedule.id, work.meetingId, work.meetingUuid, batch);
    const joins = payload.report.flatMap(row => row.join_time ? [new Date(row.join_time).getTime()] : []).filter(Number.isFinite);
    const leaves = payload.report.flatMap(row => row.leave_time ? [new Date(row.leave_time).getTime()] : []).filter(Number.isFinite);
    const sessionStartedAt = meeting?.start_time || object.start_time ? validDate(meeting?.start_time ?? object.start_time) : joins.length ? new Date(Math.min(...joins)) : null;
    const sessionEndedAt = object.end_time ? validDate(object.end_time) : leaves.length ? new Date(Math.max(...leaves)) : null;
    await db.zoomAttendanceInterval.updateMany({ where: { scheduleId: schedule.id, meetingUuid: work.meetingUuid }, data: { sessionStartedAt, sessionEndedAt } });
    payload.cursor = start + batch.length;
    const done = payload.cursor >= payload.report.length;
    if (done && object.end_time) await recordLiveClassSessionEnd({ scheduleId: schedule.id, meetingId: work.meetingId, endedAt: validDate(object.end_time), startedAt: meeting?.start_time || object.start_time ? validDate(meeting?.start_time ?? object.start_time) : undefined });
    await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { payload: payload as Prisma.InputJsonValue, status: done ? "DONE" : "PENDING", lockedAt: null, lockToken: null, availableAt: new Date(), lastError: null } });
    return;
  }

  const participant = object.participant;
  if (!participant) throw new Error("Zoom participant details missing.");
  const event = {
    meetingId: work.meetingId, meetingUuid: work.meetingUuid,
    participantId: participant.user_id != null || participant.id != null || participant.participant_uuid != null ? String(participant.user_id ?? participant.id ?? participant.participant_uuid) : undefined,
    email: participant.email, name: participant.user_name,
    occurredAt: validDate(payload.event === "meeting.participant_left" ? participant.leave_time : participant.join_time, payload.event_ts),
  };
  if (payload.event === "meeting.participant_joined") await recordZoomParticipantJoined(schedule.id, event);
  else await recordZoomParticipantLeft(schedule.id, { ...event, durationSeconds: participant.duration });
  await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { status: "DONE", lockedAt: null, lockToken: null, lastError: null } });
}

/** Run from a scheduled worker every minute; stale claims are recoverable across restarts. */
export async function processZoomAttendanceWork(limit = 4, eventsOnly = false) {
  if (!zoomPresenceEnabled()) return [];
  const now = new Date(), stale = new Date(now.getTime() - 10 * 60_000);
  const due = { availableAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "PROCESSING", lockedAt: { lt: stale } }] };
  const count = Math.min(10, Math.max(1, limit));
  const events = await db.zoomAttendanceWork.findMany({ where: { ...due, kind: "EVENT" }, orderBy: { availableAt: "asc" }, take: count === 1 ? 1 : count - 1 });
  const other = !eventsOnly && events.length < count ? await db.zoomAttendanceWork.findMany({ where: { ...due, kind: { not: "EVENT" } }, orderBy: { availableAt: "asc" }, take: count - events.length }) : [];
  const jobs = [...events, ...other];
  const results: Array<{ id: string; ok: boolean }> = [];
  for (const work of jobs) {
    const lockToken = randomUUID();
    const claim = await db.zoomAttendanceWork.updateMany({ where: { id: work.id, availableAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "PROCESSING", lockedAt: { lt: stale } }] }, data: { status: "PROCESSING", lockedAt: now, lockToken } });
    if (!claim.count) continue;
    try { await processOne(work, lockToken); results.push({ id: work.id, ok: true }); }
    catch (error) {
      const attempts = work.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Attendance processing failed";
      await db.zoomAttendanceWork.updateMany({ where: { id: work.id, lockToken }, data: { status: attempts >= 12 ? "FAILED" : "PENDING", attempts, lockedAt: null, lockToken: null, lastError: message, availableAt: new Date(Date.now() + Math.min(6 * 3600_000, 30_000 * 2 ** Math.min(attempts, 10))) } });
      results.push({ id: work.id, ok: false });
    }
  }
  return results;
}

/** Discover known meeting occurrences even when Zoom never delivered an ended webhook. */
export async function seedZoomAttendanceDiscovery() {
  if (!zoomPresenceEnabled()) return;
  const day = new Date().toISOString().slice(0, 10);
  await db.zoomAttendanceWork.createMany({ data: [{ id: randomUUID(), eventKey: digest(`SEED:${day}`), kind: "SEED", meetingId: "discovery", payload: {}, status: "PENDING" }], skipDuplicates: true });
}
