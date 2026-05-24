import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { convertAmountToGbp } from "@/lib/registration/catalog";

export const dynamic = "force-dynamic";

const PAYMENT_GROUPS = [
  { key: "STRIPE", label: "Stripe" },
  { key: "PAYPAL", label: "PayPal" },
  { key: "BANK_TRANSFER", label: "Bank Transfer" },
] as const;

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName === "Parent" ? "" : lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatProgramTitle(title?: string | null, slug?: string | null) {
  if (slug === "full-bundle" || title === "Gen-Mumins Full Bundle") {
    return "Gen-Mumin Bundle";
  }

  return title || "Program pending";
}

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const entry = notes
    .split(/\s*\|\s*|\r?\n/)
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return entry ? entry.split(":").slice(1).join(":").trim() : null;
}

function safeCsvValue(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(safeCsvValue).join(",")).join("\r\n");
}

function formatGbp(amount: number) {
  return `GBP ${amount.toFixed(2)}`;
}

function formatPayment(amount: number, currency: string) {
  const gbp = convertAmountToGbp(amount, currency);
  return `${currency} ${amount} (${formatGbp(gbp)})`;
}

function monthWindow(monthParam: string | null) {
  const now = new Date();
  const normalized = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : now.toISOString().slice(0, 7);
  const [year, month] = normalized.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { key: normalized, start, end };
}

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const window = monthWindow(searchParams.get("month"));
  const orders = await db.order.findMany({
    where: { status: "SUCCEEDED" },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: {
      parent: { include: { user: true } },
      registration: {
        include: {
          students: true,
          items: { include: { offer: true } },
        },
      },
    },
  });

  const allTimeTotalGbp = orders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);
  const monthOrders = orders.filter((order) => {
    const paidDate = order.paidAt ?? order.createdAt;
    return paidDate >= window.start && paidDate < window.end;
  });
  const monthTotalGbp = monthOrders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);

  const grouped = PAYMENT_GROUPS.map((group) => ({
    ...group,
    rows: monthOrders
      .filter((order) => order.gateway === group.key)
      .map((order) => {
        const registration = order.registration;
        const children = registration?.students ?? [];
        const programmes = Array.from(
          new Set(registration?.items.map((item) => formatProgramTitle(item.offer?.title, item.offer?.slug)) ?? []),
        );
        const parentName = registration
          ? formatPersonName(registration.parentFirstName, registration.parentLastName)
          : formatPersonName(order.parent.user.firstName, order.parent.user.lastName);
        const paidDate = order.paidAt ?? order.createdAt;
        const city = extractNoteValue(registration?.notes, "City");

        return {
          parent: parentName || "Parent pending",
          payment: formatPayment(order.totalAmount, order.currency),
          overview: `${children.length || 0} child${children.length === 1 ? "" : "ren"}${city ? `, ${city}` : ""}`,
          programmes: programmes.join(", ") || "Program pending",
          order: order.orderNumber,
          date: paidDate.toISOString().slice(0, 10),
        };
      }),
  }));

  const maxRows = Math.max(0, ...grouped.map((group) => group.rows.length));
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Gen-Mumin monthly payment record"],
    ["Month", window.key],
    ["Total payment received yet", formatGbp(allTimeTotalGbp)],
    ["Total received this month", formatGbp(monthTotalGbp)],
    [],
    [
      "Stripe parent",
      "Stripe payment",
      "Stripe children",
      "Stripe programmes",
      "Stripe order/date",
      "PayPal parent",
      "PayPal payment",
      "PayPal children",
      "PayPal programmes",
      "PayPal order/date",
      "Bank Transfer parent",
      "Bank Transfer payment",
      "Bank Transfer children",
      "Bank Transfer programmes",
      "Bank Transfer order/date",
    ],
  ];

  for (let index = 0; index < maxRows; index += 1) {
    rows.push(grouped.flatMap((group) => {
      const row = group.rows[index];
      return row
        ? [row.parent, row.payment, row.overview, row.programmes, `${row.order} / ${row.date}`]
        : ["", "", "", "", ""];
    }));
  }

  if (maxRows === 0) {
    rows.push(["No completed payments found for this month."]);
  }

  const csv = toCsv(rows);
  const filename = `gen-mumin-monthly-payments-${window.key}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
