import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { ensureRecordingDriveViewUrl } from "@/lib/live-classes/recordings";

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
    const driveUrl = await ensureRecordingDriveViewUrl(resolvedParams.recordingId, {
      id: session.user.id,
      role: session.user.role,
    });
    return NextResponse.redirect(driveUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open recording.";
    return new NextResponse(message, { status: 403 });
  }
}
