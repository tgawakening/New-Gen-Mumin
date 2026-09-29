import "server-only";
import { createHash } from "node:crypto";
import { PaymentGateway } from "@prisma/client";
import { db } from "@/lib/db";
import { getBillingTargets } from "@/lib/payments/billing-targets";
import { allocateAmount, DAY, recurringPeriod, reminderStage, trustedReceiptUrl } from "@/lib/payments/billing-policy";
import { money, queueBillingReceipt } from "@/lib/payments/billing-mail";
import { recordCharitySubscriptionPayment } from "@/lib/payments/charity";

export async function createBillingCycleRecords(now = new Date(), parentId?: string) {
  const targets = await getBillingTargets(parentId);
  const selected = new Set(targets.map(t => t.item.id));
  const old = await db.monthlyPaymentRecord.findMany({ where: { ...(parentId ? { parentId } : {}), status: "PENDING", method: "MANUAL" }, select: { id: true, orderItemId: true } });
  const superseded = old.filter(r => !r.orderItemId || !selected.has(r.orderItemId)).map(r => r.id);
  if (superseded.length) await db.monthlyPaymentRecord.updateMany({ where: { id: { in: superseded }, status: "PENDING" }, data: { status: "CANCELLED", adminNote: "Superseded by latest completed programme selection or inactive enrolment." } });
  let created = 0;
  for (const target of targets) {
    const { item, student, subscription } = target;
    const manual = ["BANK_TRANSFER", "NAYAPAY"].includes(item.order.gateway);
    // Automatic fees come only from gateway events; an anniversary alone is not proof of a debt.
    if (!manual) continue;
    if (target.amount <= 0) continue;
    const anchor = item.order.paidAt ?? item.order.createdAt;
    const period = recurringPeriod(anchor, now);
    // The original completed order already pays for the first billing period.
    if (period.start <= anchor || period.start.toISOString().slice(0,10) === anchor.toISOString().slice(0,10)) continue;
    const billingKey = "cycle:" + createHash("sha256").update(student.id + ":" + target.programs.slice().sort().join(",") + ":" + period.key).digest("hex");
    const legacy = await db.monthlyPaymentRecord.findFirst({ where: { orderItemId: item.id, monthKey: period.key }, orderBy: [{ paidAt: "desc" }, { createdAt: "asc" }] });
    if (legacy) {
      // Keep confirmed payments. Adopt a single unpaid row instead of creating duplicates.
      if (["PAID", "ADMIN_ACTIVATED", "ACTIVE"].includes(legacy.status)) continue;
      if (legacy.billingKey !== billingKey && legacy.status === "PENDING") {
        const existing = await db.monthlyPaymentRecord.findUnique({ where: { billingKey } });
        if (!existing) await db.monthlyPaymentRecord.update({ where: { id: legacy.id }, data: { billingKey, method: manual ? "MANUAL" : "AUTO", dueDate: manual ? period.due : period.start, amount: target.amount, programmeTitle: target.programmeTitle, billingPeriodStart: period.start, billingPeriodEnd: period.end } });
      }
      await db.monthlyPaymentRecord.updateMany({ where: { orderItemId: item.id, monthKey: period.key, id: { not: legacy.id }, status: "PENDING", billingKey: null }, data: { status: "CANCELLED", adminNote: "Duplicate pending billing row superseded." } });
      continue;
    }
    await db.monthlyPaymentRecord.upsert({ where: { billingKey }, update: {}, create: {
      billingKey, parentId: item.order.parentId, studentId: student.id, orderItemId: item.id,
      subscriptionId: subscription?.id, providerSubscriptionId: subscription?.providerSubscriptionId,
      monthKey: period.key, billingPeriodStart: period.start, billingPeriodEnd: period.end,
      dueDate: manual ? period.due : period.start, status: "PENDING", method: manual ? "MANUAL" : "AUTO", gateway: item.order.gateway,
      amount: target.amount, currency: item.order.currency, childName: target.childName, programmeTitle: target.programmeTitle,
      metadata: { source: "billing-cycle-v2", orderNumber: item.order.orderNumber },
    } }); created++;
  }
  return { created };
}

export async function queueManualReminders(now = new Date()) {
  const records = await db.monthlyPaymentRecord.findMany({ where: { method: "MANUAL", status: "PENDING", billingKey: { not: null }, billingPeriodStart: { lte: now }, billingPeriodEnd: { gt: now } }, include: { parent: { include: { user: true } } } });
  for (const record of records) {
    const stage = reminderStage(record.billingPeriodStart, now)!;
    // Cancel older queued reminder stages so a provider outage cannot cause a burst.
    const key = "billing:manual:" + record.id + ":" + stage;
    await db.billingEmailJob.updateMany({ where: { recordId: record.id, kind: "MANUAL", status: "PENDING", key: { not: key } }, data: { status: "CANCELLED" } });
    await db.billingEmailJob.upsert({ where: { key }, update: {}, create: { key, kind: "MANUAL", recordId: record.id, toEmail: record.parent.user.email, payload: { stage } } });
  }
  return { reminded: records.length };
}

export type AutoBillingEvent = {
  providerSubscriptionId: string; providerInvoiceId?: string | null; amount?: number | null;
  currency?: string | null; paidAt?: Date | null; failedAt?: Date | null; rawPayload?: unknown;
  gateway: PaymentGateway; receiptUrl?: string | null; methodLabel?: string | null;
  periodStart?: Date; periodEnd?: Date; initialPayment?: boolean;
};
export async function recordBillingEvent(input: AutoBillingEvent, failed = false) {
  if (await recordCharitySubscriptionPayment(input, failed)) return { updated: 1 };
  if (!input.providerInvoiceId) throw new Error("Missing billing transaction reference.");
  const subscription = await db.subscription.findUnique({ where: { providerSubscriptionId: input.providerSubscriptionId }, include: { orderItem: { include: { order: { include: { parent: { include: { user: true } } } } } } } });
  if (!subscription) throw new Error("Subscription mapping not ready; gateway should retry this event.");
  const order = subscription.orderItem.order;
  const targets = await getBillingTargets(undefined, order.id);
  // Receipt delivery does not depend on an enrolment FK being populated.
  const eventDate = input.paidAt ?? input.failedAt ?? new Date();
  const amount = input.amount ?? (failed ? order.totalAmount : null);
  if (amount == null || !Number.isFinite(amount) || amount < 0) throw new Error("Missing or invalid confirmed payment amount.");
  const currency = (input.currency ?? order.currency).toUpperCase();
  const amounts = allocateAmount(amount, targets.map(t => t.amount));
  const period = recurringPeriod(order.paidAt ?? order.createdAt, eventDate);
  const initial = input.initialPayment ?? (order.paidAt ? Math.abs(eventDate.getTime() - order.paidAt.getTime()) < DAY : false);
  let updated = 0;
  if (!initial) for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    const billingKey = "auto:" + createHash("sha256").update(input.gateway + ":" + input.providerInvoiceId + ":" + target.item.id).digest("hex");
    const data = { status: failed ? "FAILED" as const : "PAID" as const, amount: amounts[index], paidAt: failed ? null : eventDate, metadata: { receiptUrl: trustedReceiptUrl(input.receiptUrl), paymentMethod: input.methodLabel ?? input.gateway, transactionId: input.providerInvoiceId } };
    await db.$transaction(async tx => {
      const existing = await tx.monthlyPaymentRecord.findUnique({ where: { billingKey } });
      if (failed && existing && ["PAID", "ADMIN_ACTIVATED", "ACTIVE"].includes(existing.status)) return;
      await tx.monthlyPaymentRecord.upsert({ where: { billingKey }, update: data, create: {
        ...data, billingKey, parentId: order.parentId, studentId: target.student.id, orderItemId: target.item.id,
        subscriptionId: subscription.id, providerSubscriptionId: input.providerSubscriptionId, providerInvoiceId: input.providerInvoiceId,
        monthKey: (input.periodStart ?? period.start).toISOString().slice(0,7), billingPeriodStart: input.periodStart ?? period.start, billingPeriodEnd: input.periodEnd ?? period.end,
        dueDate: input.periodStart ?? period.start, method: "AUTO", gateway: input.gateway, currency,
        childName: target.childName, programmeTitle: target.programmeTitle,
      } });
      if (!failed) await tx.monthlyPaymentRecord.updateMany({ where: { orderItemId: target.item.id, monthKey: (input.periodStart ?? period.start).toISOString().slice(0,7), status: { in: ["PENDING", "FAILED"] }, billingKey: { not: billingKey } }, data: { status: "CANCELLED", adminNote: "Replaced by confirmed gateway payment " + input.providerInvoiceId } });
    }); updated++;
  }
  if (!failed && amount > 0) {
    const parent = order.parent.user;
    await queueBillingReceipt("billing:receipt:" + input.gateway + ":" + input.providerInvoiceId, {
      toEmail: parent.email, parentName: [parent.firstName, parent.lastName].filter(Boolean).join(" "),
      monthLabel: (input.periodStart ?? eventDate).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Karachi" }),
      totalLabel: money(amount, currency), gatewayLabel: input.methodLabel || (input.gateway === "STRIPE" ? "Stripe automatic payment" : "PayPal automatic payment"),
      paidAtLabel: eventDate.toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "long", timeStyle: "short" }) + " PKT",
      reference: input.providerInvoiceId, orderNumber: order.orderNumber, receiptUrl: trustedReceiptUrl(input.receiptUrl),
      rows: targets.length ? targets.map((t, i) => ({ childName: t.childName, programmeTitle: t.programmeTitle, amountLabel: money(amounts[i], currency) })) : [{ childName: "Your learner", programmeTitle: subscription.orderItem.description, amountLabel: money(amount, currency) }],
    });
  }
  return { updated };
}
