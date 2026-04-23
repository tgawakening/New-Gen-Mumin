import Stripe from "stripe";

import { getStripeWebhookSecret } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/fulfillment";
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

  return Response.json({ received: true });
}
