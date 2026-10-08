import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { driveRequest } from "@/lib/google-drive/client";
import { getZoomUserRecordings } from "@/lib/zoom/client";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Read-only inventory for recovering recordings whose schedules were deleted.
 * Never restores deliberately hidden recordings or writes to Drive/Zoom.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });
  const teacherUserId = request.nextUrl.searchParams.get("teacherUserId") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(teacherUserId)) return NextResponse.json({ error: "Select a teacher" }, { status: 400, headers });
  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherUserId }, select: { id: true } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404, headers });
  try {
    const month = request.nextUrl.searchParams.get("zoomMonth");
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400, headers });
      const from = new Date(month + "-01T00:00:00.000Z");
      const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59));
      const result = await getZoomUserRecordings({ from, to });
      // Only technical metadata; do not expose playback/download tokens.
      return NextResponse.json({ meetings: (result.meetings ?? []).map(meeting => ({
        id: meeting.id, topic: meeting.topic, duration: meeting.duration,
        files: (meeting.recording_files ?? []).map(file => ({ id: file.id, start: file.recording_start, end: file.recording_end })),
      })) }, { headers });
    }
    const query = new URLSearchParams({
      q: "trashed = false and appProperties has { key='genMumin' and value='live-class-recording' } and appProperties has { key='teacherUserId' and value='" + teacherUserId + "' }",
      fields: "nextPageToken,files(id,name,mimeType,createdTime,size,parents,appProperties,videoMediaMetadata)",
      pageSize: "100", orderBy: "createdTime desc",
    });
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor && cursor.length <= 2048) query.set("pageToken", cursor);
    const files = await driveRequest("/files?" + query.toString(), { signal: AbortSignal.timeout(20000) });
    return NextResponse.json(files, { headers });
  } catch (error) {
    console.error("Recording recovery inventory failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Recording storage could not be checked. Please try again." }, { status: 502, headers });
  }
}
