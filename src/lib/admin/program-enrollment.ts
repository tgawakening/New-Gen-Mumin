import "server-only";

import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/payments/fulfillment";
import { createCheckoutDraft } from "@/lib/registration/payment-service";
import { createRegistrationDraft } from "@/lib/registration/service";

type AdminProgramChangeMode = "add" | "switch";
type AdminPaymentMode = "AUTO_COMPLETE" | "MANUAL_REVIEW";

function splitName(firstName: string, lastName: string | null, fallback: string) {
  const joined = [firstName, lastName].filter(Boolean).join(" ").trim() || fallback;
  const [first, ...rest] = joined.split(/\s+/u);
  return {
    firstName: first || joined,
    lastName: rest.join(" ") || "Student",
  };
}

function parentName(user: { firstName: string; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export async function createAdminProgramEnrollmentOrder(input: {
  studentId: string;
  offerSlug: string;
  changeMode: AdminProgramChangeMode;
  paymentMode: AdminPaymentMode;
  gateway: "STRIPE" | "PAYPAL" | "BANK_TRANSFER";
  couponCode?: string | null;
  adminUserId: string;
}) {
  if (!input.studentId || !input.offerSlug) {
    throw new Error("Choose a student and programme offer.");
  }

  const student = await db.studentProfile.findUnique({
    where: { id: input.studentId },
    include: {
      user: true,
      parents: {
        include: {
          parent: {
            include: {
              user: true,
            },
          },
        },
        take: 1,
      },
      registrationStudents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          registration: true,
        },
      },
    },
  });

  if (!student) throw new Error("Student not found.");

  const parent = student.parents[0]?.parent;
  if (!parent) throw new Error("This student has no linked parent account.");

  const phoneCountryCode =
    parent.user.phoneCountryCode || student.registrationStudents[0]?.registration.phoneCountryCode || "";
  const phoneNumber = parent.user.phoneNumber || student.registrationStudents[0]?.registration.phoneNumber || "";
  if (!phoneCountryCode || !phoneNumber) {
    throw new Error("Parent phone details are missing. Please update the parent profile first.");
  }

  const countryCode =
    parent.billingCountryCode ||
    student.countryCode ||
    student.registrationStudents[0]?.registration.selectedCountryCode ||
    "GB";
  const countryName =
    parent.billingCountryName ||
    student.countryName ||
    student.registrationStudents[0]?.registration.selectedCountryName ||
    "United Kingdom";
  const childName = splitName(student.user.firstName, student.user.lastName, student.displayName || "Student");
  const parentParts = splitName(parent.user.firstName, parent.user.lastName, parentName(parent.user));
  const adminSource = input.changeMode === "switch" ? "admin-program-switch" : "admin-program-add";

  const registration = await createRegistrationDraft({
    parentFirstName: parentParts.firstName,
    parentLastName: parentParts.lastName,
    parentEmail: parent.user.email,
    phoneCountryCode,
    phoneNumber,
    whatsappNumber: "",
    selectedCountryCode: countryCode,
    selectedCountryName: countryName,
    couponCode: input.couponCode?.trim() || "",
    notes: `Source: admin-program-change; ${adminSource}; studentId=${student.id}; adminUserId=${input.adminUserId}`,
    students: [
      {
        firstName: childName.firstName,
        lastName: childName.lastName,
        age: student.age ?? 8,
        gender: "",
        selectedOfferSlugs: [input.offerSlug],
        notes: `Source: ${adminSource}; existingChildId=${student.id}`,
      },
    ],
  });

  const checkout = await createCheckoutDraft(registration.id, {
    gateway: input.gateway,
    skipProviderCheckout: input.paymentMode === "AUTO_COMPLETE",
    allowManualOutsidePakistan: true,
  });

  const order = await db.order.findUnique({
    where: { id: checkout.orderId },
    select: { metadata: true },
  });
  const metadata =
    typeof order?.metadata === "object" && order.metadata && !Array.isArray(order.metadata)
      ? order.metadata
      : {};

  await db.order.update({
    where: { id: checkout.orderId },
    data: {
      metadata: {
        ...metadata,
        adminProgramChange: {
          studentId: student.id,
          offerSlug: input.offerSlug,
          mode: input.changeMode,
          paymentMode: input.paymentMode,
          createdByUserId: input.adminUserId,
          createdAt: new Date().toISOString(),
        },
      },
    },
  });

  if (input.paymentMode === "AUTO_COMPLETE") {
    await markOrderPaid(checkout.orderId, {
      gateway: input.gateway,
      providerReference: "ADMIN_AUTO_COMPLETED",
      rawPayload: {
        autoCompletedByAdmin: true,
        adminUserId: input.adminUserId,
        completedAt: new Date().toISOString(),
      },
    });
  }

  return checkout;
}
