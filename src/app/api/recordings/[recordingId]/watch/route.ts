import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { userCanAccessRecording } from "@/lib/live-classes/recordings";

type RouteProps = {
  params: Promise<{ recordingId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", _request.url));
  }

  try {
    const resolvedParams = await params;
    const recording = await userCanAccessRecording(resolvedParams.recordingId, {
      id: session.user.id,
      role: session.user.role,
    });
    if (!recording) {
      return new NextResponse("Recording not found or you do not have access.", { status: 404 });
    }
    return NextResponse.redirect(new URL(`/recordings/${resolvedParams.recordingId}/watch`, _request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open recording.";
    return new NextResponse(message, { status: 403 });
  }
}
