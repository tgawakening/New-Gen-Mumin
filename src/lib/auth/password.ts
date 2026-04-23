import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, originalKey] = storedHash.split(":");

  if (!salt || !originalKey) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const originalBuffer = Buffer.from(originalKey, "hex");

  if (derivedKey.length !== originalBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, originalBuffer);
}
