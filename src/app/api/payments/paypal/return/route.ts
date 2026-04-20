import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/fulfillment";
import { getPayPalSubscription } from "@/lib/payments/paypal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const subscriptionId = url.searchParams.get("subscription_id");

  if (!orderId || !subscriptionId) {
    return NextResponse.redirect(`${getAppUrl()}/registration/cancel?gateway=paypal`);
  }

  const subscription = await getPayPalSubscription(subscriptionId);
  await markOrderPaid(orderId, {
    providerPaymentId: subscriptionId,
    providerReference: typeof subscription.id === "string" ? subscription.id : subscriptionId,
    rawPayload: subscription,
    gateway: "PAYPAL",
    subscriptionId,
  });

  return NextResponse.redirect(`${getAppUrl()}/registration/success?gateway=paypal&orderId=${orderId}`);
}

