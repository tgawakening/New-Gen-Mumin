import { randomBytes, createHash } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const THIRTY_DAYS_IN_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const sessionToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_IN_MS);

  await db.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession(sessionToken?: string) {
  if (sessionToken) {
    await db.session.deleteMany({ where: { sessionToken } });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
