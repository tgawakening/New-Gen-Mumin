import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { driveMediaRequest } from "@/lib/google-drive/client";
import { ensureRecordingDriveViewUrl, userCanAccessRecording } from "@/lib/live-classes/recordings";

type RouteProps = {
  params: Promise<{ recordingId: string }>;
};

function passthroughHeaders(response: Response) {
  const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  return headers;
}

export async function GET(request: Request, { params }: RouteProps) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { recordingId } = await params;
  const user = { id: session.user.id, role: session.user.role };
  const recording = await userCanAccessRecording(recordingId, user);
  if (!recording) {
    return NextResponse.json({ error: "Recording not found or access denied." }, { status: 404 });
  }

  let driveFileId = recording.driveFileId;
  if (!driveFileId) {
    await ensureRecordingDriveViewUrl(recordingId, user);
    const refreshed = await db.liveClassRecording.findUnique({
      where: { id: recordingId },
      select: { driveFileId: true },
    });
    driveFileId = refreshed?.driveFileId ?? null;
  }

  if (!driveFileId) {
    return NextResponse.json({ error: "Recording is still being prepared." }, { status: 409 });
  }

  const driveResponse = await driveMediaRequest(driveFileId, request.headers.get("range"));
  return new Response(driveResponse.body, {
    status: driveResponse.status,
    headers: passthroughHeaders(driveResponse),
  });
}
