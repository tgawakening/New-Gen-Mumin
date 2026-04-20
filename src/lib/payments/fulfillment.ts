import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function markOrderPaid(
  orderId: string,
  details: {
    providerPaymentId?: string | null;
    providerReference?: string | null;
    rawPayload?: unknown;
    gateway?: "STRIPE" | "PAYPAL";
    subscriptionId?: string | null;
  },
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      registration: true,
      items: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const payment = order.payments[0];
  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  await db.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      providerPaymentId: details.providerPaymentId ?? payment.providerPaymentId,
      providerReference: details.providerReference ?? payment.providerReference,
      rawPayload: toJsonValue(details.rawPayload),
      paidAt: new Date(),
    },
  });

  await db.order.update({
    where: { id: order.id },
    data: {
      status: "SUCCEEDED",
      providerReference: details.providerReference ?? order.providerReference,
      paidAt: new Date(),
      metadata: {
        ...(typeof order.metadata === "object" && order.metadata ? order.metadata as object : {}),
        subscriptionId: details.subscriptionId ?? null,
      },
    },
  });

  if (order.registrationId) {
    await db.registration.update({
      where: { id: order.registrationId },
      data: {
        status: "PAID",
      },
    });
  }

  if (details.subscriptionId && order.items[0]) {
    await db.subscription.upsert({
      where: { orderItemId: order.items[0].id },
      update: {
        gateway: details.gateway ?? payment.gateway,
        status: "ACTIVE",
        providerSubscriptionId: details.subscriptionId,
        currentPeriodStart: new Date(),
      },
      create: {
        orderItemId: order.items[0].id,
        gateway: details.gateway ?? payment.gateway,
        status: "ACTIVE",
        providerSubscriptionId: details.subscriptionId,
        currentPeriodStart: new Date(),
      },
    });
  }
}

export async function markOrderCancelled(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, registrationId: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });

  if (!order) return;

  if (order.payments[0]) {
    await db.paymentTransaction.update({
      where: { id: order.payments[0].id },
      data: { status: "FAILED", failureReason: "Checkout cancelled by user." },
    });
  }

  await db.order.update({
    where: { id: order.id },
    data: { status: "FAILED" },
  });

  if (order.registrationId) {
    await db.registration.update({
      where: { id: order.registrationId },
      data: { status: "CANCELLED" },
    });
  }
}

