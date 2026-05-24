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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGbp(amount: number) {
  return `GBP ${amount.toFixed(2)}`;
}

function formatPayment(amount: number, currency: string) {
  const gbp = convertAmountToGbp(amount, currency);
  return `${currency} ${amount} (${formatGbp(gbp)})`;
}

function paymentTotalLabel(totalGbp: number, count: number) {
  return `${formatGbp(totalGbp)} received from ${count} payment${count === 1 ? "" : "s"}`;
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
  const exportAll = searchParams.get("all") === "1";
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
  const scopedOrders = exportAll ? orders : orders.filter((order) => {
    const paidDate = order.paidAt ?? order.createdAt;
    return paidDate >= window.start && paidDate < window.end;
  });
  const scopedTotalGbp = scopedOrders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);

  const grouped = PAYMENT_GROUPS.map((group) => ({
    ...group,
    rows: scopedOrders
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
        const city = extractNoteValue(registration?.notes, "City");

        return {
          parent: parentName || "Parent pending",
          payment: formatPayment(order.totalAmount, order.currency),
          overview: `${children.length || 0} child${children.length === 1 ? "" : "ren"}${city ? `, ${city}` : ""}`,
          programmes: programmes.join(", ") || "Program pending",
        };
      }),
  }));

  const maxRows = Math.max(0, ...grouped.map((group) => group.rows.length));
  const groupTotals = grouped.map((group) => ({
    ...group,
    totalGbp: group.rows.reduce((sum, row) => {
      const match = row.payment.match(/\(GBP ([\d.]+)\)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0),
  }));
  const bodyRows = Array.from({ length: Math.max(maxRows, 1) }, (_, index) => `
    <tr>
      ${groupTotals.map((group) => {
        const row = group.rows[index];
        if (!row) {
          return `
            <td class="empty" colspan="4">${index === 0 && group.rows.length === 0 ? "No completed payments found" : ""}</td>
          `;
        }

        return `
          <td>${escapeHtml(row.parent)}</td>
          <td class="amount">${escapeHtml(row.payment)}</td>
          <td>${escapeHtml(row.overview)}</td>
          <td>${escapeHtml(row.programmes)}</td>
        `;
      }).join("")}
    </tr>
  `).join("");

  const workbook = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #22304a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd9e8; padding: 10px; vertical-align: top; font-size: 12px; }
    .title { background: #22304a; color: #ffffff; font-size: 22px; font-weight: 700; text-align: center; padding: 16px; }
    .summary-label { background: #eef6ff; color: #0f4d81; font-weight: 700; }
    .summary-value { background: #ffffff; font-weight: 700; }
    .method { background: #f39f5f; color: #ffffff; font-size: 16px; font-weight: 700; text-align: center; }
    .method-total { background: #fff8f0; color: #8a6326; font-weight: 700; text-align: center; }
    .subhead { background: #edf2f6; color: #22304a; font-weight: 700; }
    .amount { background: #effaf3; color: #2f6b4b; font-weight: 700; }
    .empty { background: #fbfdff; color: #8a94a3; text-align: center; font-style: italic; }
  </style>
</head>
<body>
  <table>
    <tr><th class="title" colspan="12">${escapeHtml(exportAll ? "Gen-Mumin Full Payment Records" : "Gen-Mumin Monthly Payment Records")}</th></tr>
    <tr>
      <td class="summary-label" colspan="3">Report Scope</td>
      <td class="summary-value" colspan="9">${escapeHtml(exportAll ? "All completed payments" : window.key)}</td>
    </tr>
    <tr>
      <td class="summary-label" colspan="3">Total Payment Received Yet</td>
      <td class="summary-value" colspan="9">${escapeHtml(formatGbp(allTimeTotalGbp))}</td>
    </tr>
    <tr>
      <td class="summary-label" colspan="3">${escapeHtml(exportAll ? "Total In This Export" : "Total Received This Month")}</td>
      <td class="summary-value" colspan="9">${escapeHtml(formatGbp(scopedTotalGbp))}</td>
    </tr>
    <tr><td colspan="12"></td></tr>
    <tr>
      ${groupTotals.map((group) => `<th class="method" colspan="4">${escapeHtml(group.label)}</th>`).join("")}
    </tr>
    <tr>
      ${groupTotals.map((group) => `<td class="method-total" colspan="4">${escapeHtml(paymentTotalLabel(group.totalGbp, group.rows.length))}</td>`).join("")}
    </tr>
    <tr>
      ${groupTotals.map(() => `
        <th class="subhead">Parent Name</th>
        <th class="subhead">Paid Amount</th>
        <th class="subhead">Children</th>
        <th class="subhead">Programmes</th>
      `).join("")}
    </tr>
    ${bodyRows}
  </table>
</body>
</html>`;
  const filename = exportAll
    ? `gen-mumin-all-completed-payments.xls`
    : `gen-mumin-monthly-payments-${window.key}.xls`;

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
