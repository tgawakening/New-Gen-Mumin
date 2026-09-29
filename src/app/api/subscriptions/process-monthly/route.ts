import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { processBillingNotifications } from "@/lib/payments/billing-worker";

function authorized(request: NextRequest) {
  const secret = env.success ? env.data.CRON_SECRET : process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || request.headers.get("x-cron-secret") || "";
  return auth === secret || auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, ...(await processBillingNotifications()) });
}