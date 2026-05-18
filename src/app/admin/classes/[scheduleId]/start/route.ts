import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getZoomMeetingStartUrl } from "@/lib/zoom/client";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/classes", request.url));
  }

  const { scheduleId } = await context.params;
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      meetingId: true,
    },
  });

  if (!schedule?.meetingId) {
    const params = new URLSearchParams({
      notice: "Zoom start link is not available for this class yet.",
      tone: "error",
    });
    return NextResponse.redirect(new URL(`/admin/classes?${params.toString()}`, request.url));
  }

  try {
    const startUrl = await getZoomMeetingStartUrl(schedule.meetingId);
    return NextResponse.redirect(startUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open the admin host link.";
    const params = new URLSearchParams({
      notice: message,
      tone: "error",
    });
    return NextResponse.redirect(new URL(`/admin/classes?${params.toString()}`, request.url));
  }
}
