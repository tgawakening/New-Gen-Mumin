import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { driveMediaRequest } from "@/lib/google-drive/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return Response.json({ error: "Admin access required." }, { status: session ? 403 : 401 });
  }
  const { recordingId } = await params;
  const recording = await db.liveClassRecording.findFirst({
    where: { id: recordingId, deletedAt: null },
    select: { driveFileId: true, storageProvider: true, topic: true, fileType: true, recordingStart: true, schedule: { select: { title: true } } },
  });
  if (!recording) return Response.json({ error: "Recording not found." }, { status: 404 });
  if (!recording.driveFileId || recording.storageProvider !== "google-drive") {
    return Response.json({ error: "Prepare this recording before downloading it." }, { status: 409 });
  }
  try {
    const upstream = await driveMediaRequest(recording.driveFileId, request.headers.get("range"));
    const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    const type = upstream.headers.get("content-type")?.split(";")[0];
    const originalExtension = recording.fileType?.toLowerCase();
    const fallbackExtension = originalExtension && ['mp4', 'm4a', 'mp3', 'webm', 'mov'].includes(originalExtension) ? originalExtension : 'bin';
    const extension = type === "audio/mpeg" ? "mp3" : type === "audio/mp4" ? "m4a" : type === "video/webm" ? "webm" : type === "video/quicktime" ? "mov" : type === "video/mp4" ? "mp4" : fallbackExtension;
    const title = (recording.schedule?.title || recording.topic || "Recording").replace(/[^a-zA-Z0-9 _-]/g, " ").trim().replace(/\s+/g, "-").slice(0, 100) || "Recording";
    const date = recording.recordingStart?.toISOString().slice(0, 10);
    const filename = `${date ? date + "-" : ""}${title}-${recordingId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-12)}.${extension}`;
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    // Stream directly: long recordings must never be buffered in server or browser memory.
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: "Download temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } });
  }
}
