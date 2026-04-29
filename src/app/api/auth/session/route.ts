import { NextResponse } from "next/server";

import { getCurrentSession, resolveDashboardLinkForSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    dashboardHome: await resolveDashboardLinkForSession(session.user),
  });
}
