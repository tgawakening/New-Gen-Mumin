import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { syncRegistrationAccess } from "@/lib/enrollment/access";
import { getManualPaymentDetails } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/fulfillment";
import { createPayPalSubscription } from "@/lib/payments/paypal";
import { createStripeCheckoutSession } from "@/lib/payments/stripe";
import type { RegistrationCheckoutPayload } from "@/lib/registration/payment-schema";

function createOrderNumber() {
  return `GM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createCheckoutDraft(
  registrationId: string,
  payload: RegistrationCheckoutPayload,
) {
  const checkout = await db.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      include: {
        parentProfile: {
          include: {
            user: true,
          },
        },
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

    if (!registration.parentProfileId || !registration.parentProfile) {
      throw new Error("Parent profile is required before checkout.");
    }

    let order = await tx.order.findFirst({
      where: { registrationId },
      include: {
        items: true,
      },
    });

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
        include: {
          items: true,
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

      order = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
    } else if (order.gateway !== payload.gateway) {
      order = await tx.order.update({
        where: { id: order.id },
        data: { gateway: payload.gateway },
        include: { items: true },
      });
    }

    const payment = await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        gateway: payload.gateway,
        status: payload.gateway === "BANK_TRANSFER" ? "UNDER_REVIEW" : "PENDING",
        amount: registration.totalAmount,
        currency: registration.selectedCurrency,
      },
    });

    let manualInstructions: ReturnType<typeof getManualPaymentDetails> | null = null;

    if (payload.gateway === "BANK_TRANSFER" && registration.selectedCountryCode !== "PK") {
      throw new Error("Manual payment is available only for registrations from Pakistan.");
    }

    if (payload.gateway === "PAYPAL" && registration.totalAmount > 0) {
      if (registration.items.length !== 1) {
        throw new Error("PayPal subscriptions are available for single programme selections only. Please use Stripe for discounted or multi-child enrollments.");
      }
    } else if (payload.gateway === "BANK_TRANSFER") {
      manualInstructions = getManualPaymentDetails();
    }

    await tx.registration.update({
      where: { id: registrationId },
      data: {
        paymentGateway: payload.gateway,
        status: payload.gateway === "BANK_TRANSFER" ? "PAYMENT_REVIEW" : "PENDING_PAYMENT",
        submittedAt: registration.submittedAt ?? new Date(),
      },
    });

    return {
      registrationId,
      orderId: order.id,
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      gateway: payment.gateway,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      selectedCountryCode: registration.selectedCountryCode,
      parentEmail: registration.parentEmail,
      parentName: `${registration.parentFirstName} ${registration.parentLastName}`.trim(),
      itemTitles: registration.items.map((item) => item.offer.title),
      itemSlugs: registration.items.map((item) => item.offer.slug),
      manualInstructions,
    };
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });

  try {
    await syncRegistrationAccess(checkout.registrationId, "PENDING");
  } catch (error) {
    console.error("Unable to pre-provision registration access before payment.", error);
  }

  let checkoutUrl: string | null = null;
  let providerReference: string | null = null;
  let nextStep =
    checkout.amount <= 0
      ? "Your discount covered the full amount. Enrollment can be completed immediately."
      : payload.gateway === "BANK_TRANSFER"
        ? "Choose Bank Transfer or JazzCash and submit the payment proof for manual verification."
        : `Continue to ${payload.gateway.toLowerCase()} to complete the subscription.`;

  if (payload.gateway === "STRIPE" && checkout.amount > 0) {
    const checkoutLabel =
      checkout.itemTitles.length === 1
        ? `${checkout.itemTitles[0]} subscription`
        : "Gen-Mumins family subscription";
    const checkoutDescription =
      checkout.itemTitles.length === 1
        ? checkout.itemTitles[0]
        : checkout.itemTitles.join(", ");

    const session = await createStripeCheckoutSession({
      orderId: checkout.orderId,
      paymentId: checkout.paymentId,
      registrationId: checkout.registrationId,
      customerEmail: checkout.parentEmail,
      currency: checkout.currency,
      orderNumber: checkout.orderNumber,
      checkoutLabel,
      checkoutDescription,
      amount: checkout.amount,
    });

    checkoutUrl = session.url ?? null;
    providerReference = session.id;

    await db.order.update({
      where: { id: checkout.orderId },
      data: {
        providerOrderId: session.id,
        providerReference: session.subscription?.toString() ?? null,
        metadata: {
          provider: "stripe",
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
        },
      },
    });

    await db.paymentTransaction.update({
      where: { id: checkout.paymentId },
      data: {
        providerOrderId: session.id,
        providerReference: session.subscription?.toString() ?? null,
        rawPayload: {
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
        },
      },
    });
  } else if (payload.gateway === "PAYPAL" && checkout.amount > 0) {
    if (checkout.itemSlugs.length !== 1) {
      throw new Error("PayPal subscriptions are available for single programme selections only. Please use Stripe for discounted or multi-child enrollments.");
    }

    const paypal = await createPayPalSubscription({
      orderId: checkout.orderId,
      paymentId: checkout.paymentId,
      orderNumber: checkout.orderNumber,
      customerEmail: checkout.parentEmail,
      customerName: checkout.parentName,
      currency: checkout.currency,
      offerSlug: checkout.itemSlugs[0],
      countryCode: checkout.selectedCountryCode ?? "",
    });

    checkoutUrl = paypal.approvalUrl;
    providerReference = paypal.subscriptionId;

    await db.order.update({
      where: { id: checkout.orderId },
      data: {
        providerOrderId: paypal.subscriptionId,
        providerReference: paypal.planId,
        metadata: {
          provider: "paypal",
          subscriptionId: paypal.subscriptionId,
          planId: paypal.planId,
          productId: paypal.productId,
        },
      },
    });

    await db.paymentTransaction.update({
      where: { id: checkout.paymentId },
      data: {
        providerOrderId: paypal.subscriptionId,
        providerReference: paypal.planId,
        rawPayload: {
          approvalUrl: paypal.approvalUrl,
          productId: paypal.productId,
          planId: paypal.planId,
        },
      },
    });
  }

  if (checkout.amount <= 0 && payload.gateway !== "BANK_TRANSFER") {
    await markOrderPaid(checkout.orderId, {
      providerReference: "FULL_DISCOUNT",
      rawPayload: { autoCompleted: true, reason: "full-discount" },
    });

    return {
      ...checkout,
      status: "SUCCEEDED",
      nextStep: "Enrollment completed. Your dashboard is now ready.",
    };
  }

  return {
    orderId: checkout.orderId,
    paymentId: checkout.paymentId,
    orderNumber: checkout.orderNumber,
    gateway: checkout.gateway,
    amount: checkout.amount,
    currency: checkout.currency,
    status: checkout.status,
    providerReference,
    checkoutUrl,
    manualInstructions: checkout.manualInstructions,
    nextStep,
  };
}

export async function submitManualPaymentProof(
  paymentId: string,
  payload: {
    senderName: string;
    senderNumber: string;
    referenceKey: string;
    manualMethod?: string;
    notes?: string;
  },
) {
  const payment = await db.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: {
      order: true,
    },
  });

  if (!payment || payment.gateway !== "BANK_TRANSFER") {
    throw new Error("Manual payment record not found.");
  }

  const notes = [payload.manualMethod ? `Manual method: ${payload.manualMethod}` : null, payload.notes || null]
    .filter(Boolean)
    .join("\n");

  const submission = await db.manualPaymentSubmission.upsert({
    where: { paymentTransactionId: paymentId },
    update: {
      senderName: payload.senderName,
      senderNumber: payload.senderNumber,
      referenceKey: payload.referenceKey,
      screenshotUrl: null,
      notes: notes || null,
      submittedAt: new Date(),
    },
    create: {
      paymentTransactionId: paymentId,
      method: "BANK_TRANSFER",
      senderName: payload.senderName,
      senderNumber: payload.senderNumber,
      referenceKey: payload.referenceKey,
      screenshotUrl: null,
      notes: notes || null,
    },
  });

  await db.paymentTransaction.update({
    where: { id: paymentId },
    data: {
      status: "UNDER_REVIEW",
      providerReference: payload.referenceKey,
      rawPayload: {
        manualMethod: payload.manualMethod ?? "BANK_TRANSFER",
      },
    },
  });

  await db.order.update({
    where: { id: payment.orderId },
    data: {
      status: "UNDER_REVIEW",
      providerReference: payload.referenceKey,
    },
  });

  if (payment.order.registrationId) {
    await db.registration.update({
      where: { id: payment.order.registrationId },
      data: {
        status: "PAYMENT_REVIEW",
      },
    });
  }

  return submission;
}
