import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { driveDownloadResponse } from "@/lib/google-drive/client";

export async function GET(_request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { messageId } = await context.params;
  const message = await db.communityMessage.findUnique({
    where: { id: messageId },
    include: { room: { include: { supervisors: { select: { userId: true } }, memberships: { include: { student: { include: { parents: { include: { parent: { select: { userId: true } } } } } } } } } } },
  });
  if (!message?.audioDriveFileId || message.status === "HIDDEN") return new NextResponse("Not found", { status: 404 });
  const allowed = session.user.role === "ADMIN"
    || (session.user.role === "TEACHER" && message.room.supervisors.some((entry) => entry.userId === session.user.id))
    || (session.user.role === "STUDENT" && message.room.memberships.some((entry) => entry.student.userId === session.user.id))
    || (session.user.role === "PARENT" && message.room.memberships.some((entry) => entry.student.parents.some((relation) => relation.parent.userId === session.user.id)));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });
  const driveResponse = await driveDownloadResponse(message.audioDriveFileId);
  return new NextResponse(driveResponse.body, { headers: { "Content-Type": message.audioMimeType || driveResponse.headers.get("content-type") || "audio/webm", "Cache-Control": "private, max-age=300" } });
}