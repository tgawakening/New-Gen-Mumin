import "server-only";

import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { getDriveRecordingPlaybackStatus, startLiveClassRecordingResumableUpload, uploadLiveClassRecordingResumableChunk } from "@/lib/google-drive/materials";
import {
  cleanLiveClassTitle,
  enrollmentMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  getScheduleRosterStudentIds,
  isLiveClassVisibleToStudents,
} from "@/lib/live-classes/service";
import { downloadZoomRecordingRange, findZoomRecordingDownloadUrl, getZoomUserRecordings } from "@/lib/zoom/client";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const RECORDING_PROCESSING_PROVIDER = "processing";
const RECORDING_DRIVE_PROCESSING_PROVIDER = "drive-processing";
const RECORDING_PROCESSING_STALE_MS = 45 * 60 * 1000;
const RECORDING_CHUNK_BYTES = 32 * 1024 * 1024;
const RECORDING_DRIVE_PROCESSING_CHECK_LIMIT = 8;
const RECORDING_CHUNK_ACTIVE_GRACE_MS = 90 * 1000;

export type LiveClassRecordingSummary = {
  id: string;
  title: string;
  programTitle: string;
  teacherName: string;
  watchUrl: string | null;
  playbackUrl: string | null;
  isReadyForPlayback: boolean;
  processingStatus: "ready" | "processing" | "drive-processing" | "failed" | "pending";
  processingStatusLabel: string;
  processingError: string | null;
  processingProgressLabel: string | null;
  storageProvider: string | null;
  fileType: string | null;
  recordingStart: Date | null;
  recordingEnd: Date | null;
  availableAt: Date;
};

function teacherName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function shortErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown recording import error.");
  return raw.replace(/\s+/g, " ").trim().slice(0, 160) || "Unknown recording import error.";
}

function failedStorageProvider(error: unknown) {
  return `failed:${shortErrorMessage(error)}`.slice(0, 190);
}

function recordingProcessingState(recording: { driveFileId?: string | null; storageProvider?: string | null }) {
  const provider = recording.storageProvider ?? "";

  if (recording.driveFileId && provider === "google-drive") {
    return {
      processingStatus: "ready" as const,
      processingStatusLabel: "Ready",
      processingError: null,
    };
  }

  if (recording.driveFileId && provider === RECORDING_DRIVE_PROCESSING_PROVIDER) {
    return {
      processingStatus: "drive-processing" as const,
      processingStatusLabel: "Drive processing",
      processingError: null,
    };
  }

  if (provider === RECORDING_PROCESSING_PROVIDER) {
    return {
      processingStatus: "processing" as const,
      processingStatusLabel: "Processing now",
      processingError: null,
    };
  }

  if (provider.startsWith("failed:")) {
    return {
      processingStatus: "failed" as const,
      processingStatusLabel: "Failed, retry",
      processingError: provider.slice("failed:".length) || "Recording import failed.",
    };
  }

  return {
    processingStatus: "pending" as const,
    processingStatusLabel: "Pending",
    processingError: null,
  };
}

function mapRecording(recording: any): LiveClassRecordingSummary {
  const processingState = recordingProcessingState(recording);
  return {
    id: recording.id,
    title: cleanLiveClassTitle(recording.topic || recording.schedule.title),
    programTitle: displayProgramTitle(recording.schedule.program.title),
    teacherName: teacherName(recording.schedule.teacher),
    watchUrl: recording.driveViewUrl || recording.downloadUrl ? `/recordings/${recording.id}/watch` : null,
    playbackUrl: recording.driveFileId && recording.storageProvider === "google-drive" ? `/api/recordings/${recording.id}/media` : null,
    isReadyForPlayback: Boolean(recording.driveFileId && recording.storageProvider === "google-drive"),
    ...processingState,
    processingProgressLabel: recording.driveUploadTotal
      ? `${Math.min(99, Math.round((Number(recording.driveUploadOffset ?? BigInt(0)) / Number(recording.driveUploadTotal)) * 100))}% uploaded`
      : null,
    storageProvider: recording.storageProvider ?? null,
    fileType: recording.fileType,
    recordingStart: recording.recordingStart,
    recordingEnd: recording.recordingEnd,
    availableAt: recording.availableAt,
  };
}

function isPlayableVideoRecording(recording: { fileType?: string | null; topic?: string | null; playUrl?: string | null }) {
  const fileType = (recording.fileType ?? "").toUpperCase();
  const topic = (recording.topic ?? "").toLowerCase();
  const playUrl = (recording.playUrl ?? "").toLowerCase();

  if (["CHAT", "CC", "TRANSCRIPT", "TIMELINE", "SUMMARY"].includes(fileType)) return false;
  if (topic.includes("chat file") || playUrl.includes("file_type=chat")) return false;
  if (fileType && !["MP4", "M4A"].includes(fileType)) return false;

  return true;
}

function choosePrimaryZoomRecordingFile(files: Array<{
  id?: string;
  play_url?: string;
  download_url?: string;
  file_type?: string;
  file_size?: number;
  recording_start?: string;
  recording_end?: string;
}>) {
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

function fallbackZoomRecordingFileId(scheduleId: string, playUrl: string) {
  return `${scheduleId}-${Buffer.from(playUrl).toString("base64url").slice(0, 32)}`;
}

function collapseRecordingsBySession(recordings: any[]) {
  const visible = recordings.filter(isPlayableVideoRecording);
  const grouped = new Map<string, any>();

  for (const recording of visible) {
    const key = [
      recording.scheduleId,
      recording.recordingStart ? recording.recordingStart.toISOString().slice(0, 10) : recording.availableAt.toISOString().slice(0, 10),
    ].join("|");
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, recording);
      continue;
    }

    const currentType = (recording.fileType ?? "").toUpperCase();
    const existingType = (existing.fileType ?? "").toUpperCase();
    if (currentType === "MP4" && existingType !== "MP4") {
      grouped.set(key, recording);
    }
  }

  return [...grouped.values()];
}

function includeRecordingRelations() {
  return {
    schedule: {
      include: {
        program: true,
        teacher: {
          include: {
            user: true,
          },
        },
        scheduleRosters: {
          select: {
            studentId: true,
          },
        },
      },
    },
  } as const;
}

function isDriveResumableUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Google Drive resumable upload failed");
}

async function repairUploadedRecordingStates() {
  const recordings = await db.liveClassRecording.findMany({
    where: {
      deletedAt: null,
      driveFileId: { not: null },
      storageProvider: {
        in: ["zoom", RECORDING_PROCESSING_PROVIDER],
      },
    },
    select: { id: true },
  });
  if (!recordings.length) return [];

  await db.liveClassRecording.updateMany({
    where: {
      deletedAt: null,
      driveFileId: { not: null },
      storageProvider: {
        in: ["zoom", RECORDING_PROCESSING_PROVIDER],
      },
    },
    data: {
      storageProvider: "google-drive",
      driveUploadSessionUrl: null,
      driveUploadUpdatedAt: new Date(),
    },
  });
  return recordings.map((recording) => recording.id);
}

function recordingIsVisibleToStudent(recording: any, studentId: string) {
  if (!isLiveClassVisibleToStudents(recording.schedule.title)) return false;
  const rosterIds = recording.schedule.scheduleRosters.map((entry: { studentId: string }) => entry.studentId);
  return !rosterIds.length || rosterIds.includes(studentId);
}

function isRecordingTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "P2021" || code === "P2022" || message.includes("LiveClassRecording");
}

export async function listStudentRecordings(studentUserId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { id: true },
  });
  if (!student) return [];

  try {
    const recordings = await db.liveClassRecording.findMany({
      where: {
        deletedAt: null,
        schedule: {
          program: {
            enrollments: {
              some: {
                studentId: student.id,
                status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
              },
            },
          },
        },
      },
      include: includeRecordingRelations(),
      orderBy: { availableAt: "desc" },
    });

    return collapseRecordingsBySession(
      recordings.filter((recording) => recording.driveFileId && recording.storageProvider === "google-drive" && recordingIsVisibleToStudent(recording, student.id)),
    ).map(mapRecording);
  } catch (error) {
    if (isRecordingTableUnavailable(error)) {
      console.error("Live class recordings table is not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function listParentChildRecordings(parentUserId: string, childId: string) {
  const relation = await db.parentStudent.findFirst({
    where: {
      studentId: childId,
      parent: { userId: parentUserId },
    },
    select: { studentId: true },
  });
  if (!relation) return [];

  try {
    const recordings = await db.liveClassRecording.findMany({
      where: {
        deletedAt: null,
        schedule: {
          program: {
            enrollments: {
              some: {
                studentId: childId,
                status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
              },
            },
          },
        },
      },
      include: includeRecordingRelations(),
      orderBy: { availableAt: "desc" },
    });

    return collapseRecordingsBySession(
      recordings.filter((recording) => recording.driveFileId && recording.storageProvider === "google-drive" && recordingIsVisibleToStudent(recording, childId)),
    ).map(mapRecording);
  } catch (error) {
    if (isRecordingTableUnavailable(error)) {
      console.error("Live class recordings table is not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function listTeacherRecordings(teacherUserId: string) {
  try {
    const recordings = await db.liveClassRecording.findMany({
      where: {
        deletedAt: null,
        schedule: {
          teacher: { userId: teacherUserId },
        },
      },
      include: includeRecordingRelations(),
      orderBy: { availableAt: "desc" },
    });

    return collapseRecordingsBySession(recordings.filter((recording) => recording.driveFileId && recording.storageProvider === "google-drive")).map(mapRecording);
  } catch (error) {
    if (isRecordingTableUnavailable(error)) {
      console.error("Live class recordings table is not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function listAdminRecordings() {
  try {
    const recordings = await db.liveClassRecording.findMany({
      where: { deletedAt: null },
      include: includeRecordingRelations(),
      orderBy: { availableAt: "desc" },
    });

    return collapseRecordingsBySession(recordings).map((recording) => ({
      ...mapRecording(recording),
      scheduleId: recording.scheduleId,
      teacherId: recording.schedule.teacherId,
    }));
  } catch (error) {
    if (isRecordingTableUnavailable(error)) {
      console.error("Live class recordings table is not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function deleteRecordingForAdmin(recordingId: string) {
  try {
    await db.liveClassRecording.update({
      where: { id: recordingId },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    if (isRecordingTableUnavailable(error)) {
      throw new Error("Recordings storage is still being prepared. Please apply the database migration first.");
    }
    throw error;
  }
}

export async function userCanAccessRecording(recordingId: string, user: { id: string; role: string }) {
  const recording = await db.liveClassRecording.findFirst({
    where: { id: recordingId, deletedAt: null },
    include: includeRecordingRelations(),
  });
  if (!recording) return null;

  if (user.role === "ADMIN") return recording;
  if (user.role === "TEACHER" && recording.schedule.teacher.user.id === user.id) return recording;
  if (!isLiveClassVisibleToStudents(recording.schedule.title)) return null;
  if (user.role === "STUDENT") {
    const student = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (student && recordingIsVisibleToStudent(recording, student.id)) {
      const enrollment = await db.enrollment.findFirst({
        where: {
          studentId: student.id,
          programId: recording.schedule.programId,
          status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
        },
        select: { id: true },
      });
      if (enrollment) return recording;
    }
  }
  if (user.role === "PARENT") {
    const childIds = await db.parentStudent.findMany({
      where: { parent: { userId: user.id } },
      select: { studentId: true },
    });
    for (const child of childIds) {
      if (!recordingIsVisibleToStudent(recording, child.studentId)) continue;
      const enrollment = await db.enrollment.findFirst({
        where: {
          studentId: child.studentId,
          programId: recording.schedule.programId,
          status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
        },
        select: { id: true },
      });
      if (enrollment) return recording;
    }
  }

  return null;
}

async function claimRecordingForDriveImport(recordingId: string) {
  const staleBefore = new Date(Date.now() - RECORDING_PROCESSING_STALE_MS);
  const activeImport = await db.liveClassRecording.findFirst({
    where: {
      id: { not: recordingId },
      deletedAt: null,
      driveFileId: null,
      storageProvider: RECORDING_PROCESSING_PROVIDER,
      updatedAt: { gte: staleBefore },
    },
    select: { id: true },
  });

  if (activeImport) return false;

  const result = await db.liveClassRecording.updateMany({
    where: {
      id: recordingId,
      driveFileId: null,
      OR: [
        { storageProvider: { not: RECORDING_PROCESSING_PROVIDER } },
        { updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      storageProvider: RECORDING_PROCESSING_PROVIDER,
    },
  });

  return result.count > 0;
}

async function releaseRecordingImportClaim(recordingId: string, error: unknown) {
  await db.liveClassRecording.updateMany({
    where: {
      id: recordingId,
      driveFileId: null,
      storageProvider: RECORDING_PROCESSING_PROVIDER,
    },
    data: {
      storageProvider: failedStorageProvider(error),
    },
  });
}

async function resetInterruptedRecordingImports() {
  const result = await db.liveClassRecording.updateMany({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: RECORDING_PROCESSING_PROVIDER,
    },
    data: {
      storageProvider: "zoom",
    },
  });

  return result.count;
}

async function importRecordingToDrive(recording: NonNullable<Awaited<ReturnType<typeof userCanAccessRecording>>>, options: { claimed?: boolean } = {}) {
  if (recording.driveViewUrl) return recording.driveViewUrl;
  if (!recording.downloadUrl) {
    throw new Error("This recording is still being prepared for Google Drive viewing.");
  }
  if (!options.claimed) {
    const claimed = await claimRecordingForDriveImport(recording.id);
    if (!claimed) {
      throw new Error("This recording is already being prepared. Please refresh after a minute.");
    }
  }

  try {
    let downloadUrl = recording.downloadUrl;
    const title = cleanLiveClassTitle(recording.topic || recording.schedule.title);
    const offset = Number(recording.driveUploadOffset ?? BigInt(0));
    console.info(`[recording-import] Zoom chunk download starting for ${recording.id}: ${title} at byte ${offset}`);
    let downloaded: Awaited<ReturnType<typeof downloadZoomRecordingRange>>;
    try {
      downloaded = await downloadZoomRecordingRange(downloadUrl, offset, RECORDING_CHUNK_BYTES);
    } catch (directDownloadError) {
      if (!recording.meetingId) throw directDownloadError;

      const freshDownloadUrl = await findZoomRecordingDownloadUrl({
        meetingId: recording.meetingId,
        recordingFileId: recording.recordingFileId,
        recordingStart: recording.recordingStart,
        fileType: recording.fileType,
      });
      if (!freshDownloadUrl) throw directDownloadError;

      downloadUrl = freshDownloadUrl;
      downloaded = await downloadZoomRecordingRange(downloadUrl, offset, RECORDING_CHUNK_BYTES);
    }
    console.info(`[recording-import] Zoom chunk download complete for ${recording.id}: ${title} bytes ${downloaded.start}-${downloaded.end}/${downloaded.total}`);
    const totalBytes = recording.fileSize ? Number(recording.fileSize) : downloaded.total;
    if (!recording.fileSize && downloaded.total <= downloaded.end + 1 && downloaded.buffer.length >= RECORDING_CHUNK_BYTES) {
      throw new Error("Zoom did not provide a reliable total recording size. Sync from Zoom again before importing this recording.");
    }
    if (!Number.isFinite(totalBytes) || totalBytes <= downloaded.end) {
      throw new Error("Recording total file size is not available yet. Please sync from Zoom again or retry after Zoom finishes processing.");
    }

    let sessionUrl = recording.driveUploadSessionUrl;
    let folderId = recording.driveFolderId;
    let fileName = recording.driveUploadFileName;
    if (!sessionUrl || offset === 0) {
      const session = await startLiveClassRecordingResumableUpload({
        programId: recording.schedule.programId,
        teacherUserId: recording.schedule.teacher.user.id,
        scheduleId: recording.scheduleId,
        recordingFileId: recording.recordingFileId ?? recording.id,
        title,
        mimeType: downloaded.mimeType,
        fileType: recording.fileType,
        recordingStart: recording.recordingStart,
        totalBytes,
      });
      sessionUrl = session.sessionUrl;
      folderId = session.folderId;
      fileName = session.fileName;
    }

    console.info(`[recording-import] Google Drive chunk upload starting for ${recording.id}: ${title} bytes ${downloaded.start}-${downloaded.end}`);
    const driveUpload = await uploadLiveClassRecordingResumableChunk({
      sessionUrl,
      buffer: downloaded.buffer,
      start: downloaded.start,
      end: downloaded.end,
      totalBytes,
    });
    console.info(`[recording-import] Google Drive chunk upload complete for ${recording.id}: ${title} next byte ${driveUpload.nextOffset}`);

    if (!driveUpload.complete) {
      await db.liveClassRecording.update({
        where: { id: recording.id },
        data: {
          driveFolderId: folderId,
          driveUploadSessionUrl: sessionUrl,
          driveUploadOffset: BigInt(driveUpload.nextOffset),
          driveUploadTotal: BigInt(totalBytes),
          driveUploadUpdatedAt: new Date(),
          driveUploadFileName: fileName,
          storageProvider: RECORDING_PROCESSING_PROVIDER,
          downloadUrl,
        },
      });
      throw new Error(`Recording upload is ${Math.round((driveUpload.nextOffset / totalBytes) * 100)}% complete. Cron will continue it on the next run.`);
    }

    await db.liveClassRecording.update({
      where: { id: recording.id },
      data: {
        playUrl: driveUpload.file.webViewLink ?? recording.playUrl,
        driveFileId: driveUpload.file.id,
        driveViewUrl: driveUpload.file.webViewLink,
        driveFolderId: folderId,
        driveUploadSessionUrl: null,
        driveUploadOffset: BigInt(totalBytes),
        driveUploadTotal: BigInt(totalBytes),
        driveUploadUpdatedAt: new Date(),
        driveUploadFileName: fileName,
        storageProvider: "google-drive",
        downloadUrl,
      },
    });

    if (!driveUpload.file.webViewLink) {
      throw new Error("Google Drive did not return a viewing link for this recording.");
    }

    return driveUpload.file.webViewLink;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cron will continue it on the next run")) {
      throw error;
    }
    if (isDriveResumableUploadError(error) && recording.driveUploadSessionUrl) {
      await db.liveClassRecording.update({
        where: { id: recording.id },
        data: {
          driveUploadSessionUrl: null,
          driveUploadOffset: BigInt(0),
          driveUploadTotal: null,
          driveUploadUpdatedAt: new Date(),
          storageProvider: "zoom",
        },
      });
      throw new Error("Google Drive upload session expired. Recording import was reset and will restart on the next cron run.");
    }
    await releaseRecordingImportClaim(recording.id, error);
    throw error;
  }
}

export async function ensureRecordingDriveViewUrl(recordingId: string, user: { id: string; role: string }) {
  const recording = await userCanAccessRecording(recordingId, user);
  if (!recording) {
    throw new Error("Recording not found or you do not have access.");
  }

  const viewUrl = await importRecordingToDrive(recording);
  await notifyRecordingReady(recording.id);
  return viewUrl;
}

export async function processPendingDriveRecordings(limit = 1) {
  const repairedRecordingIds = await repairUploadedRecordingStates();
  for (const recordingId of repairedRecordingIds) {
    await notifyRecordingReady(recordingId);
  }

  const driveProcessing = await db.liveClassRecording.findMany({
    where: {
      deletedAt: null,
      driveFileId: { not: null },
      storageProvider: RECORDING_DRIVE_PROCESSING_PROVIDER,
    },
    include: includeRecordingRelations(),
    orderBy: { updatedAt: "asc" },
    take: RECORDING_DRIVE_PROCESSING_CHECK_LIMIT,
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const recording of driveProcessing) {
    try {
      const playback = await getDriveRecordingPlaybackStatus(recording.driveFileId!).catch(() => null);

      await db.liveClassRecording.update({
        where: { id: recording.id },
        data: {
          driveViewUrl: playback?.webViewLink ?? recording.driveViewUrl,
          playUrl: playback?.webViewLink ?? recording.playUrl,
          storageProvider: "google-drive",
        },
      });
      await notifyRecordingReady(recording.id);
      results.push({ id: recording.id, ok: true });
      console.info(`[recording-import] Drive playback ready for dashboards: ${recording.id}`);
    } catch (error) {
      results.push({ id: recording.id, ok: false, error: error instanceof Error ? error.message : "Unknown Drive processing error" });
    }
  }

  const staleBefore = new Date(Date.now() - RECORDING_PROCESSING_STALE_MS);
  await db.liveClassRecording.updateMany({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: RECORDING_PROCESSING_PROVIDER,
      updatedAt: { lt: staleBefore },
    },
    data: {
      storageProvider: "zoom",
    },
  });

  let recordings = await db.liveClassRecording.findMany({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: RECORDING_PROCESSING_PROVIDER,
      updatedAt: { gte: staleBefore },
    },
    include: includeRecordingRelations(),
    orderBy: { updatedAt: "asc" },
    take: 2,
  });

  if (recordings.length > 1) {
    await resetInterruptedRecordingImports();
    recordings = [];
  } else if (recordings.length === 1 && recordings[0].updatedAt > new Date(Date.now() - RECORDING_CHUNK_ACTIVE_GRACE_MS)) {
    return [];
  }

  if (!recordings.length) {
    recordings = await db.liveClassRecording.findMany({
      where: {
        deletedAt: null,
        driveFileId: null,
        downloadUrl: { not: null },
        OR: [
          { storageProvider: { not: RECORDING_PROCESSING_PROVIDER } },
          { updatedAt: { lt: staleBefore } },
        ],
      },
      include: includeRecordingRelations(),
      orderBy: { availableAt: "desc" },
      take: Math.min(Math.max(limit, 1), 1),
    });
  }

  for (const recording of recordings) {
    try {
      const alreadyProcessing = recording.storageProvider === RECORDING_PROCESSING_PROVIDER;
      if (!alreadyProcessing) {
        const claimed = await claimRecordingForDriveImport(recording.id);
        if (!claimed) {
          results.push({ id: recording.id, ok: false, error: "Already being prepared." });
          continue;
        }
      }
      await importRecordingToDrive(recording, { claimed: true });
      await notifyRecordingReady(recording.id);
      results.push({ id: recording.id, ok: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Cron will continue it on the next run")) {
        console.info(`[recording-import] ${error.message}`);
        results.push({ id: recording.id, ok: true });
        continue;
      }
      console.error("Unable to process pending recording.", error);
      results.push({
        id: recording.id,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export function startPendingDriveRecordingsProcessing(limit = 1) {
  console.info(`[recording-import] Background pending processing requested. Limit: ${limit}`);
  void processPendingDriveRecordings(limit).catch((error) => {
    console.error("Background pending recording processing failed.", error);
  });
}

export function startRecordingDriveViewUrlPreparation(recordingId: string, user: { id: string; role: string }) {
  console.info(`[recording-import] Background preparation requested for recording ${recordingId} by ${user.role}.`);
  void ensureRecordingDriveViewUrl(recordingId, user).catch((error) => {
    console.error("Background recording preparation failed.", error);
  });
}

export async function getRecordingProcessingQueueStatus() {
  const staleBefore = new Date(Date.now() - RECORDING_PROCESSING_STALE_MS);
  const [processing, pending, failed, ready, driveProcessing] = await Promise.all([
    db.liveClassRecording.findMany({
      where: {
        deletedAt: null,
        driveFileId: null,
        storageProvider: RECORDING_PROCESSING_PROVIDER,
      },
      include: includeRecordingRelations(),
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    db.liveClassRecording.count({
      where: {
        deletedAt: null,
        driveFileId: null,
        downloadUrl: { not: null },
        OR: [
          { storageProvider: "zoom" },
          { storageProvider: { startsWith: "failed:" } },
          { storageProvider: RECORDING_PROCESSING_PROVIDER, updatedAt: { lt: staleBefore } },
        ],
      },
    }),
    db.liveClassRecording.count({
      where: {
        deletedAt: null,
        driveFileId: null,
        storageProvider: { startsWith: "failed:" },
      },
    }),
    db.liveClassRecording.count({
      where: {
        deletedAt: null,
        driveFileId: { not: null },
        storageProvider: "google-drive",
      },
    }),
    db.liveClassRecording.count({
      where: {
        deletedAt: null,
        driveFileId: { not: null },
        storageProvider: RECORDING_DRIVE_PROCESSING_PROVIDER,
      },
    }),
  ]);

  return {
    processing: processing.map((recording) => ({
      id: recording.id,
      title: cleanLiveClassTitle(recording.topic || recording.schedule.title),
      teacher: teacherName(recording.schedule.teacher),
      updatedAt: recording.updatedAt,
      minutesSinceUpdate: Math.max(0, Math.round((Date.now() - recording.updatedAt.getTime()) / 60000)),
      uploadedBytes: Number(recording.driveUploadOffset ?? BigInt(0)),
      totalBytes: recording.driveUploadTotal ? Number(recording.driveUploadTotal) : null,
      progressPercent: recording.driveUploadTotal
        ? Math.min(99, Math.round((Number(recording.driveUploadOffset ?? BigInt(0)) / Number(recording.driveUploadTotal)) * 100))
        : null,
      stale: recording.updatedAt < staleBefore,
    })),
    pending,
    failed,
    ready,
    driveProcessing,
  };
}

export async function syncRecentZoomRecordingsForAdmin() {
  const zoomRecordings = await getZoomUserRecordings();
  let imported = 0;
  let skipped = 0;

  for (const meeting of zoomRecordings.meetings ?? []) {
    const meetingCandidates = [meeting.id, meeting.uuid].map((value) => (value ? String(value) : null)).filter((value): value is string => Boolean(value));
    if (!meetingCandidates.length) {
      skipped += 1;
      continue;
    }

    const schedule = await db.classSchedule.findFirst({
      where: {
        OR: [
          { meetingId: { in: meetingCandidates } },
          { recurringSeriesId: { in: meetingCandidates } },
        ],
      },
      select: {
        id: true,
        title: true,
        meetingId: true,
      },
    });
    if (!schedule) {
      skipped += 1;
      continue;
    }

    const primaryFile = choosePrimaryZoomRecordingFile(meeting.recording_files ?? []);
    if (!primaryFile?.play_url) {
      skipped += 1;
      continue;
    }

    const recordingFileId = primaryFile.id ?? fallbackZoomRecordingFileId(schedule.id, primaryFile.play_url);
    const recordingStart = primaryFile.recording_start ? new Date(primaryFile.recording_start) : null;
    const recordingEnd = primaryFile.recording_end ? new Date(primaryFile.recording_end) : null;
    const existingRecording = await db.liveClassRecording.findUnique({
      where: { recordingFileId },
      select: { driveFileId: true, storageProvider: true },
    });
    const shouldPreserveDriveState = Boolean(existingRecording?.driveFileId);

    await db.liveClassRecording.upsert({
      where: { recordingFileId },
      create: {
        scheduleId: schedule.id,
        recordingFileId,
        meetingId: meetingCandidates[0],
        topic: meeting.topic ?? schedule.title,
        fileType: primaryFile.file_type ?? null,
        playUrl: primaryFile.play_url,
        downloadUrl: primaryFile.download_url ?? null,
        storageProvider: "zoom",
        recordingStart,
        recordingEnd,
        fileSize: typeof primaryFile.file_size === "number" ? BigInt(primaryFile.file_size) : null,
      },
      update: {
        playUrl: shouldPreserveDriveState ? undefined : primaryFile.play_url,
        downloadUrl: primaryFile.download_url ?? null,
        storageProvider: shouldPreserveDriveState ? existingRecording?.storageProvider ?? "google-drive" : "zoom",
        fileType: primaryFile.file_type ?? null,
        recordingStart,
        recordingEnd,
        fileSize: typeof primaryFile.file_size === "number" ? BigInt(primaryFile.file_size) : null,
        deletedAt: null,
      },
    });
    imported += 1;
  }

  return { imported, skipped };
}

export async function resetPendingRecordingImportsForAdmin() {
  return resetInterruptedRecordingImports();
}

export async function notifyRecordingReady(recordingId: string) {
  const recording = await db.liveClassRecording.findFirst({
    where: { id: recordingId, deletedAt: null, driveFileId: { not: null }, storageProvider: "google-drive" },
    include: {
      schedule: {
        include: {
          teacher: { include: { user: true } },
          program: {
            include: {
              enrollments: {
                where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
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
      },
    },
  });
  if (!recording) return;

  const users = new Map<string, { role: "teacher" | "student" | "parent"; childId?: string }>();
  users.set(recording.schedule.teacher.user.id, { role: "teacher" });

  if (isLiveClassVisibleToStudents(recording.schedule.title)) {
    const rosterStudentIds = new Set(await getScheduleRosterStudentIds(recording.scheduleId));
    const audienceGroup = getLiveClassAudienceGroup(recording.schedule.title);
    for (const enrollment of recording.schedule.program.enrollments) {
      if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) continue;
      if (rosterStudentIds.size && !rosterStudentIds.has(enrollment.studentId)) continue;
      users.set(enrollment.student.user.id, { role: "student" });
      users.set(enrollment.parent.user.id, { role: "parent", childId: enrollment.studentId });
    }
  }

  const title = cleanLiveClassTitle(recording.topic || recording.schedule.title);
  for (const [userId, item] of users.entries()) {
    const href =
      item.role === "teacher"
        ? "/teacher/recordings"
        : item.role === "parent"
          ? `/parent/recordings${item.childId ? `?child=${item.childId}` : ""}`
          : "/student/recordings";

    const existing = await db.notification.findFirst({
      where: {
        userId,
        title: "Class recording ready",
        href,
        body: `${title} recording is now available.`,
      },
    });
    if (existing) continue;

    await db.notification.create({
      data: {
        userId,
        title: "Class recording ready",
        body: `${title} recording is now available.`,
        href,
      },
    });
  }
}

export async function getRecordingPlaybackDetails(recordingId: string, user: { id: string; role: string }) {
  const recording = await userCanAccessRecording(recordingId, user);
  if (!recording) {
    throw new Error("Recording not found or you do not have access.");
  }

  return {
    id: recording.id,
    title: cleanLiveClassTitle(recording.topic || recording.schedule.title),
    programTitle: displayProgramTitle(recording.schedule.program.title),
    teacherName: teacherName(recording.schedule.teacher),
    recordingStart: recording.recordingStart,
    availableAt: recording.availableAt,
    driveViewUrl: recording.driveViewUrl,
    driveFileId: recording.driveFileId,
    isReadyForPlayback: Boolean(recording.driveFileId && recording.storageProvider === "google-drive"),
    fileType: recording.fileType,
  };
}
