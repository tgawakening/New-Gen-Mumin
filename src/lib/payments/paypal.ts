import { randomUUID } from "node:crypto";

import {
  getAppUrl,
  getPayPalBaseUrl,
  getPayPalClientId,
  getPayPalClientSecret,
  getPayPalPlanId,
  getPayPalProductId,
} from "./config";

type PayPalInput = {
  orderId: string;
  paymentId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  currency: string;
  offerSlug: string;
  countryCode: string;
};

async function getAccessToken() {
  const clientId = getPayPalClientId();
  const clientSecret = getPayPalClientSecret();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with PayPal.");
  }

  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function paypalRequest<T>(path: string, accessToken: string, body: unknown) {
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "PayPal-Request-Id": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal request failed: ${text}`);
  }

  return (await response.json()) as T;
}

export async function createPayPalSubscription(input: PayPalInput) {
  const accessToken = await getAccessToken();
  const productId = getPayPalProductId();
  const planId = getPayPalPlanId({
    offerSlug: input.offerSlug,
    currency: input.currency,
    countryCode: input.countryCode,
  });

  const appUrl = getAppUrl();
  const subscription = await paypalRequest<{
    id: string;
    status: string;
    links?: Array<{ href: string; rel: string; method: string }>;
  }>("/v1/billing/subscriptions", accessToken, {
    plan_id: planId,
    custom_id: input.orderId,
    subscriber: {
      name: {
        given_name: input.customerName.split(" ")[0] || input.customerName,
        surname: input.customerName.split(" ").slice(1).join(" ") || "Parent",
      },
      email_address: input.customerEmail,
    },
    application_context: {
      brand_name: "Gen-Mumins",
      locale: "en-GB",
      shipping_preference: "NO_SHIPPING",
      user_action: "SUBSCRIBE_NOW",
      return_url: `${appUrl}/api/payments/paypal/return?orderId=${input.orderId}`,
      cancel_url: `${appUrl}/api/payments/paypal/cancel?orderId=${input.orderId}`,
    },
  });

  const approvalUrl = subscription.links?.find((link) => link.rel === "approve")?.href;
  if (!approvalUrl) {
    throw new Error("PayPal did not return an approval URL.");
  }

  return {
    subscriptionId: subscription.id,
    planId,
    productId,
    approvalUrl,
    status: subscription.status,
  };
}

export async function getPayPalSubscription(subscriptionId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch PayPal subscription details.");
  }

  return response.json();
}
