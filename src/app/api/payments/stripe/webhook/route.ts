import Stripe from "stripe";

import { getStripeWebhookSecret } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/fulfillment";
import { recordAutoSubscriptionFailure, recordAutoSubscriptionPayment } from "@/lib/payments/monthly-ledger";
import { getStripeClient } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 });
  }

  const stripe = getStripeClient();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid Stripe event.", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      await markOrderPaid(orderId, {
        providerPaymentId: session.payment_intent?.toString() ?? null,
        providerReference: session.id,
        rawPayload: session,
        gateway: "STRIPE",
        subscriptionId: session.subscription?.toString() ?? null,
      });
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const invoiceRecord = invoice as Stripe.Invoice & { subscription?: string | { id?: string } | null };
    const subscriptionId = typeof invoiceRecord.subscription === "string" ? invoiceRecord.subscription : invoiceRecord.subscription?.id ?? null;
    if (subscriptionId) {
      await recordAutoSubscriptionPayment({
        providerSubscriptionId: subscriptionId,
        providerInvoiceId: invoice.id,
        amount: invoice.amount_paid ? invoice.amount_paid / 100 : null,
        currency: invoice.currency?.toUpperCase() ?? null,
        paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date(),
        rawPayload: invoice,
        gateway: "STRIPE",
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const invoiceRecord = invoice as Stripe.Invoice & { subscription?: string | { id?: string } | null };
    const subscriptionId = typeof invoiceRecord.subscription === "string" ? invoiceRecord.subscription : invoiceRecord.subscription?.id ?? null;
    if (subscriptionId) {
      await recordAutoSubscriptionFailure({
        providerSubscriptionId: subscriptionId,
        providerInvoiceId: invoice.id,
        amount: invoice.amount_due ? invoice.amount_due / 100 : null,
        currency: invoice.currency?.toUpperCase() ?? null,
        failedAt: new Date(),
        rawPayload: invoice,
        gateway: "STRIPE",
      });
    }
  }
  return Response.json({ received: true });
}
