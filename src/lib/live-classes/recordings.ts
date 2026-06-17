import "server-only";

import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { uploadLiveClassRecordingToDrive } from "@/lib/google-drive/materials";
import { cleanLiveClassTitle, isLiveClassVisibleToStudents } from "@/lib/live-classes/service";
import { downloadZoomRecording, findZoomRecordingDownloadUrl } from "@/lib/zoom/client";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

export type LiveClassRecordingSummary = {
  id: string;
  title: string;
  programTitle: string;
  teacherName: string;
  watchUrl: string | null;
  storageProvider: string | null;
  fileType: string | null;
  recordingStart: Date | null;
  recordingEnd: Date | null;
  availableAt: Date;
};

function teacherName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function mapRecording(recording: any): LiveClassRecordingSummary {
  return {
    id: recording.id,
    title: cleanLiveClassTitle(recording.topic || recording.schedule.title),
    programTitle: displayProgramTitle(recording.schedule.program.title),
    teacherName: teacherName(recording.schedule.teacher),
    watchUrl: recording.driveViewUrl ? `/api/recordings/${recording.id}/watch` : recording.downloadUrl ? `/api/recordings/${recording.id}/watch` : null,
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

    return collapseRecordingsBySession(recordings.filter((recording) => recordingIsVisibleToStudent(recording, student.id))).map(mapRecording);
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

    return collapseRecordingsBySession(recordings.filter((recording) => recordingIsVisibleToStudent(recording, childId))).map(mapRecording);
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

    return collapseRecordingsBySession(recordings).map(mapRecording);
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

export async function ensureRecordingDriveViewUrl(recordingId: string, user: { id: string; role: string }) {
  const recording = await userCanAccessRecording(recordingId, user);
  if (!recording) {
    throw new Error("Recording not found or you do not have access.");
  }
  if (recording.driveViewUrl) return recording.driveViewUrl;
  if (!recording.downloadUrl) {
    throw new Error("This recording is still being prepared for Google Drive viewing.");
  }

  let downloadUrl = recording.downloadUrl;
  let downloaded: Awaited<ReturnType<typeof downloadZoomRecording>>;
  try {
    downloaded = await downloadZoomRecording(downloadUrl);
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
    downloaded = await downloadZoomRecording(downloadUrl);
  }

  const driveRecording = await uploadLiveClassRecordingToDrive({
    programId: recording.schedule.programId,
    teacherUserId: recording.schedule.teacher.user.id,
    scheduleId: recording.scheduleId,
    recordingFileId: recording.recordingFileId ?? recording.id,
    title: cleanLiveClassTitle(recording.topic || recording.schedule.title),
    buffer: downloaded.buffer,
    mimeType: downloaded.mimeType,
    fileType: recording.fileType,
    recordingStart: recording.recordingStart,
  });

  await db.liveClassRecording.update({
    where: { id: recording.id },
    data: {
      playUrl: driveRecording.webViewLink ?? recording.playUrl,
      driveFileId: driveRecording.id,
      driveViewUrl: driveRecording.webViewLink,
      driveFolderId: driveRecording.folderId,
      storageProvider: "google-drive",
      downloadUrl,
    },
  });

  if (!driveRecording.webViewLink) {
    throw new Error("Google Drive did not return a viewing link for this recording.");
  }

  return driveRecording.webViewLink;
}
