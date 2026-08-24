import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { userCanAccessRecording } from "@/lib/live-classes/recordings";

type RouteProps = { params: Promise<{ recordingId: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { recordingId } = await params;
  const recording = await userCanAccessRecording(recordingId, { id: session.user.id, role: session.user.role });
  if (!recording?.driveFileId) {
    return NextResponse.json({ error: "Recording not found or access denied." }, { status: 404 });
  }

  return NextResponse.redirect(`https://drive.google.com/file/d/${encodeURIComponent(recording.driveFileId)}/preview`);
}