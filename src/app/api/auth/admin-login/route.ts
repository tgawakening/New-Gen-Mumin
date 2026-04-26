import { NextResponse } from "next/server";

import { getDashboardHome } from "@/lib/auth/session";
import { loginPayloadSchema } from "@/lib/auth/schema";
import { loginAdminDashboardAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const payload = loginPayloadSchema.parse(await request.json());
    const user = await loginAdminDashboardAccount(payload);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: user.role,
      dashboardHome: getDashboardHome(user.role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
