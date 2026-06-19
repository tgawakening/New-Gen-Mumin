import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getRecordingProcessingQueueStatus, processPendingDriveRecordings } from "@/lib/live-classes/recordings";

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

  const results = await processPendingDriveRecordings(1);
  const queue = await getRecordingProcessingQueueStatus();

  return NextResponse.json(
    {
      mode: "chunk-processed",
      processed: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      queue,
      results,
      message: results.length
        ? "One recording chunk was processed. Cron will continue the next chunk on the next run."
        : "No recording chunk was processed.",
    },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
