import { randomUUID } from "crypto";

import { db } from "@/lib/db";

import type { ScholarshipPayload, ScholarshipReviewPayload } from "./schema";

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

export async function createScholarshipApplication(payload: ScholarshipPayload) {
  const existingPending = await db.scholarshipApplication.findFirst({
    where: {
      parentEmail: payload.parentEmail,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new Error("A pending fee waiver application already exists for this email.");
  }

  let offerId: string | undefined;
  if (payload.offerSlug) {
    const offer = await db.offer.findUnique({
      where: { slug: payload.offerSlug },
      select: { id: true },
    });

    if (!offer) {
      throw new Error("Selected programme is not available for fee waiver requests.");
    }

    offerId = offer.id;
  }

  const supportingDetails = compactLines([
    `What draws them to Gen-Mumins: ${payload.whatDrawsYou}`,
    `Expected benefit: ${payload.howItBenefits}`,
    payload.manualNotes ? `Manual notes: ${payload.manualNotes}` : null,
  ]);

  const notes = compactLines([
    `Occupation: ${payload.occupation}`,
    `Knowledge level: ${payload.knowledgeLevel}`,
    payload.previousStudy ? `Previous study: ${payload.previousStudy}` : null,
    payload.currentInvolvement ? `Current involvement: ${payload.currentInvolvement}` : null,
    `Most interesting topic: ${payload.mostInterestingTopic}`,
    `Why this topic: ${payload.whyThisTopic}`,
    `Regular attendance: ${payload.canAttendRegularly}`,
    `Attended orientation: ${payload.attendedOrientation ? "Yes" : "No"}`,
    `Contribution preference: ${payload.contributionPreference}`,
    payload.monthlyContribution ? `Monthly contribution: ${payload.monthlyContribution}` : null,
    payload.manualSenderName ? `Sender name: ${payload.manualSenderName}` : null,
    payload.manualSenderNumber ? `Sender number: ${payload.manualSenderNumber}` : null,
    payload.manualReferenceKey ? `Transfer reference: ${payload.manualReferenceKey}` : null,
    payload.howHeard ? `How heard about Gen-Mumins: ${payload.howHeard}` : null,
    `Adab commitment: ${payload.adabCommitment ? "Confirmed" : "Not confirmed"}`,
    `Financial need confirmed: ${payload.genuineFinancialNeed ? "Confirmed" : "Not confirmed"}`,
  ]);

  return db.scholarshipApplication.create({
    data: {
      parentEmail: payload.parentEmail,
      parentName: payload.parentName,
      parentWhatsapp: payload.parentWhatsapp,
      childAge: payload.childAge,
      childCountry: payload.childCountry,
      householdSize: null,
      monthlyIncome: payload.monthlyContribution || null,
      reasonForSupport: payload.reasonForSupport,
      supportingDetails: supportingDetails || null,
      notes: notes || null,
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
