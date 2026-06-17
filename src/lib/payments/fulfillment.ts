import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  sendAdminPaymentCompletedEmail,
  sendDashboardUnlockedEmail,
  sendPaymentCompletedEmail,
} from "@/lib/email/notifications";
import { activateOrderEnrollments } from "@/lib/enrollment/access";
import { getStripeClient } from "@/lib/payments/stripe";

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
  await applyAdminProgramSwitch(order.id);

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

async function applyAdminProgramSwitch(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      registration: {
        include: {
          items: {
            include: {
              offer: {
                include: {
                  programs: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const metadata =
    typeof order?.metadata === "object" && order.metadata && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const change =
    typeof metadata.adminProgramChange === "object" && metadata.adminProgramChange && !Array.isArray(metadata.adminProgramChange)
      ? (metadata.adminProgramChange as Record<string, unknown>)
      : null;

  if (!order || !change || change.mode !== "switch") return;

  const studentIds = Array.isArray(change.studentIds)
    ? change.studentIds.filter((value): value is string => typeof value === "string")
    : typeof change.studentId === "string"
      ? [change.studentId]
      : [];

  if (!studentIds.length) return;

  const newProgramIds = new Set(
    order.registration?.items.flatMap((item) => item.offer.programs.map((program) => program.programId)) ?? [],
  );
  if (!newProgramIds.size) return;

  await db.enrollment.updateMany({
    where: {
      studentId: { in: studentIds },
      programId: { notIn: [...newProgramIds] },
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED"] },
    },
    data: {
      status: "CANCELLED",
    },
  });
}

export async function updateStripeSubscriptionAmount(
  orderId: string,
  input: {
    amount: number;
    currency?: string | null;
    note?: string | null;
  },
) {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Subscription amount must be greater than zero.");
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          subscription: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found.");
  }
  if (order.gateway !== "STRIPE") {
    throw new Error("Only Stripe subscriptions can be updated from this control.");
  }

  const metadataBase =
    typeof order.metadata === "object" && order.metadata && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const providerSubscriptionId =
    order.items.find((item) => item.subscription?.providerSubscriptionId)?.subscription?.providerSubscriptionId ??
    (typeof metadataBase.subscriptionId === "string" ? metadataBase.subscriptionId : null);

  if (!providerSubscriptionId) {
    throw new Error("Stripe subscription id is missing for this order.");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(providerSubscriptionId, {
    expand: ["items.data.price.product"],
  });
  const subscriptionItem = subscription.items.data[0];
  if (!subscriptionItem) {
    throw new Error("Stripe subscription has no billable item to update.");
  }

  const currentProduct = subscriptionItem.price.product;
  const product =
    typeof currentProduct === "string"
      ? await stripe.products.retrieve(currentProduct)
      : currentProduct && typeof currentProduct === "object" && "id" in currentProduct
        ? currentProduct
        : null;
  if (!product) {
    throw new Error("Stripe subscription product is missing.");
  }

  const productDeleted = "deleted" in product && product.deleted;
  const productActive = !productDeleted && "active" in product && product.active;
  const productName = !productDeleted && "name" in product ? product.name : "Gen-Mumins subscription";
  const activeProductId = productActive
    ? product.id
    : (
        await stripe.products.create({
          name: `${productName || "Gen-Mumins subscription"} - adjusted`,
          description: "Active product used for an adjusted Gen-Mumins monthly subscription amount.",
          metadata: {
            orderId,
            previousProductId: product.id,
            adjustedFromOrderNumber: order.orderNumber,
          },
        })
      ).id;

  const currency = (input.currency || order.currency).toLowerCase();
  const newPrice = await stripe.prices.create({
    currency,
    unit_amount: amount * 100,
    recurring: {
      interval: "month",
    },
    product: activeProductId,
    metadata: {
      orderId,
      adjustedFromOrderNumber: order.orderNumber,
      adjustedAt: new Date().toISOString(),
    },
  });

  await stripe.subscriptions.update(providerSubscriptionId, {
    items: [
      {
        id: subscriptionItem.id,
        price: newPrice.id,
      },
    ],
    proration_behavior: "none",
    metadata: {
      ...subscription.metadata,
      orderId,
      adjustedMonthlyAmount: String(amount),
      adjustedMonthlyCurrency: (input.currency || order.currency).toUpperCase(),
    },
  });

  const adjustedAt = new Date();
  const adjustedCurrency = (input.currency || order.currency).toUpperCase();
  const adjustedDiscountAmount = Math.max(0, order.subtotalAmount - amount);
  const metadata = {
    ...metadataBase,
    subscriptionId: providerSubscriptionId,
    subscriptionAmountAdjustment: {
      amount,
      currency: adjustedCurrency,
      note: input.note?.trim() || null,
      adjustedAt: adjustedAt.toISOString(),
      providerSubscriptionId,
      stripePriceId: newPrice.id,
    },
  };

  await db.order.update({
    where: { id: order.id },
    data: {
      currency: adjustedCurrency,
      totalAmount: amount,
      discountAmount: adjustedDiscountAmount,
      metadata,
    },
  });

  return {
    providerSubscriptionId,
    amount,
    currency: adjustedCurrency,
  };
}

export async function resendOrderCompletionEmails(
  orderId: string,
  gatewayOverride?: "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "NAYAPAY" | "SCHOLARSHIP" | "FREE",
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      registration: {
        include: {
          students: true,
          items: {
            include: {
              offer: true,
              registrationStudent: true,
            },
          },
        },
      },
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

  const registration = order.registration;
  const payment = order.payments[0];
  const gateway = gatewayOverride ?? payment?.gateway ?? order.gateway;
  const parentName = `${registration.parentFirstName} ${registration.parentLastName}`.trim();
  const childCount = await db.registrationStudent.count({
    where: { registrationId: registration.id },
  });
  const sourceLabel = registration.notes?.includes("parent-dashboard-add-program")
    ? "Parent dashboard program enrollment"
    : null;
  const programmeSummary = registration.students
    .map((student) => {
      const childName = [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || student.displayName || "Child";
      const programmes = registration.items
        .filter((item) => item.registrationStudentId === student.id)
        .map((item) => item.offer.title);
      return `${childName}: ${Array.from(new Set(programmes)).join(", ") || "Programme pending"}`;
    })
    .join("; ");

  await sendDashboardUnlockedEmail({
    toEmail: registration.parentEmail,
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
    parentEmail: registration.parentEmail,
    orderNumber: order.orderNumber,
    amount: order.totalAmount,
    currency: order.currency,
    gateway,
    childCount,
    sourceLabel,
    programmeSummary,
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

