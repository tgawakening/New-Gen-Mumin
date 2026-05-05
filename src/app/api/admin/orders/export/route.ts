import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

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

function formatDate(value?: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function safeCsvValue(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(safeCsvValue).join(",")).join("\r\n");
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await db.order.findMany({
    where: {
      status: "SUCCEEDED",
    },
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
      "Children count",
      "Children details",
      "Programs overview",
      "Amount paid",
      "Currency",
      "Pricing type",
      "Discount amount",
      "Payment method",
      "Payment status",
      "Order number",
      "Paid at",
      "Registration status",
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
    const latestPayment = order.payments[0] ?? null;

    rows.push([
      parentName || "Parent pending",
      order.parent.user.email,
      parentPhone,
      childDetails.length,
      childDetails.join("\n"),
      programsOverview,
      order.totalAmount,
      order.currency,
      order.discountAmount > 0 ? "Discounted" : "Full price",
      order.discountAmount,
      order.gateway,
      latestPayment?.status ?? order.status,
      order.orderNumber,
      formatDate(order.paidAt ?? order.updatedAt),
      registration?.status ?? "Pending",
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
