import { NextResponse } from "next/server";

import { markOrderCancelled } from "@/lib/payments/fulfillment";
import { getAppUrl } from "@/lib/payments/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (orderId) {
    await markOrderCancelled(orderId);
  }

  return NextResponse.redirect(`${getAppUrl()}/registration/cancel?gateway=paypal${orderId ? `&orderId=${orderId}` : ""}`);
}

