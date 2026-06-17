import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { diagnoseZoomRecordingAccess } from "@/lib/zoom/client";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const diagnostics = await diagnoseZoomRecordingAccess();
    return NextResponse.json(diagnostics);
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
