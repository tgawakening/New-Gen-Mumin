import { randomUUID } from "crypto";

import { db } from "@/lib/db";

import type { ScholarshipPayload, ScholarshipReviewPayload } from "./schema";

export async function createScholarshipApplication(payload: ScholarshipPayload) {
  const existingPending = await db.scholarshipApplication.findFirst({
    where: {
      parentEmail: payload.parentEmail,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new Error("A pending scholarship application already exists for this email.");
  }

  let offerId: string | undefined;
  if (payload.offerSlug) {
    const offer = await db.offer.findUnique({
      where: { slug: payload.offerSlug },
      select: { id: true },
    });

    if (!offer) {
      throw new Error("Selected offer is not available for scholarship requests.");
    }

    offerId = offer.id;
  }

  return db.scholarshipApplication.create({
    data: {
      parentEmail: payload.parentEmail,
      parentName: payload.parentName,
      parentWhatsapp: payload.parentWhatsapp,
      childAge: payload.childAge,
      childCountry: payload.childCountry,
      householdSize: payload.householdSize,
      monthlyIncome: payload.monthlyIncome,
      reasonForSupport: payload.reasonForSupport,
      supportingDetails: payload.supportingDetails || null,
      requestedPercent: payload.requestedPercent,
      offerId,
      status: "PENDING",
    },
    include: {
      offer: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
  });
}

export async function reviewScholarshipApplication(
  applicationId: string,
  payload: ScholarshipReviewPayload,
) {
  const existing = await db.scholarshipApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    throw new Error("Scholarship application not found.");
  }

  const token = payload.status === "APPROVED" ? randomUUID() : null;
  const tokenExpiresAt = payload.status === "APPROVED"
    ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    : null;

  return db.scholarshipApplication.update({
    where: { id: applicationId },
    data: {
      status: payload.status,
      reviewNote: payload.reviewNote,
      approvalToken: token,
      tokenExpiresAt,
    },
  });
}

