import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { uploadLiveClassRecordingToDrive } from "@/lib/google-drive/materials";
import { recordLiveClassSessionEnd, recordLiveClassSessionFromRecording, recordLiveClassSessionOccurrence } from "@/lib/live-classes/occurrences";
import { notifyRecordingReady } from "@/lib/live-classes/recordings";
import {
  cleanLiveClassTitle,
  enrollmentMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  getScheduleRosterStudentIds,
  isLiveClassVisibleToStudents,
} from "@/lib/live-classes/service";
import { downloadZoomRecording } from "@/lib/zoom/client";

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

function choosePrimaryRecordingFile(
  files: Array<{
    id?: string;
    play_url?: string;
    download_url?: string;
    file_type?: string;
    file_size?: number;
    recording_start?: string;
    recording_end?: string;
  }>,
) {
  const playable = files.filter((file) => {
    const fileType = (file.file_type ?? "").toUpperCase();
    const playUrl = (file.play_url ?? "").toLowerCase();
    if (!file.play_url) return false;
    if (["CHAT", "CC", "TRANSCRIPT", "TIMELINE", "SUMMARY"].includes(fileType)) return false;
    if (playUrl.includes("file_type=chat")) return false;
    return true;
  });

  return (
    playable.find((file) => (file.file_type ?? "").toUpperCase() === "MP4") ??
    playable.find((file) => (file.file_type ?? "").toUpperCase() === "M4A") ??
    playable[0] ??
    null
  );
}

function isRecordingTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "P2021" || code === "P2022" || message.includes("LiveClassRecording");
}

async function hasDriveRecordingColumns() {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LiveClassRecording' AND COLUMN_NAME IN ('driveFileId', 'driveViewUrl', 'driveFolderId', 'storageProvider')",
    );
    return rows.length >= 4;
  } catch {
    return false;
  }
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
        end_time?: string;
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
    await recordLiveClassSessionOccurrence({
      scheduleId: schedule.id,
      meetingId,
      source: "zoom-webhook",
    });

    const users = new Map<string, "teacher" | "student" | "parent">();
    users.set(schedule.teacher.user.id, "teacher");

    if (isLiveClassVisibleToStudents(schedule.title)) {
      const rosterStudentIds = new Set(await getScheduleRosterStudentIds(schedule.id));
      const audienceGroup = getLiveClassAudienceGroup(schedule.title);
      for (const enrollment of schedule.program.enrollments) {
        if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) continue;
        if (rosterStudentIds.size && !rosterStudentIds.has(enrollment.studentId)) continue;
        users.set(enrollment.student.user.id, "student");
        users.set(enrollment.parent.user.id, "parent");
      }
    }

    const title = cleanLiveClassTitle(schedule.title);
    await db.notification.createMany({
      data: [...users.entries()].map(([userId, role]) => ({
        userId,
        title: "Live class is now open",
        body: `${title} has started on Zoom. Open your schedule to join.`,
        href: role === "teacher" ? "/teacher/schedule" : role === "parent" ? "/parent/schedule" : "/student/schedule",
      })),
    });
  }

  if (payload.event === "meeting.ended") {
    await recordLiveClassSessionEnd({
      scheduleId: schedule.id,
      meetingId,
      endedAt: payload.payload?.object?.end_time ? new Date(payload.payload.object.end_time) : new Date(),
    });

    return NextResponse.json({ received: true });
  }

  if (payload.event === "recording.completed") {
    const primaryFile = choosePrimaryRecordingFile(payload.payload?.object?.recording_files ?? []);
    if (!primaryFile) {
      return NextResponse.json({ received: true, recordings: 0 });
    }
    const driveColumnsAvailable = await hasDriveRecordingColumns();

    for (const file of [primaryFile]) {
      const recordingFileId = file.id ?? fallbackRecordingFileId(schedule.id, file.play_url!);
      const recordingStart = file.recording_start ? new Date(file.recording_start) : null;
      const recordingEnd = file.recording_end ? new Date(file.recording_end) : null;
      if (recordingStart && recordingEnd) {
        await recordLiveClassSessionEnd({
          scheduleId: schedule.id,
          meetingId,
          startedAt: recordingStart,
          endedAt: recordingEnd,
        });
        await recordLiveClassSessionFromRecording({
          scheduleId: schedule.id,
          teacherUserId: schedule.teacher.user.id,
          meetingId,
          recordingStart,
          recordingEnd,
        });
      }
      let driveRecording: { id: string; webViewLink: string | null; folderId: string } | null = null;
      if (driveColumnsAvailable && file.download_url) {
        try {
          const downloaded = await downloadZoomRecording(file.download_url);
          driveRecording = await uploadLiveClassRecordingToDrive({
            programId: schedule.program.id,
            teacherUserId: schedule.teacher.user.id,
            scheduleId: schedule.id,
            recordingFileId,
            title: cleanLiveClassTitle(payload.payload?.object?.topic ?? schedule.title),
            buffer: downloaded.buffer,
            mimeType: downloaded.mimeType,
            fileType: file.file_type ?? null,
            recordingStart,
          });
        } catch (error) {
          console.error("Unable to copy Zoom recording to Google Drive.", error);
        }
      }
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
            playUrl: driveRecording?.webViewLink ?? file.play_url!,
            downloadUrl: file.download_url ?? null,
            ...(driveColumnsAvailable
              ? {
                  driveFileId: driveRecording?.id ?? null,
                  driveViewUrl: driveRecording?.webViewLink ?? null,
                  driveFolderId: driveRecording?.folderId ?? null,
                  storageProvider: driveRecording ? "google-drive" : "zoom",
                }
              : {}),
            recordingStart,
            recordingEnd,
            fileSize: typeof file.file_size === "number" ? BigInt(file.file_size) : null,
          },
          update: {
            playUrl: driveRecording?.webViewLink ?? file.play_url!,
            downloadUrl: file.download_url ?? null,
            ...(driveColumnsAvailable
              ? {
                  driveFileId: driveRecording?.id ?? undefined,
                  driveViewUrl: driveRecording?.webViewLink ?? undefined,
                  driveFolderId: driveRecording?.folderId ?? undefined,
                  storageProvider: driveRecording ? "google-drive" : "zoom",
                }
              : {}),
            fileType: file.file_type ?? null,
            recordingStart,
            recordingEnd,
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

    const savedRecording = await db.liveClassRecording.findUnique({
      where: { recordingFileId: primaryFile.id ?? fallbackRecordingFileId(schedule.id, primaryFile.play_url!) },
      select: { id: true, driveFileId: true },
    });
    if (savedRecording?.driveFileId) {
      await notifyRecordingReady(savedRecording.id);
    } else {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const title = cleanLiveClassTitle(payload.payload?.object?.topic ?? schedule.title);
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: "Recording needs Drive preparation",
          body: `${title} is available from Zoom but still needs to be copied to Google Drive.`,
          href: "/admin/recordings",
        })),
      });
    }

    return NextResponse.json({ received: true, recordings: 1 });
  }

  return NextResponse.json({ received: true });
}
