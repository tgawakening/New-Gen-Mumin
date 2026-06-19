import { PrismaClient } from "@prisma/client";
import { SignJWT, importPKCS8 } from "jose";

const prisma = new PrismaClient();

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"];
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const PROCESSING_PROVIDER = "processing";
const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;
const DEFAULT_STALE_MS = 45 * 60 * 1000;

const intervalMs = positiveNumber(process.env.RECORDING_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS);
const staleMs = positiveNumber(process.env.RECORDING_WORKER_STALE_MS, DEFAULT_STALE_MS);
let shouldStop = false;

process.on("SIGTERM", () => {
  shouldStop = true;
  log("Shutdown requested.");
});
process.on("SIGINT", () => {
  shouldStop = true;
  log("Shutdown requested.");
});

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function log(message, extra) {
  console.log(`[${new Date().toISOString()}] ${message}`, extra ?? "");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

function shortError(error) {
  return errorMessage(error).replace(/\s+/g, " ").trim().slice(0, 160) || "Unknown recording import error.";
}

function failedStorageProvider(error) {
  return `failed:${shortError(error)}`.slice(0, 190);
}

function cleanTitle(title) {
  return String(title || "Class recording")
    .replace(/\s*\[Students:hidden\]\s*/gu, " ")
    .replace(/\s*\[Students:visible\]\s*/gu, " ")
    .replace(/\s*\[Audience:(PK_UK|US_CA|AU)\]\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function displayProgramTitle(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("arabic") || lower.includes("tajweed")) return "Arabic & Tajweed";
  if (lower.includes("life") || lower.includes("leadership")) return "Life Lessons & Leadership";
  return value || "";
}

function folderNameForProgram(title) {
  const lower = String(title || "").toLowerCase();
  if (lower.includes("life") || lower.includes("leadership")) return "Leadership";
  if (lower.includes("seerah")) return "Seerah";
  if (lower.includes("tajweed") || lower.includes("arabic")) return "Arabic and Tajweed";
  return title || "Programme";
}

function isArabicTajweedProgram(title) {
  const displayTitle = displayProgramTitle(title).toLowerCase();
  return displayTitle.includes("arabic") && displayTitle.includes("tajweed");
}

function teacherFolderName(teacher) {
  const email = teacher.user.email.toLowerCase();
  if (email === "abubakar98114@gmail.com") return "Ustadh Abubakr Sadique";
  if (email === "shoaibmufti11221122@gmail.com") return "Ustadha Afira Tahir";
  if (email === "mehranraziq@gmail.com") return "Ustadh Mehran Tahir";
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function extensionForRecording(fileType) {
  const type = String(fileType || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  return type || "mp4";
}

function normalizePrivateKey(value) {
  let key = String(value || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key);
      key = typeof parsed === "string" ? parsed : String(parsed.private_key ?? key);
    } catch {
      key = key.slice(1, -1);
    }
  }
  return key.replace(/\\n/g, "\n").trim();
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing.`);
  return value;
}

async function readResponseDetails(response) {
  const body = await response.text();
  if (!body) return `${response.status} ${response.statusText}`.trim();
  try {
    const payload = JSON.parse(body);
    return [payload.message, payload.error, payload.reason, payload.code ? `code ${payload.code}` : null]
      .filter(Boolean)
      .join(" - ");
  } catch {
    return body.slice(0, 600);
  }
}

async function getZoomAccessToken() {
  const credentials = Buffer.from(`${requireEnv("ZOOM_CLIENT_ID")}:${requireEnv("ZOOM_CLIENT_SECRET")}`).toString("base64");
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", requireEnv("ZOOM_ACCOUNT_ID"));

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!response.ok) throw new Error(`Zoom token request failed: ${await readResponseDetails(response)}`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error("Zoom token response did not include an access token.");
  return payload.access_token;
}

function zoomMeetingRecordingsUrl(meetingId) {
  const encodedMeetingId = meetingId.includes("/") ? encodeURIComponent(encodeURIComponent(meetingId)) : encodeURIComponent(meetingId);
  return `https://api.zoom.us/v2/meetings/${encodedMeetingId}/recordings`;
}

function isoDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function recordingSearchWindow(recordingStart) {
  const center = recordingStart ? new Date(recordingStart) : new Date();
  if (!Number.isFinite(center.getTime())) {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 30);
    return { from: isoDateOnly(from), to: isoDateOnly(to) };
  }

  const from = new Date(center);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(center);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from: isoDateOnly(from), to: isoDateOnly(to) };
}

async function getZoomMeetingRecordings(meetingId) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(zoomMeetingRecordingsUrl(meetingId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Zoom meeting recordings lookup failed: ${await readResponseDetails(response)}`);
  return response.json();
}

async function getZoomUserRecordings(recordingStart) {
  const accessToken = await getZoomAccessToken();
  const window = recordingSearchWindow(recordingStart);
  const url = new URL(`https://api.zoom.us/v2/users/${encodeURIComponent(requireEnv("ZOOM_HOST_USER_ID"))}/recordings`);
  url.searchParams.set("from", window.from);
  url.searchParams.set("to", window.to);
  url.searchParams.set("page_size", "100");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Zoom user recordings lookup failed: ${await readResponseDetails(response)}`);
  return response.json();
}

function sameRecordingTime(left, right) {
  if (!left || !right) return false;
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
  return Math.abs(leftMs - rightMs) <= 2 * 60 * 1000;
}

async function findZoomRecordingDownloadUrl(recording) {
  let files = [];
  let meetingLookupError = null;

  if (recording.meetingId) {
    try {
      const recordings = await getZoomMeetingRecordings(recording.meetingId);
      files = recordings.recording_files ?? [];
    } catch (error) {
      meetingLookupError = error;
    }
  }

  if (!files.length) {
    const recordings = await getZoomUserRecordings(recording.recordingStart);
    files = (recordings.meetings ?? [])
      .filter((meeting) => !recording.meetingId || String(meeting.id ?? "") === recording.meetingId || String(meeting.uuid ?? "") === recording.meetingId)
      .flatMap((meeting) => meeting.recording_files ?? []);
  }

  if (!files.length && meetingLookupError) throw meetingLookupError;

  const playable = files.filter((file) => {
    const fileType = String(file.file_type ?? "").toUpperCase();
    if (!file.download_url) return false;
    if (["CHAT", "CC", "TRANSCRIPT", "TIMELINE", "SUMMARY"].includes(fileType)) return false;
    return !fileType || ["MP4", "M4A"].includes(fileType);
  });

  const requestedType = String(recording.fileType ?? "").toUpperCase();
  const exact =
    playable.find((file) => recording.recordingFileId && file.id === recording.recordingFileId) ??
    playable.find((file) => sameRecordingTime(file.recording_start, recording.recordingStart) && (!requestedType || String(file.file_type ?? "").toUpperCase() === requestedType)) ??
    playable.find((file) => sameRecordingTime(file.recording_start, recording.recordingStart)) ??
    playable.find((file) => String(file.file_type ?? "").toUpperCase() === "MP4") ??
    playable[0];

  return exact?.download_url ?? null;
}

async function downloadZoomRecording(recording) {
  const accessToken = await getZoomAccessToken();
  const downloadUrl = recording.downloadUrl ?? (await findZoomRecordingDownloadUrl(recording));
  if (!downloadUrl) throw new Error("Zoom did not return a downloadable video recording yet.");

  async function fetchRecording(url, withBearer) {
    return fetch(url, {
      headers: withBearer ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  }

  let response = await fetchRecording(downloadUrl, true);
  if (!response.ok) {
    const tokenUrl = new URL(downloadUrl);
    tokenUrl.searchParams.set("access_token", accessToken);
    response = await fetchRecording(tokenUrl.toString(), false);
  }

  if (!response.ok) throw new Error(`Zoom recording download failed: ${await readResponseDetails(response)}`);

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") ?? "video/mp4",
    downloadUrl,
  };
}

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID && process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) throw new Error(`Google OAuth refresh failed: ${await response.text()}`);
    const payload = await response.json();
    if (!payload.access_token) throw new Error("Google OAuth response did not include an access token.");
    return payload.access_token;
  }

  const clientEmail = requireEnv("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(requireEnv("GOOGLE_DRIVE_PRIVATE_KEY"));
  const key = await importPKCS8(privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: process.env.GOOGLE_DRIVE_PRIVATE_KEY_ID })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) throw new Error(`Google token request failed: ${await response.text()}`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error("Google token response did not include an access token.");
  return payload.access_token;
}

async function driveRequest(path, init = {}) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) throw new Error(`Google Drive request failed: ${await response.text()}`);
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : undefined;
}

async function driveUpload(path, init = {}) {
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) throw new Error(`Google Drive upload failed: ${await response.text()}`);
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : undefined;
}

function escapeQuery(value) {
  return String(value).replace(/'/g, "\\'");
}

async function ensureChildFolder(parentFolderId, folderName) {
  const trimmed = String(folderName || "").trim();
  if (!trimmed) return parentFolderId;

  const query = [
    `'${parentFolderId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${escapeQuery(trimmed)}'`,
    "trashed = false",
  ].join(" and ");

  const existing = await driveRequest(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
  if (existing.files?.[0]) return existing.files[0].id;

  const created = await driveRequest("/files?fields=id", {
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

async function ensureRecordingFolder(recording) {
  const rootFolderId = requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const programFolderId = await ensureChildFolder(rootFolderId, folderNameForProgram(recording.schedule.program.title));
  if (!isArabicTajweedProgram(recording.schedule.program.title)) {
    return ensureChildFolder(programFolderId, "Recordings");
  }

  const teacherFolderId = await ensureChildFolder(programFolderId, teacherFolderName(recording.schedule.teacher));
  return ensureChildFolder(teacherFolderId, "Recordings");
}

async function uploadRecordingToDrive(recording, downloaded) {
  const folderId = await ensureRecordingFolder(recording);
  const boundary = `genmumin-${Date.now()}`;
  const title = cleanTitle(recording.topic || recording.schedule.title);
  const dateLabel = recording.recordingStart ? recording.recordingStart.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const metadata = {
    name: `${title} - ${dateLabel}.${extensionForRecording(recording.fileType)}`,
    parents: [folderId],
    copyRequiresWriterPermission: true,
    appProperties: {
      genMumin: "live-class-recording",
      programId: recording.schedule.programId,
      programTitle: displayProgramTitle(recording.schedule.program.title),
      teacherUserId: recording.schedule.teacher.user.id,
      teacherName: teacherFolderName(recording.schedule.teacher),
      scheduleId: recording.scheduleId,
      recordingFileId: recording.recordingFileId ?? recording.id,
      folderName: "Recordings",
      visibility: "students_parents",
    },
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${downloaded.mimeType || "video/mp4"}\r\n\r\n`),
    downloaded.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploaded = await driveUpload("/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime,appProperties", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  await driveRequest(`/files/${uploaded.id}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  await driveRequest(`/files/${uploaded.id}?fields=id,webViewLink,copyRequiresWriterPermission`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ copyRequiresWriterPermission: true }),
  }).catch(() => undefined);

  return { id: uploaded.id, webViewLink: uploaded.webViewLink ?? null, folderId };
}

function getAudienceGroup(title) {
  const match = String(title || "").match(/\[Audience:(PK_UK|US_CA|AU)\]/u);
  return match ? match[1] : "ALL";
}

function isVisibleToStudents(title) {
  return !String(title || "").includes("[Students:hidden]");
}

function normalizeAudienceCode(countryCode) {
  return String(countryCode ?? "").trim().toUpperCase().replace(/[^\dA-Z+]/gu, "");
}

function countryMatchesAudience(codes, group) {
  const normalizedCodes = codes.map(normalizeAudienceCode).filter(Boolean);
  if (group === "ALL") return true;
  if (group === "PK_UK") return normalizedCodes.some((code) => ["PK", "PAK", "PAKISTAN", "+92", "92", "GB", "UK", "GBR", "UNITEDKINGDOM", "+44", "44"].includes(code));
  if (group === "US_CA") return normalizedCodes.some((code) => ["US", "USA", "UNITEDSTATES", "CA", "CAN", "CANADA", "+1", "1"].includes(code));
  if (group === "AU") return normalizedCodes.some((code) => ["AU", "AUS", "AUSTRALIA", "+61", "61"].includes(code));
  return true;
}

function enrollmentMatchesAudience(enrollment, group) {
  const registrationCountries = enrollment.student?.registrationStudents ?? [];
  return countryMatchesAudience(
    [
      enrollment.student?.countryCode,
      enrollment.student?.countryName,
      ...registrationCountries.flatMap((entry) => [entry.countryCode, entry.countryName]),
      enrollment.parent?.billingCountryCode,
      enrollment.parent?.billingCountryName,
      enrollment.parent?.user?.phoneCountryCode,
    ],
    group,
  );
}

async function createNotificationOnce(data) {
  const existing = await prisma.notification.findFirst({ where: data });
  if (existing) return;
  await prisma.notification.create({ data });
}

async function notifyRecordingReady(recordingId) {
  const recording = await prisma.liveClassRecording.findFirst({
    where: { id: recordingId, deletedAt: null, driveFileId: { not: null } },
    include: {
      schedule: {
        include: {
          teacher: { include: { user: true } },
          scheduleRosters: { select: { studentId: true } },
          program: {
            include: {
              enrollments: {
                where: { status: { in: ACTIVE_ENROLLMENT_STATUSES } },
                include: {
                  parent: { include: { user: true } },
                  student: {
                    include: {
                      user: true,
                      registrationStudents: { select: { countryCode: true, countryName: true } },
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

  const users = new Map();
  users.set(recording.schedule.teacher.user.id, { role: "teacher" });

  if (isVisibleToStudents(recording.schedule.title)) {
    const rosterIds = new Set(recording.schedule.scheduleRosters.map((entry) => entry.studentId));
    const audienceGroup = getAudienceGroup(recording.schedule.title);
    for (const enrollment of recording.schedule.program.enrollments) {
      if (!enrollmentMatchesAudience(enrollment, audienceGroup)) continue;
      if (rosterIds.size && !rosterIds.has(enrollment.studentId)) continue;
      users.set(enrollment.student.user.id, { role: "student" });
      users.set(enrollment.parent.user.id, { role: "parent", childId: enrollment.studentId });
    }
  }

  const title = cleanTitle(recording.topic || recording.schedule.title);
  for (const [userId, item] of users.entries()) {
    const href =
      item.role === "teacher"
        ? "/teacher/recordings"
        : item.role === "parent"
          ? `/parent/recordings${item.childId ? `?child=${item.childId}` : ""}`
          : "/student/recordings";

    await createNotificationOnce({
      userId,
      title: "Class recording ready",
      body: `${title} recording is now available.`,
      href,
    });
  }
}

function includeRecordingRelations() {
  return {
    schedule: {
      include: {
        program: true,
        teacher: { include: { user: true } },
      },
    },
  };
}

async function resetStuckClaimsOnStart() {
  if (process.env.RECORDING_WORKER_RESET_ON_START === "0") return 0;
  const result = await prisma.liveClassRecording.updateMany({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: PROCESSING_PROVIDER,
    },
    data: { storageProvider: "zoom" },
  });
  return result.count;
}

async function clearStaleClaims() {
  const staleBefore = new Date(Date.now() - staleMs);
  const result = await prisma.liveClassRecording.updateMany({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: PROCESSING_PROVIDER,
      updatedAt: { lt: staleBefore },
    },
    data: { storageProvider: "zoom" },
  });
  return result.count;
}

async function hasActiveClaim() {
  const staleBefore = new Date(Date.now() - staleMs);
  const active = await prisma.liveClassRecording.findFirst({
    where: {
      deletedAt: null,
      driveFileId: null,
      storageProvider: PROCESSING_PROVIDER,
      updatedAt: { gte: staleBefore },
    },
    select: { id: true },
  });
  return Boolean(active);
}

async function claimNextRecording() {
  const staleBefore = new Date(Date.now() - staleMs);
  const recording = await prisma.liveClassRecording.findFirst({
    where: {
      deletedAt: null,
      driveFileId: null,
      downloadUrl: { not: null },
      OR: [
        { storageProvider: { not: PROCESSING_PROVIDER } },
        { updatedAt: { lt: staleBefore } },
      ],
    },
    include: includeRecordingRelations(),
    orderBy: { availableAt: "desc" },
  });
  if (!recording) return null;

  const result = await prisma.liveClassRecording.updateMany({
    where: {
      id: recording.id,
      driveFileId: null,
      OR: [
        { storageProvider: { not: PROCESSING_PROVIDER } },
        { updatedAt: { lt: staleBefore } },
      ],
    },
    data: { storageProvider: PROCESSING_PROVIDER },
  });

  return result.count ? recording : null;
}

async function releaseClaim(recordingId, error) {
  await prisma.liveClassRecording.updateMany({
    where: {
      id: recordingId,
      driveFileId: null,
      storageProvider: PROCESSING_PROVIDER,
    },
    data: { storageProvider: failedStorageProvider(error) },
  });
}

async function processOneRecording() {
  const cleared = await clearStaleClaims();
  if (cleared) log(`Released ${cleared} stale recording import claim(s).`);

  if (await hasActiveClaim()) {
    log("A recording import is already active. Waiting for the next loop.");
    return;
  }

  const recording = await claimNextRecording();
  if (!recording) {
    log("No pending recording to import.");
    return;
  }

  const title = cleanTitle(recording.topic || recording.schedule.title);
  log(`Import started: ${title} (${recording.id}).`);

  try {
    const downloaded = await downloadZoomRecording(recording);
    log(`Zoom download complete: ${title} (${Math.round(downloaded.buffer.length / 1024 / 1024)} MB).`);
    const driveRecording = await uploadRecordingToDrive(recording, downloaded);
    if (!driveRecording.webViewLink) throw new Error("Google Drive did not return a viewing link for this recording.");

    await prisma.liveClassRecording.update({
      where: { id: recording.id },
      data: {
        playUrl: driveRecording.webViewLink,
        driveFileId: driveRecording.id,
        driveViewUrl: driveRecording.webViewLink,
        driveFolderId: driveRecording.folderId,
        storageProvider: "google-drive",
        downloadUrl: downloaded.downloadUrl,
      },
    });
    await notifyRecordingReady(recording.id);
    log(`Import finished: ${title} (${recording.id}).`);
  } catch (error) {
    await releaseClaim(recording.id, error);
    log(`Import failed: ${title} (${recording.id}). ${shortError(error)}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log(`Recording worker started. Interval ${intervalMs}ms, stale claim ${staleMs}ms.`);
  const reset = await resetStuckClaimsOnStart();
  if (reset) log(`Recovered ${reset} interrupted recording import claim(s) on startup.`);

  while (!shouldStop) {
    try {
      await processOneRecording();
    } catch (error) {
      log(`Worker loop failed: ${shortError(error)}`);
    }
    if (!shouldStop) await sleep(intervalMs);
  }

  await prisma.$disconnect();
  log("Recording worker stopped.");
}

main().catch(async (error) => {
  log(`Recording worker crashed: ${errorMessage(error)}`);
  await prisma.$disconnect();
  process.exit(1);
});
