import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { addManualLiveClassRecording } from "@/lib/live-classes/recordings";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const fileValue = formData.get("recordingFile");
    const recordingId = await addManualLiveClassRecording({
      adminUserId: session.user.id,
      teacherId: String(formData.get("teacherId") || ""),
      programId: String(formData.get("programId") || ""),
      title: String(formData.get("title") || ""),
      sessionDate: String(formData.get("sessionDate") || ""),
      durationSeconds: Number(formData.get("durationSeconds") || "0") || null,
      source: String(formData.get("source") || "drive") === "upload" ? "upload" : "drive",
      file: fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
      driveUrl: String(formData.get("driveUrl") || ""),
      notifyUsers: formData.get("notifyUsers") === "yes",
      collaboratorTeacherIds: formData.getAll("collaboratorTeacherIds").map(String).filter(Boolean),
    });

    return NextResponse.json({
      ok: true,
      recordingId,
      message: "Recording uploaded and added successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to add recording.",
      },
      { status: 400 },
    );
  }
}
