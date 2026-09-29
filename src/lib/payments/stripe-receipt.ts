import { db } from "@/lib/db";
import Stripe from "stripe";
export async function stripeReceiptDetails(stripe: Stripe, invoice: Stripe.Invoice) {
  let methodLabel = "Stripe automatic subscription payment";
  let receiptUrl = invoice.hosted_invoice_url;
  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 1 });
    const payment = payments.data[0]?.payment;
    let charge: Stripe.Charge | null = null;
    if (payment?.charge) charge = typeof payment.charge === "string" ? await stripe.charges.retrieve(payment.charge) : payment.charge;
    else if (payment?.payment_intent) {
      const intent = typeof payment.payment_intent === "string" ? await stripe.paymentIntents.retrieve(payment.payment_intent, { expand: ["latest_charge"] }) : payment.payment_intent;
      if (intent.latest_charge) charge = typeof intent.latest_charge === "string" ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
    }
    const details = charge?.payment_method_details;
    if (details?.card) methodLabel = "Stripe - " + details.card.brand + " card ending " + details.card.last4 + (details.card.wallet?.type ? " (" + details.card.wallet.type.replaceAll("_", " ") + ")" : "");
    else if (details?.type) methodLabel = "Stripe - " + details.type.replaceAll("_", " ");
    receiptUrl = invoice.hosted_invoice_url || charge?.receipt_url || null;
  } catch { console.warn("Stripe payment-method detail unavailable; receipt retains gateway and invoice reference."); }
  return { methodLabel, receiptUrl };
}

export async function ensureStripeBillingSubscription(stripe: Stripe, subscriptionId: string) {
  if (await db.subscription.findUnique({ where: { providerSubscriptionId: subscriptionId }, select: { id: true } })) return;
  const remote = await stripe.subscriptions.retrieve(subscriptionId);
  const orderId = remote.metadata.orderId;
  if (!orderId) throw new Error("Stripe subscription has no Gen-Mumin order reference.");
  const item = await db.orderItem.findFirst({ where: { orderId, order: { gateway: "STRIPE" } }, orderBy: { createdAt: "asc" } });
  if (!item) throw new Error("Stripe subscription order is not available yet.");
  await db.subscription.upsert({ where: { orderItemId: item.id }, update: { providerSubscriptionId: subscriptionId, status: remote.status === "active" ? "ACTIVE" : "INCOMPLETE" }, create: { orderItemId: item.id, gateway: "STRIPE", providerSubscriptionId: subscriptionId, status: remote.status === "active" ? "ACTIVE" : "INCOMPLETE" } });
}
