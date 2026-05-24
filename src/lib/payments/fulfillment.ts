import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  sendAdminPaymentCompletedEmail,
  sendDashboardUnlockedEmail,
  sendPaymentCompletedEmail,
} from "@/lib/email/notifications";
import { activateOrderEnrollments } from "@/lib/enrollment/access";

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
    gateway?: "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "NAYAPAY";
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

  const alreadySucceeded = order.status === "SUCCEEDED" && payment.status === "SUCCEEDED";

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

  await activateOrderEnrollments(order.id);

  if (order.registration && !alreadySucceeded) {
    await resendOrderCompletionEmails(order.id, details.gateway ?? payment.gateway);
  }
}

export async function recordManualPaidAmount(
  orderId: string,
  input: {
    amount: number;
    note?: string | null;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Recorded paid amount must be zero or greater.");
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      registration: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          manualSubmission: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const payment = order.payments[0] ?? null;
  const amount = Math.round(input.amount);
  const note = input.note?.trim() || null;
  const originalTotalAmount =
    typeof order.metadata === "object" &&
    order.metadata &&
    !Array.isArray(order.metadata) &&
    typeof (order.metadata as Record<string, unknown>).originalTotalAmount === "number"
      ? Number((order.metadata as Record<string, unknown>).originalTotalAmount)
      : order.totalAmount;
  const adjustedDiscountAmount = Math.max(0, order.subtotalAmount - amount);
  const adjustedAt = new Date();
  const metadataBase =
    typeof order.metadata === "object" && order.metadata && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const metadata = {
    ...metadataBase,
    originalTotalAmount,
    manualPaidAmountAdjustment: {
      amount,
      currency: order.currency,
      note,
      adjustedAt: adjustedAt.toISOString(),
    },
  };

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        totalAmount: amount,
        discountAmount: adjustedDiscountAmount,
        metadata,
      },
    });

    if (payment) {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          amount,
          rawPayload: toJsonValue({
            ...(typeof payment.rawPayload === "object" && payment.rawPayload && !Array.isArray(payment.rawPayload)
              ? (payment.rawPayload as Record<string, unknown>)
              : {}),
            manualPaidAmountAdjustment: {
              amount,
              currency: order.currency,
              note,
              adjustedAt: adjustedAt.toISOString(),
            },
          }),
        },
      });

      if (payment.manualSubmission) {
        await tx.manualPaymentSubmission.update({
          where: { id: payment.manualSubmission.id },
          data: {
            reviewNote: note,
            reviewedAt: adjustedAt,
          },
        });
      }
    }

    if (order.registrationId) {
      await tx.registration.update({
        where: { id: order.registrationId },
        data: {
          totalAmount: amount,
          discountAmount: adjustedDiscountAmount,
          pricingSnapshot: toJsonValue({
            ...(typeof order.registration?.pricingSnapshot === "object" &&
            order.registration.pricingSnapshot &&
            !Array.isArray(order.registration.pricingSnapshot)
              ? (order.registration.pricingSnapshot as Record<string, unknown>)
              : {}),
            manualPaidAmountAdjustment: {
              amount,
              currency: order.currency,
              note,
              adjustedAt: adjustedAt.toISOString(),
            },
          }),
        },
      });
    }
  });
}

export async function resendOrderCompletionEmails(
  orderId: string,
  gatewayOverride?: "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "NAYAPAY" | "SCHOLARSHIP" | "FREE",
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

  if (!order?.registration) {
    throw new Error("Completed registration not found for this order.");
  }

  const payment = order.payments[0];
  const gateway = gatewayOverride ?? payment?.gateway ?? order.gateway;
  const parentName = `${order.registration.parentFirstName} ${order.registration.parentLastName}`.trim();
  const childCount = await db.registrationStudent.count({
    where: { registrationId: order.registration.id },
  });

  await sendDashboardUnlockedEmail({
    toEmail: order.registration.parentEmail,
    parentName,
    dashboardUrl: "/parent",
  });
  await sendPaymentCompletedEmail({
    toEmail: order.registration.parentEmail,
    parentName,
    orderNumber: order.orderNumber,
    amount: order.totalAmount,
    currency: order.currency,
    gateway,
    childCount,
  });
  await sendAdminPaymentCompletedEmail({
    parentName,
    parentEmail: order.registration.parentEmail,
    orderNumber: order.orderNumber,
    amount: order.totalAmount,
    currency: order.currency,
    gateway,
    childCount,
  });
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

