import { NextResponse } from "next/server";

import { getDashboardHome } from "@/lib/auth/session";
import { loginPayloadSchema } from "@/lib/auth/schema";
import { loginAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const payload = loginPayloadSchema.parse(await request.json());
    const user = await loginAccount(payload);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: user.role,
      dashboardHome: getDashboardHome(user.role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    const temporary = /database|connect|timeout|fetch|pool|unavailable/i.test(message);
    return NextResponse.json({ error: temporary ? "The login service is busy. Please try again." : message }, { status: temporary ? 503 : 400 });
  }
}
