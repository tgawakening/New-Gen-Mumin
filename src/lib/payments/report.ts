import "server-only";

import { db } from "@/lib/db";
import { charityClassification, isCharityReceipt } from "@/lib/payments/charity-policy";

type Totals = Map<string, number>;
function add(totals: Totals, currency: string, amount: number) {
  const key = currency.toUpperCase();
  totals.set(key, (totals.get(key) ?? 0) + amount);
}

export async function getPaymentsReport() {
  const [transactions, monthly, subscriptions] = await Promise.all([
    db.paymentTransaction.findMany({
      where: { status: { in: ["SUCCEEDED", "INITIATED", "PENDING", "UNDER_REVIEW", "REQUIRES_ACTION", "FAILED"] } },
      select: { id: true, orderId: true, status: true, gateway: true, amount: true, currency: true, paidAt: true, createdAt: true, order: { select: { status: true, metadata: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.monthlyPaymentRecord.findMany({
      where: { status: { in: ["PAID", "ADMIN_ACTIVATED", "PENDING", "FAILED"] } },
      select: { status: true, amount: true, currency: true, gateway: true, method: true, paidAt: true, metadata: true, subscriptionId: true, orderItem: { select: { order: { select: { metadata: true } } } } },
    }),
    db.subscription.findMany({
      where: { status: "ACTIVE", cancelAtPeriodEnd: false },
      select: { id: true, orderItem: { select: { order: { select: { totalAmount: true, currency: true, metadata: true } } } } },
    }),
  ]);

  const received: Totals = new Map(), expected: Totals = new Map(), pending: Totals = new Map(), failed: Totals = new Map();
  const methods = new Map<string, Totals>();
  let latest: Date | null = null;
  function receive(currency: string, method: string, amount: number, paidAt: Date | null) {
    add(received, currency, amount);
    const group = methods.get(method) ?? new Map<string, number>();
    add(group, currency, amount); methods.set(method, group);
    if (paidAt && (!latest || paidAt > latest)) latest = paidAt;
  }
  const seenOrders = new Set<string>();
  for (const tx of transactions) {
    if (tx.status === "SUCCEEDED") {
      if (!isCharityReceipt(tx.order.metadata, tx.paidAt ?? tx.createdAt)) receive(tx.currency, tx.gateway, tx.amount, tx.paidAt);
    } else if (!seenOrders.has(tx.orderId) && tx.order.status !== "SUCCEEDED" && tx.order.status !== "REFUNDED" && !charityClassification(tx.order.metadata)) {
      add(tx.status === "FAILED" ? failed : pending, tx.currency, tx.amount);
    }
    seenOrders.add(tx.orderId);
  }
  const outstandingSubscriptions = new Set<string>();
  for (const row of monthly) {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
    if (metadata.source === "stripe-billing-extension" || metadata.source === "stripe-order-extension") continue;
    const orderMetadata = row.orderItem?.order.metadata;
    if (row.status === "PAID" || row.status === "ADMIN_ACTIVATED") {
      if (row.paidAt && !isCharityReceipt(orderMetadata, row.paidAt)) receive(row.currency, row.gateway ?? row.method, row.amount, row.paidAt);
    } else if (!charityClassification(orderMetadata)) {
      add(row.status === "FAILED" ? failed : pending, row.currency, row.amount);
      if (row.subscriptionId) outstandingSubscriptions.add(row.subscriptionId);
    }
  }
  for (const subscription of subscriptions) {
    const order = subscription.orderItem.order;
    if (!outstandingSubscriptions.has(subscription.id) && !charityClassification(order.metadata)) add(expected, order.currency, order.totalAmount);
  }
  const upcoming: Totals = new Map();
  for (const group of [expected, pending, failed]) for (const [currency, amount] of group) add(upcoming, currency, amount);

  return { received, expected, pending, failed, upcoming, methods, latest };
}
