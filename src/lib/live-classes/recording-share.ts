import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
const SHARE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
function getShareSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required for recording share links.");
  return secret;
}
function signature(recordingId: string, expiresAt: number) {
  return createHmac("sha256", getShareSecret()).update(`${recordingId}:${expiresAt}`).digest("base64url");
}
export function createRecordingShareToken(recordingId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SHARE_LIFETIME_SECONDS;
  return { expiresAt, token: signature(recordingId, expiresAt) };
}
export function verifyRecordingShareToken(recordingId: string, expiresAtValue: string | null, token: string | null) {
  const expiresAt = Number(expiresAtValue);
  if (!token || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(recordingId, expiresAt);
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(token)); } catch { return false; }
}
