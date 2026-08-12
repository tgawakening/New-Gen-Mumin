import { NextResponse } from "next/server";
import { driveMediaRequest } from "@/lib/google-drive/client";
import { getSharedRecordingPlaybackDetails } from "@/lib/live-classes/recordings";
import { verifyRecordingShareToken } from "@/lib/live-classes/recording-share";
type RouteProps = { params: Promise<{ recordingId: string }> };
export async function GET(request: Request, { params }: RouteProps) {
  const { recordingId } = await params; const url = new URL(request.url); const expires = url.searchParams.get("expires"); const token = url.searchParams.get("token");
  if (!verifyRecordingShareToken(recordingId, expires, token)) return NextResponse.json({ error: "Link expired or invalid." }, { status: 403 });
  const recording = await getSharedRecordingPlaybackDetails(recordingId); if (!recording) return NextResponse.json({ error: "Recording unavailable." }, { status: 404 });
  const driveResponse = await driveMediaRequest(recording.driveFileId, request.headers.get("range")); const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) { const value = driveResponse.headers.get(key); if (value) headers.set(key, value); }
  headers.set("Cache-Control", "private, no-store"); headers.set("Content-Disposition", "inline"); return new Response(driveResponse.body, { status: driveResponse.status, headers });
}
