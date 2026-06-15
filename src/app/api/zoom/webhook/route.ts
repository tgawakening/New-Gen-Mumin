import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  cleanLiveClassTitle,
  enrollmentMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  getScheduleRosterStudentIds,
} from "@/lib/live-classes/service";

function webhookSecret() {
  return env.success ? env.data.ZOOM_WEBHOOK_SECRET_TOKEN : undefined;
}

function hashWithSecret(value: string) {
  const secret = webhookSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

function fallbackRecordingFileId(scheduleId: string, playUrl: string) {
  return `${scheduleId}-${createHash("sha256").update(playUrl).digest("hex").slice(0, 32)}`;
}

function isRecordingTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "P2021" || code === "P2022" || message.includes("LiveClassRecording");
}

function verifyZoomSignature(request: NextRequest, rawBody: string) {
  const secret = webhookSecret();
  if (!secret) return false;

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!timestamp || !signature) return false;

  const expected = `v0=${hashWithSecret(`v0:${timestamp}:${rawBody}`)}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      plainToken?: string;
      object?: {
        id?: string | number;
        topic?: string;
        join_url?: string;
        host_email?: string;
        recording_files?: Array<{
          id?: string;
          play_url?: string;
          download_url?: string;
          file_type?: string;
          file_size?: number;
          recording_start?: string;
          recording_end?: string;
        }>;
      };
    };
  };

  if (payload.event === "endpoint.url_validation" && payload.payload?.plainToken) {
    return NextResponse.json({
      plainToken: payload.payload.plainToken,
      encryptedToken: hashWithSecret(payload.payload.plainToken),
    });
  }

  if (!verifyZoomSignature(request, rawBody)) {
    return NextResponse.json({ error: "Invalid Zoom webhook signature." }, { status: 401 });
  }

  const meetingId = payload.payload?.object?.id ? String(payload.payload.object.id) : null;
  if (!meetingId) {
    return NextResponse.json({ received: true });
  }

  const schedule = await db.classSchedule.findFirst({
    where: {
      OR: [{ meetingId }, { recurringSeriesId: meetingId }],
    },
    include: {
      teacher: { include: { user: true } },
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              parent: { include: { user: true } },
              student: {
                include: {
                  user: true,
                  registrationStudents: {
                    select: {
                      countryCode: true,
                      countryName: true,
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

  if (!schedule) {
    return NextResponse.json({ received: true });
  }

  if (payload.event === "meeting.started") {
    const users = new Map<string, "teacher" | "student" | "parent">();
    users.set(schedule.teacher.user.id, "teacher");
    for (const enrollment of schedule.program.enrollments) {
      users.set(enrollment.student.user.id, "student");
      users.set(enrollment.parent.user.id, "parent");
    }

    await db.notification.createMany({
      data: [...users.entries()].map(([userId, role]) => ({
        userId,
        title: "Live class is now open",
        body: `${schedule.title} has started on Zoom. Open your schedule to join.`,
        href: role === "teacher" ? "/teacher/schedule" : role === "parent" ? "/parent/schedule" : "/student/schedule",
      })),
    });
  }

  if (payload.event === "recording.completed") {
    const recordingFiles = payload.payload?.object?.recording_files?.filter((file) => file.play_url) ?? [];
    if (!recordingFiles.length) {
      return NextResponse.json({ received: true, recordings: 0 });
    }

    for (const file of recordingFiles) {
      const recordingFileId = file.id ?? fallbackRecordingFileId(schedule.id, file.play_url!);
      try {
        await db.liveClassRecording.upsert({
          where: {
            recordingFileId,
          },
          create: {
            scheduleId: schedule.id,
            recordingFileId,
            meetingId,
            topic: payload.payload?.object?.topic ?? schedule.title,
            fileType: file.file_type ?? null,
            playUrl: file.play_url!,
            downloadUrl: file.download_url ?? null,
            recordingStart: file.recording_start ? new Date(file.recording_start) : null,
            recordingEnd: file.recording_end ? new Date(file.recording_end) : null,
            fileSize: typeof file.file_size === "number" ? BigInt(file.file_size) : null,
          },
          update: {
            playUrl: file.play_url!,
            downloadUrl: file.download_url ?? null,
            fileType: file.file_type ?? null,
            recordingStart: file.recording_start ? new Date(file.recording_start) : null,
            recordingEnd: file.recording_end ? new Date(file.recording_end) : null,
            fileSize: typeof file.file_size === "number" ? BigInt(file.file_size) : null,
            deletedAt: null,
          },
        });
      } catch (error) {
        if (isRecordingTableUnavailable(error)) {
          console.error("Live class recordings table is not available yet.", error);
          return NextResponse.json({ received: true, recordings: 0, storage: "pending" });
        }
        throw error;
      }
    }

    const rosterStudentIds = new Set(await getScheduleRosterStudentIds(schedule.id));
    const audienceGroup = getLiveClassAudienceGroup(schedule.title);
    const users = new Map<string, { role: "teacher" | "student" | "parent"; childId?: string }>();
    users.set(schedule.teacher.user.id, { role: "teacher" });
    for (const enrollment of schedule.program.enrollments) {
      if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) continue;
      if (rosterStudentIds.size && !rosterStudentIds.has(enrollment.studentId)) continue;
      users.set(enrollment.student.user.id, { role: "student" });
      users.set(enrollment.parent.user.id, { role: "parent", childId: enrollment.studentId });
    }

    const title = cleanLiveClassTitle(payload.payload?.object?.topic ?? schedule.title);
    await db.notification.createMany({
      data: [...users.entries()].map(([userId, item]) => ({
        userId,
        title: "Class recording ready",
        body: `${title} recording is now available.`,
        href:
          item.role === "teacher"
            ? "/teacher/recordings"
            : item.role === "parent"
              ? `/parent/recordings${item.childId ? `?child=${item.childId}` : ""}`
              : "/student/recordings",
      })),
    });

    return NextResponse.json({ received: true, recordings: recordingFiles.length });
  }

  return NextResponse.json({ received: true });
}
