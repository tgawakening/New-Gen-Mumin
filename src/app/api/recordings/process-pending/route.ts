import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { processPendingDriveRecordings } from "@/lib/live-classes/recordings";

export const dynamic = "force-dynamic";

function hasSecretAccess(request: Request) {
  if (!env.success) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = request.headers.get("x-cron-secret") ?? "";
  const acceptedSecrets = [env.data.EXTERNAL_ADMIN_FEED_SECRET, env.data.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
  if (!acceptedSecrets.length) return false;
  return (
    acceptedSecrets.some((secret) => authorization === `Bearer ${secret}` || authorization === secret) ||
    acceptedSecrets.includes(cronSecret)
  );
}

async function isAllowed(request: Request) {
  if (hasSecretAccess(request)) return true;
  const session = await getCurrentSession();
  return session?.user.role === "ADMIN";
}

export async function GET(request: Request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 1), 1), 3);
  const wait = url.searchParams.get("wait") === "1";

  if (wait) {
    const results = await processPendingDriveRecordings(limit);
    return NextResponse.json({
      mode: "completed",
      processed: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  }

  void processPendingDriveRecordings(limit).catch((error) => {
    console.error("Background pending recording processing failed.", error);
  });

  return NextResponse.json({
    mode: "started",
    queued: limit,
    message: "Pending recording processing started in the background.",
  }, { status: 202 });
}

export async function POST(request: Request) {
  return GET(request);
}
