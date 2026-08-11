import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { diagnoseZoomParticipantAccess, diagnoseZoomRecordingAccess } from "@/lib/zoom/client";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const schedule = await db.classSchedule.findFirst({
      where: { meetingId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { meetingId: true },
    });
    const recordingDiagnostics = await diagnoseZoomRecordingAccess();
    const participantDiagnostics = schedule?.meetingId
      ? await diagnoseZoomParticipantAccess(schedule.meetingId)
      : {
          participantsEndpoint: "past_meetings/{meetingId}/participants",
          participantsEndpointStatus: null,
          hasParticipantLookupScope: false,
          details: "No Zoom meeting ID is available for a participant lookup test.",
        };
    return NextResponse.json({ ...recordingDiagnostics, ...participantDiagnostics });
  } catch (error) {
    return NextResponse.json(
      {
        zoomConfigured: false,
        error: error instanceof Error ? error.message : "Zoom diagnostics failed.",
      },
      { status: 500 },
    );
  }
}
