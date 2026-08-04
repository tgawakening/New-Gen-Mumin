import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { driveDownloadResponse } from "@/lib/google-drive/client";

type RouteContext = { params: Promise<{ attemptId: string; fileId: string }> };

function evidenceIds(answer: unknown) {
  if (!answer || typeof answer !== "object" || !("evidence" in answer)) return [];
  const evidence = (answer as { evidence?: unknown }).evidence;
  return Array.isArray(evidence)
    ? evidence.flatMap((item) => item && typeof item === "object" && "id" in item ? [String((item as { id: unknown }).id)] : [])
    : [];
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || !["TEACHER", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { attemptId, fileId } = await context.params;
  const attempt = await db.missionAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: { select: { answer: true } }, mission: { select: { programId: true } } },
  });
  if (!attempt?.mission.programId || !attempt.answers.some((answer) => evidenceIds(answer.answer).includes(fileId))) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }
  if (session.user.role === "TEACHER") {
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        programRosters: {
          where: {
            programId: attempt.mission.programId,
            studentId: attempt.studentId,
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!teacher?.programRosters.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const driveResponse = await driveDownloadResponse(fileId);
  return new Response(driveResponse.body, {
    headers: {
      "Content-Type": driveResponse.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}