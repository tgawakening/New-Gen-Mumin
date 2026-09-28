import "server-only";
import { PaymentGateway, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isCharityReceipt } from "@/lib/payments/charity-policy";

// Original receipts stay in Gen-M unless explicitly reclassified.
export async function charityOriginalOrderIds() {
  const rows = await db.order.findMany({
    where: { metadata: { path: "$.tgaCharity.includeOriginalPayment", equals: true } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function recordCharitySubscriptionPayment(input: {
  providerSubscriptionId: string; providerInvoiceId?: string | null;
  amount?: number | null; currency?: string | null; paidAt?: Date | null;
  failedAt?: Date | null; rawPayload?: unknown; gateway: PaymentGateway;
}, failed = false) {
  const subscription = await db.subscription.findUnique({
    where: { providerSubscriptionId: input.providerSubscriptionId },
    include: { orderItem: { include: { order: true } } },
  });
  if (!subscription) return false;
  const order = subscription.orderItem.order;
  const eventDate = input.paidAt ?? input.failedAt ?? new Date();
  if (!isCharityReceipt(order.metadata, eventDate)) return false;
  if (!input.providerInvoiceId) throw new Error("Charity payment requires a provider transaction reference.");
  const amount = input.amount ?? order.totalAmount;
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid charity amount.");
  const sourceKey = input.gateway + ":" + input.providerInvoiceId + (failed ? ":failed" : ":paid");
  await db.charityPayment.upsert({
    where: { sourceKey }, update: {},
    create: {
      sourceKey, orderId: order.id, providerSubscriptionId: input.providerSubscriptionId,
      gateway: input.gateway, status: failed ? "FAILED" : "SUCCEEDED",
      amount, currency: (input.currency || order.currency).toUpperCase(),
      paidAt: failed ? null : eventDate,
      metadata: input.rawPayload as Prisma.InputJsonValue | undefined,
    },
  });
  return true;
}
