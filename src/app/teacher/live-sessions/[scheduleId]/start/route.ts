import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { recordLiveClassSessionOccurrence } from "@/lib/live-classes/occurrences";
import { getZoomMeetingStartUrl } from "@/lib/zoom/client";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

function getPublicBaseUrl(request: Request) {
  if (env.success) {
    return env.data.APP_URL;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function redirectTo(request: Request, href: string) {
  return NextResponse.redirect(new URL(href, getPublicBaseUrl(request)));
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") {
    return redirectTo(_request, "/auth/login");
  }

  const mode = new URL(_request.url).searchParams.get("mode");
  const startAsMember = mode === "member";
  const { scheduleId } = await context.params;
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!teacher) {
    return redirectTo(_request, "/teacher-registration");
  }

  const schedule = await db.classSchedule.findFirst({
    where: {
      id: scheduleId,
      teacherId: teacher.id,
    },
    select: {
      id: true,
      meetingId: true,
      meetingUrl: true,
    },
  });

  if (!schedule?.meetingId && !schedule?.meetingUrl) {
    const params = new URLSearchParams({
      notice: "Zoom link is not available for this session yet.",
      tone: "error",
    });
    return redirectTo(_request, `/teacher/live-sessions?${params.toString()}`);
  }

  try {
    const zoomUrl = startAsMember
      ? schedule.meetingUrl
      : schedule.meetingId
        ? await getZoomMeetingStartUrl(schedule.meetingId)
        : schedule.meetingUrl;

    if (!zoomUrl) {
      throw new Error(startAsMember ? "Zoom join link is not available for this session yet." : "Zoom host start link is not available for this session yet.");
    }

    await recordLiveClassSessionOccurrence({
      scheduleId: schedule.id,
      teacherUserId: session.user.id,
      meetingId: schedule.meetingId,
      source: startAsMember ? "teacher-member-start" : "teacher-start",
    });
    return NextResponse.redirect(zoomUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open the teacher Zoom link.";
    const params = new URLSearchParams({
      notice: message,
      tone: "error",
    });
    return redirectTo(_request, `/teacher/live-sessions?${params.toString()}`);
  }
}
