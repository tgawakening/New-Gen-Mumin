import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { completedOrderWhere } from "@/lib/payments/completed-orders";

export const dynamic = "force-dynamic";

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

function extractManualPaidAmountAdjustment(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const adjustment = (metadata as Record<string, unknown>).manualPaidAmountAdjustment;
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment)) return null;
  const record = adjustment as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    note: typeof record.note === "string" ? record.note : null,
  };
}

function safeCsvValue(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(safeCsvValue).join(",")).join("\r\n");
}

function formatAmountPaid(amount: number, currency: string, discountAmount: number) {
  const pricingLabel = discountAmount > 0 ? "Discounted price" : "Full price";
  return `${currency} ${amount} (${pricingLabel})`;
}

function formatPaymentMethod(gateway: string) {
  return gateway
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await db.order.findMany({
    where: completedOrderWhere,
    orderBy: { paidAt: "desc" },
    include: {
      parent: {
        include: {
          user: true,
        },
      },
      registration: {
        include: {
          students: true,
          items: {
            include: {
              offer: true,
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "Parent name",
      "Parent email",
      "Parent phone",
      "City",
      "Children count",
      "Children details",
      "Programs overview",
      "Amount paid",
      "Payment adjustment note",
      "Payment method",
    ],
  ];

  for (const order of orders) {
    const registration = order.registration;
    const parentName = registration
      ? formatPersonName(registration.parentFirstName, registration.parentLastName)
      : formatPersonName(order.parent.user.firstName, order.parent.user.lastName);
    const parentPhone = order.parent.user.phoneNumber
      ? `${order.parent.user.phoneCountryCode ?? ""} ${order.parent.user.phoneNumber}`.trim()
      : "Pending";
    const city = extractNoteValue(registration?.notes, "City");
    const manualPaidAmountAdjustment = extractManualPaidAmountAdjustment(order.metadata);
    const childDetails = registration?.students.map((child, index) => {
      const programs = registration.items
        .filter((item) => item.registrationStudentId === child.id)
        .map((item) => formatProgramTitle(item.offer?.title, item.offer?.slug));
      const subtitle = [
        child.age ? `Age ${child.age}` : "Age pending",
        child.gender || "Gender pending",
      ].join(" - ");

      return `${index + 1}. ${formatPersonName(child.firstName, child.lastName) || child.displayName || "Unnamed child"} (${subtitle}) - Programs: ${Array.from(new Set(programs)).join(", ") || "Pending"}`;
    }) ?? [];
    const programsOverview = Array.from(
      new Set(
        registration?.items.map((item) => formatProgramTitle(item.offer?.title, item.offer?.slug)) ?? [],
      ),
    ).join(", ");

    rows.push([
      parentName || "Parent pending",
      order.parent.user.email,
      parentPhone,
      city ?? "Pending",
      childDetails.length,
      childDetails.join("\n"),
      programsOverview,
      formatAmountPaid(order.totalAmount, order.currency, order.discountAmount),
      manualPaidAmountAdjustment
        ? [
            manualPaidAmountAdjustment.amount !== null
              ? `${manualPaidAmountAdjustment.currency ?? order.currency} ${manualPaidAmountAdjustment.amount}`
              : null,
            manualPaidAmountAdjustment.note,
          ].filter(Boolean).join(" - ")
        : "",
      formatPaymentMethod(order.gateway),
    ]);
  }

  const csv = toCsv(rows);
  const filename = `gen-mumins-completed-orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
