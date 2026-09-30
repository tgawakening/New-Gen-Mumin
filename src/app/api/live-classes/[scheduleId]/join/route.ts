import { sharedJoinStudents } from "@/lib/live-classes/shared-join";
import { recordPortalClassJoin } from "@/lib/live-classes/portal-join";
import { after, NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recordZoomJoinIntent, verifyTrackedZoomJoin } from "@/lib/live-classes/attendance";
import { resolveScheduleStudentIds } from "@/lib/live-classes/service";

type RouteContext = { params: Promise<{ scheduleId: string }> };

function scheduleDestination(request: NextRequest, state?: "ended" | "not-started") {
  const destination = new URL("/student/schedule", request.url);
  if (state) destination.searchParams.set("join", state);
  return destination;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { scheduleId } = await context.params;
  const studentId = request.nextUrl.searchParams.get("student") ?? "";
  const signed = verifyTrackedZoomJoin(
    scheduleId,
    studentId,
    request.nextUrl.searchParams.get("expires"),
    request.nextUrl.searchParams.get("signature"),
  );
  if (!studentId) return NextResponse.redirect(new URL("/auth/login", request.url));

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const [schedule, session] = await Promise.all([
    db.classSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        meetingUrl: true,
        programId: true,
        teacher: { select: { userId: true } },
        sessionOccurrences: {
          where: { source: "zoom-webhook", startedAt: { gte: sixHoursAgo } },
          orderBy: { startedAt: "desc" },
          take: 5,
          select: { teacherUserId: true, endedAt: true },
        },
      },
    }),
    signed ? Promise.resolve(null) : getCurrentSession(),
  ]);

  if (!schedule?.meetingUrl) return NextResponse.redirect(scheduleDestination(request));
  if (!signed && !session) return NextResponse.redirect(new URL("/auth/login", request.url));

  const latest = schedule.sessionOccurrences.find((occurrence) => occurrence.teacherUserId === schedule.teacher.userId);
  if (!latest || latest.endedAt) {
    return NextResponse.redirect(scheduleDestination(request, latest?.endedAt ? "ended" : "not-started"));
  }

  let attributionUserId: string;
  if (signed) {
    const student = await db.studentProfile.findUnique({ where: { id: studentId }, select: { userId: true } });
    if (!student) return NextResponse.redirect(scheduleDestination(request));
    attributionUserId = student.userId;
  } else {
    const [student, rosterStudentIds] = await Promise.all([
      db.studentProfile.findUnique({
        where: { id: studentId },
        select: {
          userId: true,
          parents: { select: { parent: { select: { userId: true } } } },
          enrollments: { where: { programId: schedule.programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } }, select: { id: true } },
        },
      }),
      resolveScheduleStudentIds(scheduleId),
    ]);
    if (!student?.enrollments.length || !rosterStudentIds.includes(studentId)) return NextResponse.redirect(scheduleDestination(request));
    const ownsStudent = session!.user.role === "STUDENT"
      ? student.userId === session!.user.id
      : session!.user.role === "PARENT"
        ? student.parents.some((relation) => relation.parent.userId === session!.user.id)
        : ["TEACHER", "ADMIN"].includes(session!.user.role);
    if (!ownsStudent) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    attributionUserId = session!.user.id;
  }

  after(async () => {
    await recordZoomJoinIntent(scheduleId, studentId, attributionUserId).catch((error) => {
      console.error(`[live-class-join] Could not record join intent for ${scheduleId}.`, error);
    });
  });
  return NextResponse.redirect(schedule.meetingUrl, 307);
}
/** Shared links only record attendance after an authenticated, explicit join. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { scheduleId } = await context.params;
  const destination = new URL("/join/" + encodeURIComponent(scheduleId), request.url);
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  if (!origin || new URL(origin).host !== host || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Unauthorized request" }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/auth/login?next=" + encodeURIComponent(destination.pathname), request.url), 303);
  try {
    const form = await request.formData();
    const studentId = form.get("student");
    const schedule = await db.classSchedule.findUnique({ where: { id: scheduleId }, select: { programId: true } });
    if (!schedule || typeof studentId !== "string") return NextResponse.json({ error: "Invalid class or learner" }, { status: 400 });
    const students = await sharedJoinStudents(scheduleId, schedule.programId, session.user);
    if (!students.some(student => student.id === studentId)) return NextResponse.json({ error: "This learner is not on your account and class roster." }, { status: 403 });
    const meetingUrl = await recordPortalClassJoin(scheduleId, studentId, session.user.id);
    return NextResponse.redirect(meetingUrl, 303);
  } catch (error) {
    console.error("[shared-class-join] Could not complete tracked join", error);
    destination.searchParams.set("error", "retry");
    return NextResponse.redirect(destination, 303);
  }
}
