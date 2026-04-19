import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import type { RegistrationCheckoutPayload } from "@/lib/registration/payment-schema";

function createOrderNumber() {
  return `GM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createCheckoutDraft(
  registrationId: string,
  payload: RegistrationCheckoutPayload,
) {
  return db.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      include: {
        items: {
          include: {
            offer: true,
          },
        },
      },
    });

    if (!registration) {
      throw new Error("Registration draft not found.");
    }

    if (registration.items.length === 0) {
      throw new Error("Registration draft has no billable items.");
    }

    if (!registration.parentProfileId) {
      throw new Error("Parent profile is required before checkout.");
    }

    let order = await tx.order.findFirst({ where: { registrationId } });

    if (!order) {
      order = await tx.order.create({
        data: {
          parentId: registration.parentProfileId,
          registrationId,
          orderNumber: createOrderNumber(),
          gateway: payload.gateway,
          currency: registration.selectedCurrency,
          subtotalAmount: registration.subtotalAmount,
          discountAmount: registration.discountAmount,
          totalAmount: registration.totalAmount,
          status: "INITIATED",
        },
      });

      for (const item of registration.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            registrationItemId: item.id,
            offerId: item.offerId,
            description: item.offer.title,
            unitAmount: item.finalAmount,
            quantity: 1,
            totalAmount: item.finalAmount,
          },
        });
      }
    } else if (order.gateway !== payload.gateway) {
      order = await tx.order.update({
        where: { id: order.id },
        data: { gateway: payload.gateway },
      });
    }

    const payment = await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        gateway: payload.gateway,
        status: payload.gateway === "BANK_TRANSFER" ? "UNDER_REVIEW" : "INITIATED",
        amount: registration.totalAmount,
        currency: registration.selectedCurrency,
      },
    });

    await tx.registration.update({
      where: { id: registrationId },
      data: {
        paymentGateway: payload.gateway,
        status: payload.gateway === "BANK_TRANSFER" ? "PAYMENT_REVIEW" : "PENDING_PAYMENT",
        submittedAt: registration.submittedAt ?? new Date(),
      },
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      gateway: payment.gateway,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      nextStep:
        payload.gateway === "BANK_TRANSFER"
          ? "Upload proof for manual verification."
          : `Continue ${payload.gateway.toLowerCase()} payment handoff.`,
    };
  });
}
