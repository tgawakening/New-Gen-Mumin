import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth/session-manager";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
