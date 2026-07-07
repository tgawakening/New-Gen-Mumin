import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createDueMonthlyPaymentRecords, sendPendingPaymentReminders } from "@/lib/payments/monthly-ledger";

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

  const created = await createDueMonthlyPaymentRecords();
  const reminded = await sendPendingPaymentReminders();
  return NextResponse.json({ ok: true, ...created, ...reminded });
}