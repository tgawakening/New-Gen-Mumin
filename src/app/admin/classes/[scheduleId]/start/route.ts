import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
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

export async function GET(request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return redirectTo(request, "/admin/classes");
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
    return redirectTo(request, `/admin/classes?${params.toString()}`);
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
    return redirectTo(request, `/admin/classes?${params.toString()}`);
  }
}
