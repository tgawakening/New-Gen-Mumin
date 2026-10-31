import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canSeeTeacherProgramme } from "@/lib/teacher/programme-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session) return NextResponse.json({ live: false }, { status: 401, headers });
  if (session.user.role !== "TEACHER") return NextResponse.json({ live: false }, { status: 403, headers });
  try {
    const occurrences = await db.liveClassSessionOccurrence.findMany({
      where: { teacherUserId: session.user.id, source: "zoom-webhook", startedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
      select: { endedAt: true, schedule: { select: { program: { select: { slug: true } } } } },
      orderBy: { startedAt: "desc" },
      distinct: ["scheduleId"],
    });
    return NextResponse.json({ live: occurrences.some(item => !item.endedAt && canSeeTeacherProgramme(session.user, item.schedule.program)) }, { headers });
  } catch (error) {
    console.error("Teacher live reward reminder unavailable", error);
    return NextResponse.json({ live: false }, { status: 503, headers });
  }
}
