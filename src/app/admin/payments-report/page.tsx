import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { charityClassification, isCharityReceipt } from "@/lib/payments/charity-policy";

export const dynamic = "force-dynamic";

type Totals = Map<string, number>;
function add(totals: Totals, currency: string, amount: number) {
  const key = currency.toUpperCase();
  totals.set(key, (totals.get(key) ?? 0) + amount);
}
function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}
function totalLabel(totals: Totals) {
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => money(amount, currency)).join(" · ") || "None recorded";
}
function dateLabel(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(date) : "No dated payment recorded";
}

export default async function PaymentsReportPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) redirect("/admin");

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

  return <div className="section-container space-y-6 py-8 text-[#22304a]">
    <div className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#c27a2c]">Admin / Finance</p><h1 className="mt-2 text-3xl font-semibold">Payments report</h1><p className="mt-2 text-sm text-[#617184]">All-time recorded course payments and a read-only estimate of outstanding and next-cycle amounts.</p></div><div className="flex gap-3"><Link href="/admin/monthly-payments" className="rounded-full border px-4 py-2 text-sm font-semibold">Monthly payments</Link><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-semibold">Admin home</Link></div></div>
    </div>
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-sm text-[#617184]">Total received</h2><p className="mt-2 text-xl font-semibold">{totalLabel(received)}</p></div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-sm text-[#617184]">Total upcoming / outstanding</h2><p className="mt-2 text-xl font-semibold">{totalLabel(upcoming)}</p></div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-sm text-[#617184]">Latest recorded payment date</h2><p className="mt-2 text-xl font-semibold">{dateLabel(latest)}</p><p className="mt-1 text-xs text-[#617184]">Asia/Karachi; only dates stored as paid are used.</p></div>
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Received by method</h2><div className="mt-3 space-y-2 text-sm">{[...methods].sort(([a], [b]) => a.localeCompare(b)).map(([method, totals]) => <p key={method}><strong>{method.replaceAll("_", " ")}:</strong> {totalLabel(totals)}</p>)}{!methods.size && <p>None recorded.</p>}</div></div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Upcoming and outstanding</h2><div className="mt-3 space-y-2 text-sm"><p><strong>Next cycle, active subscriptions:</strong> {totalLabel(expected)}</p><p><strong>Pending / under review:</strong> {totalLabel(pending)}</p><p><strong>Failed:</strong> {totalLabel(failed)}</p></div></div>
    </section>
    <section className="rounded-2xl border bg-white p-5 text-sm leading-7 text-[#526274]"><h2 className="text-lg font-semibold text-[#22304a]">Billing dates and report scope</h2><p>There is no single last-payment date. Stripe and PayPal follow each subscription’s provider schedule. Manual renewals generally follow the payment anniversary with a five-day window; from November 2026, Pakistani manual fees are due on the 20th, with named family exceptions due on the 10th (Asia/Karachi).</p><p className="mt-2">Received includes successful checkout transactions and paid or manually confirmed monthly records. Credits for extended billing are excluded. Dates and historical gateway events may be missing from the database; the latest recorded date is not a guaranteed deadline. Currencies are never converted.</p><p className="mt-2">The next-cycle estimate uses the stored order amount for locally active subscriptions, excluding those set to cancel and those with an outstanding monthly record to avoid overlap. Provider status, dates and prices may have changed without syncing. Pending and failed amounts include the latest attempt for each unpaid checkout and recorded monthly obligations; they may include overdue amounts. Manual future renewals without a pending record are not included. Charity payments are excluded.</p></section>
  </div>;
}
