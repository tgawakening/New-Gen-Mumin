import { NextResponse } from "next/server";

import { driveMediaRequest } from "@/lib/google-drive/client";
import { getSharedRecordingPlaybackDetails } from "@/lib/live-classes/recordings";
import { verifyRecordingShareToken } from "@/lib/live-classes/recording-share";

type RouteProps = { params: Promise<{ recordingId: string }> };

function mediaHeaders(response: Response) {
  const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
  headers.set("Content-Disposition", "inline");
  return headers;
}

export async function GET(request: Request, { params }: RouteProps) {
  const { recordingId } = await params;
  const url = new URL(request.url);
  if (!verifyRecordingShareToken(recordingId, url.searchParams.get("expires"), url.searchParams.get("token"))) {
    return NextResponse.json({ error: "Link expired or invalid." }, { status: 403 });
  }

  const recording = await getSharedRecordingPlaybackDetails(recordingId);
  if (!recording) return NextResponse.json({ error: "Recording unavailable." }, { status: 404 });

  try {
    const driveResponse = await driveMediaRequest(recording.driveFileId, request.headers.get("range"));
    return new Response(driveResponse.body, { status: driveResponse.status, headers: mediaHeaders(driveResponse) });
  } catch (error) {
    console.error(`[shared-recording-media] Temporary playback failure for ${recordingId}.`, error);
    return NextResponse.json(
      { error: "Recording playback is temporarily unavailable. Please retry in a moment." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } },
    );
  }
}