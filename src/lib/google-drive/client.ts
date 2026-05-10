import "server-only";

import { SignJWT, importPKCS8 } from "jose";

import { env } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function normalizePrivateKey(value: string) {
  let key = value.trim();
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

function getDriveConfig() {
  if (!env.success) throw new Error("Application environment is not configured.");

  const {
    GOOGLE_DRIVE_CLIENT_EMAIL,
    GOOGLE_DRIVE_PRIVATE_KEY,
    GOOGLE_DRIVE_ROOT_FOLDER_ID,
    GOOGLE_DRIVE_PROJECT_ID,
    GOOGLE_DRIVE_PRIVATE_KEY_ID,
  } = env.data;

  if (!GOOGLE_DRIVE_CLIENT_EMAIL || !GOOGLE_DRIVE_PRIVATE_KEY || !GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    throw new Error("Google Drive environment variables are missing.");
  }

  return {
    clientEmail: GOOGLE_DRIVE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(GOOGLE_DRIVE_PRIVATE_KEY),
    rootFolderId: GOOGLE_DRIVE_ROOT_FOLDER_ID,
    projectId: GOOGLE_DRIVE_PROJECT_ID,
    privateKeyId: GOOGLE_DRIVE_PRIVATE_KEY_ID,
  };
}

export function isGoogleDriveConfigured() {
  return (
    env.success &&
    Boolean(
      env.data.GOOGLE_DRIVE_CLIENT_EMAIL &&
        env.data.GOOGLE_DRIVE_PRIVATE_KEY &&
        env.data.GOOGLE_DRIVE_ROOT_FOLDER_ID,
    )
  );
}

async function getAccessToken() {
  const config = getDriveConfig();
  const key = await importPKCS8(config.privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      kid: config.privateKeyId,
    })
    .setIssuer(config.clientEmail)
    .setSubject(config.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Google token response did not include an access token.");
  return payload.access_token;
}

export async function driveRequest<T>(path: string, init: RequestInit = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function driveUpload<T>(path: string, init: RequestInit = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Drive upload failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export function getDriveRootFolderId() {
  return getDriveConfig().rootFolderId;
}
