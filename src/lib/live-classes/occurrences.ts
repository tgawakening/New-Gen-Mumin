import "server-only";

import { db } from "@/lib/db";

export function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function isOccurrenceTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "P2021" || code === "P2022" || message.includes("LiveClassSessionOccurrence");
}

export async function recordLiveClassSessionOccurrence(input: {
  scheduleId: string;
  teacherUserId?: string | null;
  meetingId?: string | null;
  startedAt?: Date;
  source?: string;
}) {
  const startedAt = input.startedAt ?? new Date();
  const occurrenceDate = startOfUtcDay(startedAt);
  const source = input.source ?? "platform";

  try {
    await db.liveClassSessionOccurrence.create({
      data: {
        scheduleId: input.scheduleId,
        teacherUserId: input.teacherUserId ?? "",
        meetingId: input.meetingId ?? null,
        occurrenceDate,
        startedAt,
        source,
      },
    });
  } catch (error) {
    if (isOccurrenceTableUnavailable(error)) {
      console.error("Live class occurrence table is not available yet.", error);
      return;
    }
    throw error;
  }
}

export async function recordLiveClassSessionEnd(input: {
  scheduleId: string;
  meetingId?: string | null;
  endedAt?: Date;
}) {
  const endedAt = input.endedAt ?? new Date();
  const occurrenceDate = startOfUtcDay(endedAt);

  try {
    const occurrences = await db.liveClassSessionOccurrence.findMany({
      where: {
        scheduleId: input.scheduleId,
        occurrenceDate,
        startedAt: { lte: endedAt },
        endedAt: null,
      },
      orderBy: { startedAt: "desc" },
    });

    const closedKeys = new Set<string>();
    for (const occurrence of occurrences) {
      const key = `${occurrence.teacherUserId ?? ""}:${occurrence.source}`;
      if (closedKeys.has(key)) continue;
      closedKeys.add(key);

      const durationMinutes = Math.max(0, Math.floor((endedAt.getTime() - occurrence.startedAt.getTime()) / 60000));
      await db.liveClassSessionOccurrence.update({
        where: { id: occurrence.id },
        data: {
          meetingId: input.meetingId ?? occurrence.meetingId,
          endedAt,
          durationMinutes,
          completedAt: durationMinutes >= 30 ? endedAt : null,
        },
      });
    }
  } catch (error) {
    if (isOccurrenceTableUnavailable(error)) {
      console.error("Live class occurrence table is not available yet.", error);
      return;
    }
    throw error;
  }
}
