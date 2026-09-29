import "server-only";
import { createBillingCycleRecords, queueManualReminders, recordBillingEvent, type AutoBillingEvent } from "@/lib/payments/billing-cycle";

import { MonthlyPaymentMethod, MonthlyPaymentStatus, PaymentGateway, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/payments/stripe";
import {
  sendAdminMonthlyPaymentActivatedEmail,
  sendMonthlyPaymentActivatedEmail,
} from "@/lib/email/notifications";
import { displayProgramTitle } from "@/lib/genm/curriculum";

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function parentName(parent: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${parent.user.firstName} ${parent.user.lastName ?? ""}`.trim() || parent.user.email;
}

function childName(student: { displayName: string | null; user: { firstName: string; lastName: string | null; email: string } }) {
  return student.displayName || [student.user.firstName, student.user.lastName].filter(Boolean).join(" ") || student.user.email;
}
function addUtcMonths(date: Date, months: number) {
  const day = Math.min(date.getUTCDate(), 28);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
}

function jsonObject(value: unknown) {
  return typeof value === "object" && value && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

export const createDueMonthlyPaymentRecords = createBillingCycleRecords;
export const sendPendingPaymentReminders = queueManualReminders;

export async function markMonthlyPaymentsActive(recordIds: string[], adminUserId: string, note?: string | null) {
  const now = new Date();
  const records = await db.monthlyPaymentRecord.findMany({
    where: { id: { in: recordIds }, status: { in: ["PENDING", "FAILED"] } },
    include: { parent: { include: { user: true } } },
  });
  if (!records.length) throw new Error("No monthly payment rows selected.");

  await db.monthlyPaymentRecord.updateMany({
    where: { id: { in: records.map((record) => record.id) } },
    data: {
      status: MonthlyPaymentStatus.ADMIN_ACTIVATED,
      paidAt: now,
      activatedAt: now,
      activatedByUserId: adminUserId,
      adminNote: note?.trim() || null,
    },
  });

  await db.billingEmailJob.updateMany({ where: { recordId: { in: records.map(r => r.id) }, kind: "MANUAL", status: "PENDING" }, data: { status: "CANCELLED" } });
  const groups = new Map<string, typeof records>();
  for (const record of records) groups.set(record.parentId + ":" + record.currency + ":" + record.monthKey, [...(groups.get(record.parentId + ":" + record.currency + ":" + record.monthKey) ?? []), record]);

  for (const parentRecords of groups.values()) {
    const first = parentRecords[0];
    if (!first) continue;
    const total = parentRecords.reduce((sum, record) => sum + record.amount, 0);
    const rows = parentRecords.map((record) => ({ childName: record.childName, programmeTitle: record.programmeTitle, amountLabel: formatMoney(record.amount, record.currency) }));
    await sendMonthlyPaymentActivatedEmail({
      toEmail: first.parent.user.email,
      parentName: parentName(first.parent),
      monthLabel: monthLabel(first.monthKey),
      totalLabel: formatMoney(total, first.currency),
      rows,
    });
    await sendAdminMonthlyPaymentActivatedEmail({
      parentName: parentName(first.parent),
      parentEmail: first.parent.user.email,
      monthLabel: monthLabel(first.monthKey),
      totalLabel: formatMoney(total, first.currency),
    });
  }

  return { updated: records.length };
}

export async function recordAutoSubscriptionPayment(input: AutoBillingEvent) { return recordBillingEvent(input); }
export async function recordAutoSubscriptionFailure(input: AutoBillingEvent) { return recordBillingEvent(input, true); }
export async function extendStripeSubscriptionBillingDate(input: {
  recordId: string;
  months: number;
  adminUserId: string;
  note?: string | null;
}) {
  const months = Math.min(12, Math.max(1, Math.round(input.months || 1)));
  const baseRecord = await db.monthlyPaymentRecord.findUnique({
    where: { id: input.recordId },
    include: {
      subscription: {
        include: {
          orderItem: {
            include: {
              order: true,
            },
          },
        },
      },
      orderItem: {
        include: {
          order: true,
          subscription: true,
        },
      },
    },
  });
  if (!baseRecord) throw new Error("Monthly payment row not found.");

  const subscriptionId = baseRecord.subscriptionId ?? baseRecord.orderItem?.subscription?.id ?? null;
  const subscription = subscriptionId
    ? await db.subscription.findUnique({
        where: { id: subscriptionId },
        include: { orderItem: { include: { order: true } } },
      })
    : null;
  const order = subscription?.orderItem.order ?? baseRecord.orderItem?.order ?? null;
  const providerSubscriptionId = subscription?.providerSubscriptionId ?? baseRecord.providerSubscriptionId ?? null;
  if (!subscription || !providerSubscriptionId || order?.gateway !== PaymentGateway.STRIPE) {
    throw new Error("Only Stripe subscription rows can be extended automatically.");
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(providerSubscriptionId);
  const stripePeriodEndSeconds =
    typeof (stripeSubscription as unknown as { current_period_end?: unknown }).current_period_end === "number"
      ? Number((stripeSubscription as unknown as { current_period_end: number }).current_period_end)
      : null;
  const currentPeriodEnd = stripePeriodEndSeconds
    ? new Date(stripePeriodEndSeconds * 1000)
    : subscription.currentPeriodEnd ?? baseRecord.billingPeriodEnd;
  const newBillingDate = addUtcMonths(currentPeriodEnd, months);
  const trialEnd = Math.floor(newBillingDate.getTime() / 1000);

  await stripe.subscriptions.update(providerSubscriptionId, {
    trial_end: trialEnd,
    proration_behavior: "none",
    metadata: {
      ...jsonObject(stripeSubscription.metadata),
      genMuminExtendedByAdmin: "true",
      genMuminExtensionMonths: String(months),
      genMuminExtensionRecordId: baseRecord.id,
    },
  });

  const now = new Date();
  await db.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      currentPeriodEnd: newBillingDate,
    },
  });

  const orderItems = await db.orderItem.findMany({
    where: { orderId: subscription.orderItem.orderId },
    include: {
      order: true,
      subscription: true,
      enrollment: {
        include: {
          parent: { include: { user: true } },
          student: { include: { user: true } },
          program: true,
        },
      },
    },
  });
  const billableItems = orderItems.filter((item) => item.enrollment);
  const creditedRecordIds: string[] = [];

  for (const item of billableItems) {
    const enrollment = item.enrollment!;
    let periodStart = baseRecord.billingPeriodEnd;
    for (let index = 0; index < months; index += 1) {
      const periodEnd = addUtcMonths(periodStart, 1);
      const key = monthKey(periodStart);
      const record = await db.monthlyPaymentRecord.upsert({
        where: { enrollmentId_monthKey: { enrollmentId: enrollment.id, monthKey: key } },
        update: {
          status: MonthlyPaymentStatus.ADMIN_ACTIVATED,
          method: MonthlyPaymentMethod.AUTO,
          gateway: PaymentGateway.STRIPE,
          providerSubscriptionId,
          activatedAt: now,
          activatedByUserId: input.adminUserId,
          adminNote: input.note?.trim() || `Stripe billing extended by ${months} month${months === 1 ? "" : "s"}.`,
          metadata: asJson({
            source: "stripe-billing-extension",
            extendedFromRecordId: baseRecord.id,
            extensionMonths: months,
            stripeNextBillingDate: newBillingDate.toISOString(),
          }),
        },
        create: {
          parentId: enrollment.parentId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          orderItemId: item.id,
          subscriptionId: item.subscription?.id ?? subscription.id,
          monthKey: key,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          dueDate: periodStart,
          status: MonthlyPaymentStatus.ADMIN_ACTIVATED,
          method: MonthlyPaymentMethod.AUTO,
          gateway: PaymentGateway.STRIPE,
          amount: item.totalAmount,
          currency: item.order.currency,
          childName: childName(enrollment.student),
          programmeTitle: displayProgramTitle(enrollment.program.title),
          providerSubscriptionId,
          activatedAt: now,
          activatedByUserId: input.adminUserId,
          adminNote: input.note?.trim() || `Stripe billing extended by ${months} month${months === 1 ? "" : "s"}.`,
          metadata: asJson({
            source: "stripe-billing-extension",
            extendedFromRecordId: baseRecord.id,
            extensionMonths: months,
            stripeNextBillingDate: newBillingDate.toISOString(),
          }),
        },
      });
      creditedRecordIds.push(record.id);
      periodStart = periodEnd;
    }
  }

  return { months, nextBillingDate: newBillingDate, creditedRows: creditedRecordIds.length };
}
export async function getParentPaymentSummary(parentUserId: string) {
  const parent = await db.parentProfile.findUnique({ where: { userId: parentUserId }, select: { id: true } });
  if (!parent) return null;
  const records = await db.monthlyPaymentRecord.findMany({
    where: { parentId: parent.id },
    orderBy: [{ dueDate: "desc" }, { childName: "asc" }],
    take: 24,
  });
  const pending = records.filter((record) => record.status === "PENDING" || record.status === "FAILED");
  return { records, pending, pendingReason: pending.length ? "Your monthly payment is pending. Please complete payment soon to keep dashboard access active." : null };
}

export async function getAdminMonthlyPaymentRecords(status?: string | null, month?: string | null) {
  const now = new Date();
  await createDueMonthlyPaymentRecords(now);
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey(now);
  return db.monthlyPaymentRecord.findMany({
    where: {
      monthKey: key,
      ...(status && status !== "ALL" ? { status: status as MonthlyPaymentStatus } : {}),
    },
    include: { parent: { include: { user: true } }, student: { include: { user: true } }, subscription: true, orderItem: { include: { order: true, subscription: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export function monthlyPaymentDisplay(record: { amount: number; currency: string }) {
  return formatMoney(record.amount, record.currency);
}

export { monthKey, monthLabel };

export async function extendStripeSubscriptionBillingDateForOrderItem(input: {
  orderItemId: string;
  months: number;
  adminUserId: string;
  note?: string | null;
}) {
  const months = Math.min(12, Math.max(1, Math.round(input.months || 1)));
  const baseItem = await db.orderItem.findUnique({
    where: { id: input.orderItemId },
    include: {
      order: true,
      subscription: true,
      enrollment: {
        include: {
          parent: { include: { user: true } },
          student: { include: { user: true } },
          program: true,
        },
      },
    },
  });
  if (!baseItem) throw new Error("Order item not found.");
  if (!baseItem.subscription?.providerSubscriptionId || baseItem.order.gateway !== PaymentGateway.STRIPE) {
    throw new Error("Only Stripe subscription order items can be extended automatically.");
  }

  const providerSubscriptionId = baseItem.subscription.providerSubscriptionId;
  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(providerSubscriptionId);
  const stripePeriodEndSeconds =
    typeof (stripeSubscription as unknown as { current_period_end?: unknown }).current_period_end === "number"
      ? Number((stripeSubscription as unknown as { current_period_end: number }).current_period_end)
      : null;
  const currentPeriodEnd = stripePeriodEndSeconds
    ? new Date(stripePeriodEndSeconds * 1000)
    : baseItem.subscription.currentPeriodEnd ?? addUtcMonths(new Date(), 1);
  const newBillingDate = addUtcMonths(currentPeriodEnd, months);

  await stripe.subscriptions.update(providerSubscriptionId, {
    trial_end: Math.floor(newBillingDate.getTime() / 1000),
    proration_behavior: "none",
    metadata: {
      ...jsonObject(stripeSubscription.metadata),
      genMuminExtendedByAdmin: "true",
      genMuminExtensionMonths: String(months),
      genMuminExtensionOrderItemId: baseItem.id,
    },
  });

  const now = new Date();
  await db.subscription.update({
    where: { id: baseItem.subscription.id },
    data: {
      status: "ACTIVE",
      currentPeriodEnd: newBillingDate,
    },
  });

  const orderItems = await db.orderItem.findMany({
    where: { orderId: baseItem.orderId },
    include: {
      order: true,
      subscription: true,
      enrollment: {
        include: {
          parent: { include: { user: true } },
          student: { include: { user: true } },
          program: true,
        },
      },
    },
  });
  const billableItems = orderItems.filter((item) => item.enrollment);
  const creditedRecordIds: string[] = [];

  for (const item of billableItems) {
    const enrollment = item.enrollment!;
    let periodStart = currentPeriodEnd;
    for (let index = 0; index < months; index += 1) {
      const periodEnd = addUtcMonths(periodStart, 1);
      const key = monthKey(periodStart);
      const record = await db.monthlyPaymentRecord.upsert({
        where: { enrollmentId_monthKey: { enrollmentId: enrollment.id, monthKey: key } },
        update: {
          status: MonthlyPaymentStatus.ADMIN_ACTIVATED,
          method: MonthlyPaymentMethod.AUTO,
          gateway: PaymentGateway.STRIPE,
          providerSubscriptionId,
          activatedAt: now,
          activatedByUserId: input.adminUserId,
          adminNote: input.note?.trim() || `Stripe billing extended from order by ${months} month${months === 1 ? "" : "s"}.`,
          metadata: asJson({
            source: "stripe-order-extension",
            extendedFromOrderItemId: baseItem.id,
            extensionMonths: months,
            stripeNextBillingDate: newBillingDate.toISOString(),
          }),
        },
        create: {
          parentId: enrollment.parentId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          orderItemId: item.id,
          subscriptionId: item.subscription?.id ?? baseItem.subscription.id,
          monthKey: key,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          dueDate: periodStart,
          status: MonthlyPaymentStatus.ADMIN_ACTIVATED,
          method: MonthlyPaymentMethod.AUTO,
          gateway: PaymentGateway.STRIPE,
          amount: item.totalAmount,
          currency: item.order.currency,
          childName: childName(enrollment.student),
          programmeTitle: displayProgramTitle(enrollment.program.title),
          providerSubscriptionId,
          activatedAt: now,
          activatedByUserId: input.adminUserId,
          adminNote: input.note?.trim() || `Stripe billing extended from order by ${months} month${months === 1 ? "" : "s"}.`,
          metadata: asJson({
            source: "stripe-order-extension",
            extendedFromOrderItemId: baseItem.id,
            extensionMonths: months,
            stripeNextBillingDate: newBillingDate.toISOString(),
          }),
        },
      });
      creditedRecordIds.push(record.id);
      periodStart = periodEnd;
    }
  }

  return { months, nextBillingDate: newBillingDate, creditedRows: creditedRecordIds.length };
}
