import { NextRequest, NextResponse } from "next/server";

import { buildParentCalendarFeed } from "@/lib/calendar/parent-feed";
import { verifyParentCalendarToken } from "@/lib/calendar/tokens";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> },
) {
  const { parentId: rawParentId } = await params;
  const parentId = rawParentId.replace(/\.ics$/, "");
  const token = request.nextUrl.searchParams.get("token");

  if (!verifyParentCalendarToken(parentId, token)) {
    return NextResponse.json({ error: "Invalid calendar link" }, { status: 401 });
  }

  const calendar = await buildParentCalendarFeed(parentId);

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="gen-mumin-family-calendar.ics"',
      "Cache-Control": "private, max-age=900, stale-while-revalidate=3600",
    },
  });
}
