import "server-only";

import { db } from "@/lib/db";
import { cleanLiveClassTitle } from "@/lib/live-classes/service";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

export type LiveClassRecordingSummary = {
  id: string;
  title: string;
  programTitle: string;
  teacherName: string;
  playUrl: string;
  downloadUrl: string | null;
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
    programTitle: recording.schedule.program.title,
    teacherName: teacherName(recording.schedule.teacher),
    playUrl: recording.playUrl,
    downloadUrl: recording.downloadUrl,
    fileType: recording.fileType,
    recordingStart: recording.recordingStart,
    recordingEnd: recording.recordingEnd,
    availableAt: recording.availableAt,
  };
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
  const rosterIds = recording.schedule.scheduleRosters.map((entry: { studentId: string }) => entry.studentId);
  return !rosterIds.length || rosterIds.includes(studentId);
}

export async function listStudentRecordings(studentUserId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { id: true },
  });
  if (!student) return [];

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

  return recordings.filter((recording) => recordingIsVisibleToStudent(recording, student.id)).map(mapRecording);
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

  return recordings.filter((recording) => recordingIsVisibleToStudent(recording, childId)).map(mapRecording);
}

export async function listTeacherRecordings(teacherUserId: string) {
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

  return recordings.map(mapRecording);
}

export async function listAdminRecordings() {
  const recordings = await db.liveClassRecording.findMany({
    where: { deletedAt: null },
    include: includeRecordingRelations(),
    orderBy: { availableAt: "desc" },
  });

  return recordings.map((recording) => ({
    ...mapRecording(recording),
    scheduleId: recording.scheduleId,
    teacherId: recording.schedule.teacherId,
  }));
}

export async function deleteRecordingForAdmin(recordingId: string) {
  await db.liveClassRecording.update({
    where: { id: recordingId },
    data: { deletedAt: new Date() },
  });
}
