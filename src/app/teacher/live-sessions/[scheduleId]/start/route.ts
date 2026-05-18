import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getZoomMeetingStartUrl } from "@/lib/zoom/client";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/auth/login", _request.url));
  }

  const { scheduleId } = await context.params;
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!teacher) {
    return NextResponse.redirect(new URL("/teacher-registration", _request.url));
  }

  const schedule = await db.classSchedule.findFirst({
    where: {
      id: scheduleId,
      teacherId: teacher.id,
    },
    select: {
      meetingId: true,
      meetingUrl: true,
    },
  });

  if (!schedule?.meetingId) {
    const params = new URLSearchParams({
      notice: "Zoom start link is not available for this session yet.",
      tone: "error",
    });
    return NextResponse.redirect(new URL(`/teacher/live-sessions?${params.toString()}`, _request.url));
  }

  try {
    const startUrl = await getZoomMeetingStartUrl(schedule.meetingId);
    return NextResponse.redirect(startUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open the teacher start link.";
    const params = new URLSearchParams({
      notice: message,
      tone: "error",
    });
    return NextResponse.redirect(new URL(`/teacher/live-sessions?${params.toString()}`, _request.url));
  }
}
