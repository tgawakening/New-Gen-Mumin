import { NextResponse } from "next/server";

import { loginPayloadSchema } from "@/lib/auth/schema";
import { getDashboardHome } from "@/lib/auth/session";
import { loginAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = loginPayloadSchema.parse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    const user = await loginAccount(payload);
    return NextResponse.redirect(new URL(getDashboardHome(user.role), request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    const temporary = /database|connect|timeout|fetch|pool|unavailable/i.test(message);
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("error", temporary ? "The login service is busy. Please try again." : message);
    return NextResponse.redirect(loginUrl, 303);
  }
}