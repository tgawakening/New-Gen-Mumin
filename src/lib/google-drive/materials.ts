import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { driveRequest, driveUpload, getDriveRootFolderId } from "@/lib/google-drive/client";

export type DriveMaterial = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  webContentLink: string | null;
  thumbnailLink: string | null;
  createdTime: string;
  programId: string | null;
  programTitle: string | null;
  status: string;
  uploadedBy: string | null;
  uploadedByUserId: string | null;
  folderName: string | null;
  visibility: string | null;
};

export type DriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  webContentLink: string | null;
  thumbnailLink: string | null;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  createdTime: string;
  appProperties?: Record<string, string>;
};

function escapeQuery(value: string) {
  return value.replace(/'/g, "\\'");
}

function folderNameForProgram(title: string) {
  if (title.toLowerCase().includes("life")) return "Leadership";
  if (title.toLowerCase().includes("seerah")) return "Seerah";
  if (title.toLowerCase().includes("tajweed")) return "Tajweed";
  if (title.toLowerCase().includes("arabic")) return "Arabic";
  return title;
}

async function shareFileWithEmails(fileId: string, emails: Array<string | null | undefined>, role: "reader" | "writer" = "writer") {
  const uniqueEmails = [...new Set(emails.filter((email): email is string => Boolean(email)))];
  for (const emailAddress of uniqueEmails) {
    await driveRequest(`/files/${fileId}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, type: "user", emailAddress }),
    }).catch(() => undefined);
  }
}

async function shareFileWithDashboardAdmins(fileId: string, admins: Array<{ email: string }>) {
  const accessEmails = env.success
    ? [env.data.GOOGLE_DRIVE_SHARED_OWNER_EMAIL, env.data.GOOGLE_DRIVE_ADMIN_ACCESS_EMAIL, ...admins.map((admin) => admin.email)]
    : admins.map((admin) => admin.email);
  await shareFileWithEmails(fileId, accessEmails, "writer");
}

export async function ensureProgramFolder(programId: string) {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) throw new Error("Program not found.");

  const folderName = folderNameForProgram(program.title);
  const rootFolderId = getDriveRootFolderId();
  const query = [
    `'${rootFolderId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${escapeQuery(folderName)}'`,
    "trashed = false",
  ].join(" and ");

  const existing = await driveRequest<{ files: Array<{ id: string; name: string }> }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
  );
  if (existing.files[0]) return existing.files[0].id;

  const created = await driveRequest<{ id: string }>("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    }),
  });

  return created.id;
}

export async function ensureChildFolder(parentFolderId: string, folderName: string) {
  const trimmed = folderName.trim();
  if (!trimmed) return parentFolderId;

  const query = [
    `'${parentFolderId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${escapeQuery(trimmed)}'`,
    "trashed = false",
  ].join(" and ");

  const existing = await driveRequest<{ files: Array<{ id: string; name: string }> }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
  );
  if (existing.files[0]) return existing.files[0].id;

  const created = await driveRequest<{ id: string }>("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: trimmed,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  return created.id;
}

async function uploadFileToFolder(input: {
  folderId: string;
  file: File;
  name: string;
  appProperties?: Record<string, string>;
}) {
  const boundary = `genmumin-${Date.now()}`;
  const metadata = {
    name: input.name,
    parents: [input.folderId],
    appProperties: input.appProperties,
  };
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${input.file.type || "application/octet-stream"}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return driveUpload<DriveFile>("/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime,appProperties", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function uploadTeacherMaterial(input: {
  programId: string;
  teacherUserId: string;
  file: File;
  title?: string;
  folderName?: string;
  publishToStudents?: boolean;
}) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: input.teacherUserId },
    include: { user: true, programAssignments: true },
  });
  if (!teacher) throw new Error("Teacher not found.");
  if (!teacher.programAssignments.some((assignment) => assignment.programId === input.programId)) {
    throw new Error("You can only upload materials for assigned programs.");
  }

  const program = await db.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program not found.");

  const programFolderId = await ensureProgramFolder(input.programId);
  const folderId = await ensureChildFolder(programFolderId, input.folderName ?? "");
  const folderName = input.folderName?.trim() || "General";
  const metadata = {
    name: input.title || input.file.name,
    parents: [folderId],
    appProperties: {
      genMumin: "course-material",
      programId: input.programId,
      programTitle: program.title,
      uploadedByUserId: input.teacherUserId,
      uploadedByName: `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim(),
      folderName,
      status: input.publishToStudents === false ? "internal" : "approved",
      visibility: input.publishToStudents === false ? "internal" : "students_parents",
    },
  };

  const uploaded = await uploadFileToFolder({
    folderId,
    file: input.file,
    name: metadata.name,
    appProperties: metadata.appProperties,
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length) {
    await shareFileWithDashboardAdmins(uploaded.id, admins);
    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "New teacher material uploaded",
        body: `${teacher.user.firstName} uploaded ${uploaded.name} for ${program.title}.`,
        href: "/admin/materials",
      })),
    });
  }

  if (input.publishToStudents !== false) {
    await driveRequest(`/files/${uploaded.id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
    await notifyMaterialLearners(uploaded.id, uploaded.name, input.programId, program.title);
  }

  await db.notification.create({
    data: {
      userId: input.teacherUserId,
      title: "Material uploaded",
      body: `${uploaded.name} was uploaded to ${program.title}.`,
      href: "/teacher/materials",
    },
  });

  return uploaded;
}

export async function uploadAdminMaterial(input: {
  programId: string;
  adminUserId: string;
  file: File;
  title?: string;
  folderName?: string;
  publishToStudents?: boolean;
}) {
  const admin = await db.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Admin not found.");

  const program = await db.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program not found.");

  const programFolderId = await ensureProgramFolder(input.programId);
  const folderId = await ensureChildFolder(programFolderId, input.folderName ?? "");
  const folderName = input.folderName?.trim() || "General";
  const publish = input.publishToStudents !== false;
  const metadata = {
    name: input.title || input.file.name,
    parents: [folderId],
    appProperties: {
      genMumin: "course-material",
      programId: input.programId,
      programTitle: program.title,
      uploadedByUserId: input.adminUserId,
      uploadedByName: "Admin",
      folderName,
      status: publish ? "approved" : "internal",
      visibility: publish ? "students_parents" : "internal",
      approvedByUserId: input.adminUserId,
      approvedAt: new Date().toISOString(),
    },
  };

  const uploaded = await uploadFileToFolder({
    folderId,
    file: input.file,
    name: metadata.name,
    appProperties: metadata.appProperties,
  });

  if (publish) {
    await driveRequest(`/files/${uploaded.id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  }

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  await shareFileWithDashboardAdmins(uploaded.id, admins);
  if (publish) await notifyMaterialLearners(uploaded.id, uploaded.name, input.programId, program.title);

  return uploaded;
}

export async function uploadStudentSubmissionFile(input: {
  studentId: string;
  studentName: string;
  programId: string;
  programTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  submissionType: "task" | "homework" | "assignment";
  file: File;
}) {
  const rootFolderId = getDriveRootFolderId();
  const studentsFolderId = await ensureChildFolder(rootFolderId, "Gen-M students");
  const safeStudentFolder = input.studentName.trim() || input.studentId;
  const studentFolderId = await ensureChildFolder(studentsFolderId, safeStudentFolder);
  const programFolderId = await ensureChildFolder(studentFolderId, folderNameForProgram(input.programTitle));
  const typeFolderId = await ensureChildFolder(programFolderId, input.submissionType === "homework" ? "Homework" : input.submissionType === "assignment" ? "Assignments" : "Tasks");
  const assignmentFolderId = await ensureChildFolder(typeFolderId, input.assignmentTitle);

  const uploaded = await uploadFileToFolder({
    folderId: assignmentFolderId,
    file: input.file,
    name: input.file.name,
    appProperties: {
      genMumin: "student-submission",
      studentId: input.studentId,
      studentName: input.studentName,
      programId: input.programId,
      programTitle: input.programTitle,
      assignmentId: input.assignmentId,
      assignmentTitle: input.assignmentTitle,
      submissionType: input.submissionType,
    },
  });

  await driveRequest(`/files/${uploaded.id}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    webViewLink: uploaded.webViewLink ?? null,
    webContentLink: uploaded.webContentLink ?? null,
    thumbnailLink: uploaded.thumbnailLink ?? null,
  } satisfies DriveUploadResult;
}

function mapDriveFile(file: DriveFile): DriveMaterial {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink ?? null,
    webContentLink: file.webContentLink ?? null,
    thumbnailLink: file.thumbnailLink ?? null,
    createdTime: file.createdTime,
    programId: file.appProperties?.programId ?? null,
    programTitle: file.appProperties?.programTitle ?? null,
    status: file.appProperties?.status ?? "pending",
    uploadedBy: file.appProperties?.uploadedByName ?? null,
    uploadedByUserId: file.appProperties?.uploadedByUserId ?? null,
    folderName: file.appProperties?.folderName ?? "General",
    visibility: file.appProperties?.visibility ?? null,
  };
}

export async function listMaterials(options: { status?: string; programId?: string; visibility?: string; limit?: number } = {}) {
  const query = [
    "appProperties has { key='genMumin' and value='course-material' }",
    options.status ? `appProperties has { key='status' and value='${escapeQuery(options.status)}' }` : "",
    options.programId ? `appProperties has { key='programId' and value='${escapeQuery(options.programId)}' }` : "",
    options.visibility ? `appProperties has { key='visibility' and value='${escapeQuery(options.visibility)}' }` : "",
    "trashed = false",
  ].filter(Boolean).join(" and ");

  const payload = await driveRequest<{ files: DriveFile[] }>(
    `/files?q=${encodeURIComponent(query)}&pageSize=${options.limit ?? 50}&orderBy=createdTime desc&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime,appProperties)`,
  );

  return payload.files.map(mapDriveFile);
}

export async function deleteMaterial(fileId: string) {
  await driveRequest(`/files/${fileId}`, { method: "DELETE" });
}

export async function grantAdminAccessToMaterials(fileIds: string[]) {
  if (!fileIds.length) return;
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  await Promise.all(fileIds.map((fileId) => shareFileWithDashboardAdmins(fileId, admins)));
}

export async function deleteTeacherMaterial(fileId: string, teacherUserId: string) {
  const file = await driveRequest<DriveFile>(`/files/${fileId}?fields=id,name,appProperties`);
  if (file.appProperties?.uploadedByUserId !== teacherUserId) {
    throw new Error("You can only delete your own uploaded materials.");
  }
  await deleteMaterial(fileId);
}

async function notifyMaterialLearners(fileId: string, fileName: string, programId: string, programTitle: string) {
  const enrollments = await db.enrollment.findMany({
    where: { programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
    include: { student: { include: { user: true } }, parent: { include: { user: true } } },
  });
  const userIds = new Set<string>();
  for (const enrollment of enrollments) {
    userIds.add(enrollment.student.user.id);
    if (enrollment.parent?.user.id) userIds.add(enrollment.parent.user.id);
  }
  if (!userIds.size) return;

  await db.notification.createMany({
    data: [...userIds].map((userId) => ({
      userId,
      title: "New course material",
      body: `${fileName} is available in ${programTitle}.`,
      href: `/student/courses?material=${fileId}`,
    })),
  });
}

export async function approveMaterial(fileId: string, adminUserId: string) {
  const file = await driveRequest<DriveFile>(`/files/${fileId}?fields=id,name,appProperties`);
  const updated = await driveRequest<DriveFile>(`/files/${fileId}?fields=id,name,webViewLink,createdTime,appProperties`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appProperties: {
        ...(file.appProperties ?? {}),
        status: "approved",
        approvedByUserId: adminUserId,
        approvedAt: new Date().toISOString(),
      },
    }),
  });

  await driveRequest(`/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  const teacherUserId = updated.appProperties?.uploadedByUserId;
  const programTitle = updated.appProperties?.programTitle ?? "your program";
  if (teacherUserId) {
    await db.notification.create({
      data: {
        userId: teacherUserId,
        title: "Course material approved",
        body: `${updated.name} is now visible to students and parents in ${programTitle}.`,
        href: "/teacher/materials",
      },
    });
  }

  const programId = updated.appProperties?.programId;
  if (programId && updated.appProperties?.visibility !== "internal") {
    await notifyMaterialLearners(updated.id, updated.name, programId, programTitle);
  }

  return updated;
}

export async function rejectMaterial(fileId: string, adminUserId: string) {
  const updated = await driveRequest<DriveFile>(`/files/${fileId}?fields=id,name,appProperties`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appProperties: {
        status: "rejected",
        rejectedByUserId: adminUserId,
        rejectedAt: new Date().toISOString(),
      },
    }),
  });

  const teacherUserId = updated.appProperties?.uploadedByUserId;
  if (teacherUserId) {
    await db.notification.create({
      data: {
        userId: teacherUserId,
        title: "Course material needs changes",
        body: `${updated.name} was not approved yet.`,
        href: "/teacher/materials",
      },
    });
  }

  return updated;
}
