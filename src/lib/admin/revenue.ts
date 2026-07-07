import { db } from "@/lib/db";
import { convertAmountToGbp } from "@/lib/registration/catalog";

const PAID_MONTHLY_STATUSES = ["PAID", "ADMIN_ACTIVATED", "ACTIVE"] as const;

export type AdminRevenueOverview = Awaited<ReturnType<typeof getAdminRevenueOverview>>;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(value?: string | null) {
  const fallback = new Date();
  const normalized = value && /^\d{4}-\d{2}$/.test(value) ? value : monthKeyFromDate(fallback);
  const [year, month] = normalized.split("-").map(Number);
  const startsAt = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return {
    key: normalized,
    label: startsAt.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    startsAt,
    endsAt,
  };
}

function displayMethod(value?: string | null) {
  if (!value) return "Manual";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addBucket(
  buckets: Map<string, { label: string; source: string; count: number; originalAmount: number; currency: string; gbpAmount: number }>,
  key: string,
  entry: { label: string; source: string; amount: number; currency: string },
) {
  const currency = entry.currency.toUpperCase();
  const existing = buckets.get(key);
  const gbpAmount = convertAmountToGbp(entry.amount, currency);

  if (existing) {
    existing.count += 1;
    existing.originalAmount += entry.amount;
    existing.gbpAmount += gbpAmount;
    return;
  }

  buckets.set(key, {
    label: entry.label,
    source: entry.source,
    count: 1,
    originalAmount: entry.amount,
    currency,
    gbpAmount,
  });
}

export function formatRevenueGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRevenueMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency.toUpperCase() === "PKR" ? 0 : 2,
  }).format(value);
}

export async function getAdminRevenueOverview(month?: string | null) {
  const period = parseMonth(month);

  const [orders, monthlyRecords] = await Promise.all([
    db.order.findMany({
      where: {
        status: "SUCCEEDED",
        paidAt: {
          gte: period.startsAt,
          lt: period.endsAt,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        gateway: true,
        currency: true,
        totalAmount: true,
        paidAt: true,
        parent: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    db.monthlyPaymentRecord.findMany({
      where: {
        status: { in: [...PAID_MONTHLY_STATUSES] },
        OR: [
          {
            paidAt: {
              gte: period.startsAt,
              lt: period.endsAt,
            },
          },
          {
            activatedAt: {
              gte: period.startsAt,
              lt: period.endsAt,
            },
          },
          {
            paidAt: null,
            activatedAt: null,
            billingPeriodStart: {
              gte: period.startsAt,
              lt: period.endsAt,
            },
          },
        ],
      },
      select: {
        id: true,
        childName: true,
        programmeTitle: true,
        method: true,
        gateway: true,
        amount: true,
        currency: true,
        paidAt: true,
        activatedAt: true,
        billingPeriodStart: true,
        parent: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { activatedAt: "desc" }, { billingPeriodStart: "desc" }],
    }),
  ]);

  const methodBuckets = new Map<string, { label: string; source: string; count: number; originalAmount: number; currency: string; gbpAmount: number }>();
  const currencyBuckets = new Map<string, { label: string; source: string; count: number; originalAmount: number; currency: string; gbpAmount: number }>();

  for (const order of orders) {
    const currency = order.currency.toUpperCase();
    addBucket(methodBuckets, `order:${order.gateway}:${currency}`, {
      label: displayMethod(order.gateway),
      source: "Checkout orders",
      amount: order.totalAmount,
      currency,
    });
    addBucket(currencyBuckets, `currency:${currency}`, {
      label: currency,
      source: "All payments",
      amount: order.totalAmount,
      currency,
    });
  }

  for (const record of monthlyRecords) {
    const currency = record.currency.toUpperCase();
    const method = record.gateway ?? record.method;
    addBucket(methodBuckets, `monthly:${method}:${currency}`, {
      label: displayMethod(method),
      source: "Monthly ledger",
      amount: record.amount,
      currency,
    });
    addBucket(currencyBuckets, `currency:${currency}`, {
      label: currency,
      source: "All payments",
      amount: record.amount,
      currency,
    });
  }

  const orderGbp = orders.reduce((sum, order) => sum + convertAmountToGbp(order.totalAmount, order.currency), 0);
  const monthlyGbp = monthlyRecords.reduce((sum, record) => sum + convertAmountToGbp(record.amount, record.currency), 0);
  const totalGbp = orderGbp + monthlyGbp;

  const methods = Array.from(methodBuckets.values())
    .map((bucket) => ({ ...bucket, gbpAmount: roundMoney(bucket.gbpAmount), originalAmount: roundMoney(bucket.originalAmount) }))
    .sort((left, right) => right.gbpAmount - left.gbpAmount);

  const currencies = Array.from(currencyBuckets.values())
    .map((bucket) => ({ ...bucket, gbpAmount: roundMoney(bucket.gbpAmount), originalAmount: roundMoney(bucket.originalAmount) }))
    .sort((left, right) => right.gbpAmount - left.gbpAmount);

  const recentRows = [
    ...orders.slice(0, 6).map((order) => ({
      id: `order-${order.id}`,
      label: order.orderNumber,
      parentName: `${order.parent.user.firstName} ${order.parent.user.lastName}`.trim() || order.parent.user.email,
      detail: displayMethod(order.gateway),
      amount: order.totalAmount,
      currency: order.currency,
      date: order.paidAt ?? null,
    })),
    ...monthlyRecords.slice(0, 6).map((record) => ({
      id: `monthly-${record.id}`,
      label: record.childName,
      parentName: `${record.parent.user.firstName} ${record.parent.user.lastName}`.trim() || record.parent.user.email,
      detail: `${record.programmeTitle} - ${displayMethod(record.gateway ?? record.method)}`,
      amount: record.amount,
      currency: record.currency,
      date: record.paidAt ?? record.activatedAt ?? record.billingPeriodStart,
    })),
  ]
    .sort((left, right) => (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0))
    .slice(0, 8);

  return {
    period,
    totalGbp: roundMoney(totalGbp),
    orderGbp: roundMoney(orderGbp),
    monthlyGbp: roundMoney(monthlyGbp),
    orderCount: orders.length,
    monthlyRecordCount: monthlyRecords.length,
    methods,
    currencies,
    recentRows,
  };
}
