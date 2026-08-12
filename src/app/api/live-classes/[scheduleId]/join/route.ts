import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recordZoomJoinIntent, verifyTrackedZoomJoin } from "@/lib/live-classes/attendance";

type RouteContext = { params: Promise<{ scheduleId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { scheduleId } = await context.params;
  const studentId = request.nextUrl.searchParams.get("student") ?? "";
  const signed = verifyTrackedZoomJoin(
    scheduleId,
    studentId,
    request.nextUrl.searchParams.get("expires"),
    request.nextUrl.searchParams.get("signature"),
  );
  const session = await getCurrentSession();
  if (!studentId || (!signed && !session)) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { meetingUrl: true, programId: true, scheduleRosters: { select: { studentId: true } } },
  });
  if (!schedule?.meetingUrl) return NextResponse.redirect(new URL("/student/schedule", request.url));

  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      userId: true,
      parents: { select: { parent: { select: { userId: true } } } },
      enrollments: { where: { programId: schedule.programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } }, select: { id: true } },
    },
  });
  const rosterAllows = !schedule.scheduleRosters.length || schedule.scheduleRosters.some((item) => item.studentId === studentId);
  if (!student?.enrollments.length || !rosterAllows) return NextResponse.redirect(new URL("/student/schedule", request.url));

  if (!signed && session) {
    const ownsStudent = session.user.role === "STUDENT"
      ? student.userId === session.user.id
      : session.user.role === "PARENT"
        ? student.parents.some((relation) => relation.parent.userId === session.user.id)
        : ["TEACHER", "ADMIN"].includes(session.user.role);
    if (!ownsStudent) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const attributionUserId = session?.user.id ?? student.userId;
  await recordZoomJoinIntent(scheduleId, studentId, attributionUserId);
  return NextResponse.redirect(schedule.meetingUrl);
}
