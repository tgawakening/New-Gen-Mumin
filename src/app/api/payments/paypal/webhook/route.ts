import { NextResponse } from "next/server";

import { markOrderPaid } from "@/lib/payments/fulfillment";

export async function POST(request: Request) {
  const body = await request.json();
  const eventType = body.event_type as string | undefined;
  const resource = body.resource as Record<string, unknown> | undefined;
  const orderId = typeof resource?.custom_id === "string" ? resource.custom_id : null;

  if (orderId && eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    await markOrderPaid(orderId, {
      providerPaymentId: typeof resource?.id === "string" ? resource.id : null,
      providerReference: typeof body.id === "string" ? body.id : null,
      rawPayload: body,
      gateway: "PAYPAL",
      subscriptionId: typeof resource?.id === "string" ? resource.id : null,
    });
  }

  return NextResponse.json({ received: true });
}

