import { NextResponse } from "next/server";

import { markOrderPaid } from "@/lib/payments/fulfillment";
import { recordAutoSubscriptionFailure, recordAutoSubscriptionPayment } from "@/lib/payments/monthly-ledger";

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

  const billingSubscriptionId = typeof resource?.billing_agreement_id === "string"
    ? resource.billing_agreement_id
    : typeof resource?.subscription_id === "string"
      ? resource.subscription_id
      : typeof resource?.id === "string" && eventType?.startsWith("BILLING.SUBSCRIPTION.PAYMENT")
        ? resource.id
        : null;

  if (billingSubscriptionId && (eventType === "PAYMENT.SALE.COMPLETED" || eventType === "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED")) {
    const amountInfo = resource?.amount as { total?: string; value?: string; currency?: string; currency_code?: string } | undefined;
    await recordAutoSubscriptionPayment({
      providerSubscriptionId: billingSubscriptionId,
      providerInvoiceId: typeof body.id === "string" ? body.id : null,
      amount: amountInfo?.total ? Number(amountInfo.total) : amountInfo?.value ? Number(amountInfo.value) : null,
      currency: amountInfo?.currency || amountInfo?.currency_code || null,
      paidAt: typeof resource?.create_time === "string" ? new Date(resource.create_time) : new Date(),
      rawPayload: body,
      gateway: "PAYPAL",
    });
  }

  if (billingSubscriptionId && (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" || eventType === "PAYMENT.SALE.DENIED")) {
    await recordAutoSubscriptionFailure({
      providerSubscriptionId: billingSubscriptionId,
      providerInvoiceId: typeof body.id === "string" ? body.id : null,
      failedAt: new Date(),
      rawPayload: body,
      gateway: "PAYPAL",
    });
  }
  return NextResponse.json({ received: true });
}

