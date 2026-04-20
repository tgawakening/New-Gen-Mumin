import Stripe from "stripe";

import { getAppUrl, getStripeSecretKey } from "./config";

type StripeCheckoutInput = {
  orderId: string;
  paymentId: string;
  registrationId: string;
  customerEmail: string;
  currency: string;
  orderNumber: string;
  lineItems: Array<{
    description: string;
    amount: number;
  }>;
};

function toStripeCurrency(currency: string) {
  return currency.toLowerCase();
}

export function getStripeClient() {
  return new Stripe(getStripeSecretKey());
}

export async function createStripeCheckoutSession(input: StripeCheckoutInput) {
  const stripe = getStripeClient();
  const appUrl = getAppUrl();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${appUrl}/registration/success?gateway=stripe&orderId=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/registration/cancel?gateway=stripe&orderId=${input.orderId}`,
    customer_email: input.customerEmail,
    client_reference_id: input.orderId,
    metadata: {
      orderId: input.orderId,
      paymentId: input.paymentId,
      registrationId: input.registrationId,
      orderNumber: input.orderNumber,
    },
    subscription_data: {
      metadata: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        registrationId: input.registrationId,
        orderNumber: input.orderNumber,
      },
    },
    line_items: input.lineItems.map((line) => ({
      quantity: 1,
      price_data: {
        currency: toStripeCurrency(input.currency),
        product_data: {
          name: line.description,
        },
        unit_amount: line.amount * 100,
        recurring: {
          interval: "month",
        },
      },
    })),
  });
}
