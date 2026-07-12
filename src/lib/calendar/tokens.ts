import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function getCalendarSecret() {
  return (
    process.env.CALENDAR_FEED_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.RESEND_API_KEY ||
    "gen-mumin-calendar-development-secret"
  );
}

export function createParentCalendarToken(parentProfileId: string) {
  return createHmac("sha256", getCalendarSecret()).update(parentProfileId).digest("hex");
}

export function verifyParentCalendarToken(parentProfileId: string, token: string | null) {
  if (!token) return false;
  const expected = createParentCalendarToken(parentProfileId);

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://genmumin.com"
  ).replace(/\/$/, "");
}

export function buildParentCalendarUrls(parentProfileId: string) {
  const token = createParentCalendarToken(parentProfileId);
  const httpsUrl = `${getPublicAppUrl()}/api/calendar/parent/${parentProfileId}.ics?token=${token}`;
  const webcalUrl = httpsUrl.replace(/^https:\/\//, "webcal://");

  return { httpsUrl, webcalUrl };
}
