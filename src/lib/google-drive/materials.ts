import "server-only";

import { db } from "@/lib/db";
import { driveRequest, driveUpload, getDriveRootFolderId } from "@/lib/google-drive/client";

export type DriveMaterial = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  webContentLink: string | null;
  createdTime: string;
  programId: string | null;
  programTitle: string | null;
  status: string;
  uploadedBy: string | null;
  folderName: string | null;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
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
  const boundary = `genmumin-${Date.now()}`;
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
      status: "pending",
      visibility: input.publishToStudents === false ? "internal" : "students_parents",
    },
  };

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${input.file.type || "application/octet-stream"}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploaded = await driveUpload<DriveFile>("/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,appProperties", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Course material approval needed",
        body: `${teacher.user.firstName} uploaded ${uploaded.name} for ${program.title}.`,
        href: "/admin/materials",
      })),
    });
  }

  await db.notification.create({
    data: {
      userId: input.teacherUserId,
      title: "Material uploaded for approval",
      body: `${uploaded.name} was uploaded to ${program.title} and is waiting for admin approval.`,
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
  const boundary = `genmumin-${Date.now()}`;
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

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${input.file.type || "application/octet-stream"}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploaded = await driveUpload<DriveFile>("/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,appProperties", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  if (publish) {
    await driveRequest(`/files/${uploaded.id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  }

  return uploaded;
}

function mapDriveFile(file: DriveFile): DriveMaterial {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink ?? null,
    webContentLink: file.webContentLink ?? null,
    createdTime: file.createdTime,
    programId: file.appProperties?.programId ?? null,
    programTitle: file.appProperties?.programTitle ?? null,
    status: file.appProperties?.status ?? "pending",
    uploadedBy: file.appProperties?.uploadedByName ?? null,
    folderName: file.appProperties?.folderName ?? "General",
  };
}

export async function listMaterials(options: { status?: string; programId?: string; limit?: number } = {}) {
  const query = [
    "appProperties has { key='genMumin' and value='course-material' }",
    options.status ? `appProperties has { key='status' and value='${escapeQuery(options.status)}' }` : "",
    options.programId ? `appProperties has { key='programId' and value='${escapeQuery(options.programId)}' }` : "",
    "trashed = false",
  ].filter(Boolean).join(" and ");

  const payload = await driveRequest<{ files: DriveFile[] }>(
    `/files?q=${encodeURIComponent(query)}&pageSize=${options.limit ?? 50}&orderBy=createdTime desc&fields=files(id,name,mimeType,webViewLink,webContentLink,createdTime,appProperties)`,
  );

  return payload.files.map(mapDriveFile);
}

export async function deleteMaterial(fileId: string) {
  await driveRequest(`/files/${fileId}`, { method: "DELETE" });
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
  if (programId) {
    const enrollments = await db.enrollment.findMany({
      where: { programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
      include: { student: { include: { user: true } }, parent: { include: { user: true } } },
    });
    const userIds = new Set<string>();
    for (const enrollment of enrollments) {
      userIds.add(enrollment.student.user.id);
      userIds.add(enrollment.parent.user.id);
    }
    if (userIds.size) {
      await db.notification.createMany({
        data: [...userIds].map((userId) => ({
          userId,
          title: "New course material",
          body: `${updated.name} is available in ${programTitle}.`,
          href: "/student/courses",
        })),
      });
    }
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
