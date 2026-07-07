import "server-only";

import { MonthlyPaymentMethod, MonthlyPaymentStatus, PaymentGateway, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  sendAdminMonthlyPaymentActivatedEmail,
  sendMonthlyPaymentActivatedEmail,
  sendMonthlyPaymentPendingEmail,
  sendMonthlyPaymentReceiptEmail,
} from "@/lib/email/notifications";
import { displayProgramTitle } from "@/lib/genm/curriculum";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const MANUAL_GATEWAYS: PaymentGateway[] = ["BANK_TRANSFER", "NAYAPAY"];
const AUTO_GATEWAYS: PaymentGateway[] = ["STRIPE", "PAYPAL"];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function parentName(parent: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${parent.user.firstName} ${parent.user.lastName ?? ""}`.trim() || parent.user.email;
}

function childName(student: { displayName: string | null; user: { firstName: string; lastName: string | null; email: string } }) {
  return student.displayName || `${student.user.firstName} ${student.user.lastName ?? ""}`.trim() || student.user.email;
}

function billingPeriod(anchor: Date, now: Date) {
  const day = Math.min(anchor.getUTCDate(), 28);
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  if (start.getTime() > now.getTime()) {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day));
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, day));
  return { start, end, key: monthKey(start) };
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

async function getEnrollmentBillingRows(parentId?: string) {
  return db.enrollment.findMany({
    where: {
      ...(parentId ? { parentId } : {}),
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
    },
    include: {
      parent: { include: { user: true } },
      student: { include: { user: true } },
      program: true,
      orderItems: {
        include: {
          order: true,
          subscription: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

function latestBillableOrderItem(enrollment: Awaited<ReturnType<typeof getEnrollmentBillingRows>>[number]) {
  return enrollment.orderItems.find((item) => item.order.status === "SUCCEEDED") ?? enrollment.orderItems[0] ?? null;
}

function methodFor(gateway: PaymentGateway | null | undefined, hasSubscription: boolean) {
  if (gateway && AUTO_GATEWAYS.includes(gateway) && hasSubscription) return MonthlyPaymentMethod.AUTO;
  return MonthlyPaymentMethod.MANUAL;
}

async function sendGroupedPendingEmails(recordIds: string[], reminder = false) {
  if (!recordIds.length) return;
  const records = await db.monthlyPaymentRecord.findMany({
    where: { id: { in: recordIds } },
    include: { parent: { include: { user: true } } },
  });
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    groups.set(record.parentId, [...(groups.get(record.parentId) ?? []), record]);
  }

  for (const parentRecords of groups.values()) {
    const first = parentRecords[0];
    if (!first) continue;
    const total = parentRecords.reduce((sum, record) => sum + record.amount, 0);
    await sendMonthlyPaymentPendingEmail({
      toEmail: first.parent.user.email,
      parentName: parentName(first.parent),
      monthLabel: monthLabel(first.monthKey),
      totalLabel: formatMoney(total, first.currency),
      reminder,
      rows: parentRecords.map((record) => ({
        childName: record.childName,
        programmeTitle: record.programmeTitle,
        amountLabel: formatMoney(record.amount, record.currency),
      })),
    });
  }
}

async function sendGroupedReceiptEmails(recordIds: string[], gatewayLabel: string) {
  if (!recordIds.length) return;
  const records = await db.monthlyPaymentRecord.findMany({
    where: { id: { in: recordIds } },
    include: { parent: { include: { user: true } } },
  });
  const groups = new Map<string, typeof records>();
  for (const record of records) groups.set(record.parentId, [...(groups.get(record.parentId) ?? []), record]);

  for (const parentRecords of groups.values()) {
    const first = parentRecords[0];
    if (!first) continue;
    const total = parentRecords.reduce((sum, record) => sum + record.amount, 0);
    await sendMonthlyPaymentReceiptEmail({
      toEmail: first.parent.user.email,
      parentName: parentName(first.parent),
      monthLabel: monthLabel(first.monthKey),
      totalLabel: formatMoney(total, first.currency),
      gatewayLabel,
      rows: parentRecords.map((record) => ({
        childName: record.childName,
        programmeTitle: record.programmeTitle,
        amountLabel: formatMoney(record.amount, record.currency),
      })),
    });
  }
}

export async function createDueMonthlyPaymentRecords(now = new Date(), parentId?: string) {
  const enrollments = await getEnrollmentBillingRows(parentId);
  const createdPendingIds: string[] = [];

  for (const enrollment of enrollments) {
    const orderItem = latestBillableOrderItem(enrollment);
    if (!orderItem) continue;
    const anchor = enrollment.startedAt ?? enrollment.completedAt ?? orderItem.order.paidAt ?? enrollment.createdAt;
    const period = billingPeriod(anchor, now);
    if (period.start.getTime() > now.getTime()) continue;
    const hasSubscription = Boolean(orderItem.subscription?.providerSubscriptionId);
    const method = methodFor(orderItem.order.gateway, hasSubscription);
    const providerSubscriptionId = orderItem.subscription?.providerSubscriptionId ?? null;

    const existing = await db.monthlyPaymentRecord.findUnique({
      where: { enrollmentId_monthKey: { enrollmentId: enrollment.id, monthKey: period.key } },
    });
    if (existing) continue;

    const status = method === MonthlyPaymentMethod.MANUAL ? MonthlyPaymentStatus.PENDING : MonthlyPaymentStatus.PENDING;
    const record = await db.monthlyPaymentRecord.create({
      data: {
        parentId: enrollment.parentId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        orderItemId: orderItem.id,
        subscriptionId: orderItem.subscription?.id ?? null,
        monthKey: period.key,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        dueDate: period.start,
        status,
        method,
        gateway: orderItem.order.gateway,
        amount: orderItem.totalAmount,
        currency: orderItem.order.currency,
        childName: childName(enrollment.student),
        programmeTitle: displayProgramTitle(enrollment.program.title),
        providerSubscriptionId,
        pendingNotifiedAt: method === MonthlyPaymentMethod.MANUAL ? now : null,
        metadata: asJson({ source: "monthly-ledger", orderId: orderItem.orderId, orderNumber: orderItem.order.orderNumber }),
      },
    });
    if (method === MonthlyPaymentMethod.MANUAL) createdPendingIds.push(record.id);
  }

  await sendGroupedPendingEmails(createdPendingIds, false);
  return { created: createdPendingIds.length };
}

export async function sendPendingPaymentReminders(now = new Date()) {
  const cutoff = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const records = await db.monthlyPaymentRecord.findMany({
    where: {
      status: { in: [MonthlyPaymentStatus.PENDING, MonthlyPaymentStatus.FAILED] },
      dueDate: { lte: cutoff },
      reminderSentAt: null,
    },
    select: { id: true },
  });
  const ids = records.map((record) => record.id);
  await sendGroupedPendingEmails(ids, true);
  if (ids.length) {
    await db.monthlyPaymentRecord.updateMany({ where: { id: { in: ids } }, data: { reminderSentAt: now } });
  }
  return { reminded: ids.length };
}

export async function markMonthlyPaymentsActive(recordIds: string[], adminUserId: string, note?: string | null) {
  const now = new Date();
  const records = await db.monthlyPaymentRecord.findMany({
    where: { id: { in: recordIds } },
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

  const groups = new Map<string, typeof records>();
  for (const record of records) groups.set(record.parentId, [...(groups.get(record.parentId) ?? []), record]);

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

export async function recordAutoSubscriptionPayment(input: {
  providerSubscriptionId: string;
  providerInvoiceId?: string | null;
  amount?: number | null;
  currency?: string | null;
  paidAt?: Date | null;
  rawPayload?: unknown;
  gateway: PaymentGateway;
}) {
  const subscription = await db.subscription.findUnique({
    where: { providerSubscriptionId: input.providerSubscriptionId },
    include: { orderItem: true },
  });
  if (!subscription) return { updated: 0 };

  const orderItems = await db.orderItem.findMany({
    where: { orderId: subscription.orderItem.orderId },
    include: {
      order: true,
      subscription: true,
      enrollment: { include: { parent: { include: { user: true } }, student: { include: { user: true } }, program: true } },
    },
  });
  const billableItems = orderItems.filter((item) => item.enrollment);
  if (!billableItems.length) return { updated: 0 };

  const paidAt = input.paidAt ?? new Date();
  const totalOrderAmount = billableItems.reduce((sum, item) => sum + item.totalAmount, 0) || 1;
  const paidTotal = input.amount ? Math.round(input.amount) : totalOrderAmount;
  const recordIds: string[] = [];

  for (const item of billableItems) {
    const enrollment = item.enrollment!;
    const period = billingPeriod(enrollment.startedAt ?? enrollment.createdAt, paidAt);
    const proportionalAmount = input.amount ? Math.round((item.totalAmount / totalOrderAmount) * paidTotal) : item.totalAmount;
    const currency = (input.currency || item.order.currency).toUpperCase();
    const record = await db.monthlyPaymentRecord.upsert({
      where: { enrollmentId_monthKey: { enrollmentId: enrollment.id, monthKey: period.key } },
      update: {
        status: MonthlyPaymentStatus.PAID,
        method: MonthlyPaymentMethod.AUTO,
        gateway: input.gateway,
        amount: proportionalAmount,
        currency,
        providerSubscriptionId: input.providerSubscriptionId,
        providerInvoiceId: input.providerInvoiceId ?? null,
        paidAt,
        receiptSentAt: new Date(),
        metadata: asJson(input.rawPayload),
      },
      create: {
        parentId: enrollment.parentId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        orderItemId: item.id,
        subscriptionId: item.subscription?.id ?? subscription.id,
        monthKey: period.key,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        dueDate: period.start,
        status: MonthlyPaymentStatus.PAID,
        method: MonthlyPaymentMethod.AUTO,
        gateway: input.gateway,
        amount: proportionalAmount,
        currency,
        childName: childName(enrollment.student),
        programmeTitle: displayProgramTitle(enrollment.program.title),
        providerSubscriptionId: input.providerSubscriptionId,
        providerInvoiceId: input.providerInvoiceId ?? null,
        paidAt,
        receiptSentAt: new Date(),
        metadata: asJson(input.rawPayload),
      },
    });
    recordIds.push(record.id);
  }

  await sendGroupedReceiptEmails(recordIds, input.gateway === "STRIPE" ? "Stripe" : "PayPal");
  return { updated: recordIds.length };
}
export async function recordAutoSubscriptionFailure(input: {
  providerSubscriptionId: string;
  providerInvoiceId?: string | null;
  amount?: number | null;
  currency?: string | null;
  failedAt?: Date | null;
  rawPayload?: unknown;
  gateway: PaymentGateway;
}) {
  const subscription = await db.subscription.findUnique({
    where: { providerSubscriptionId: input.providerSubscriptionId },
    include: { orderItem: true },
  });
  if (!subscription) return { updated: 0 };

  const orderItems = await db.orderItem.findMany({
    where: { orderId: subscription.orderItem.orderId },
    include: {
      order: true,
      subscription: true,
      enrollment: { include: { parent: { include: { user: true } }, student: { include: { user: true } }, program: true } },
    },
  });
  const billableItems = orderItems.filter((item) => item.enrollment);
  if (!billableItems.length) return { updated: 0 };

  const failedAt = input.failedAt ?? new Date();
  const totalOrderAmount = billableItems.reduce((sum, item) => sum + item.totalAmount, 0) || 1;
  const failedTotal = input.amount ? Math.round(input.amount) : totalOrderAmount;
  const recordIds: string[] = [];

  for (const item of billableItems) {
    const enrollment = item.enrollment!;
    const period = billingPeriod(enrollment.startedAt ?? enrollment.createdAt, failedAt);
    const proportionalAmount = input.amount ? Math.round((item.totalAmount / totalOrderAmount) * failedTotal) : item.totalAmount;
    const currency = (input.currency || item.order.currency).toUpperCase();
    const record = await db.monthlyPaymentRecord.upsert({
      where: { enrollmentId_monthKey: { enrollmentId: enrollment.id, monthKey: period.key } },
      update: {
        status: MonthlyPaymentStatus.FAILED,
        method: MonthlyPaymentMethod.AUTO,
        gateway: input.gateway,
        amount: proportionalAmount,
        currency,
        providerSubscriptionId: input.providerSubscriptionId,
        providerInvoiceId: input.providerInvoiceId ?? null,
        failureNotifiedAt: failedAt,
        metadata: asJson(input.rawPayload),
      },
      create: {
        parentId: enrollment.parentId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        orderItemId: item.id,
        subscriptionId: item.subscription?.id ?? subscription.id,
        monthKey: period.key,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        dueDate: period.start,
        status: MonthlyPaymentStatus.FAILED,
        method: MonthlyPaymentMethod.AUTO,
        gateway: input.gateway,
        amount: proportionalAmount,
        currency,
        childName: childName(enrollment.student),
        programmeTitle: displayProgramTitle(enrollment.program.title),
        providerSubscriptionId: input.providerSubscriptionId,
        providerInvoiceId: input.providerInvoiceId ?? null,
        failureNotifiedAt: failedAt,
        metadata: asJson(input.rawPayload),
      },
    });
    recordIds.push(record.id);
  }

  await sendGroupedPendingEmails(recordIds, false);
  return { updated: recordIds.length };
}
export async function getParentPaymentSummary(parentUserId: string) {
  const parent = await db.parentProfile.findUnique({ where: { userId: parentUserId }, select: { id: true } });
  if (!parent) return null;
  await createDueMonthlyPaymentRecords(new Date(), parent.id);
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
    include: { parent: { include: { user: true } }, student: { include: { user: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export function monthlyPaymentDisplay(record: { amount: number; currency: string }) {
  return formatMoney(record.amount, record.currency);
}

export { monthKey, monthLabel };