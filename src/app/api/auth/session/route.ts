import { NextResponse } from "next/server";

import { getDashboardHome, getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    dashboardHome: getDashboardHome(session.user.role),
  });
}
