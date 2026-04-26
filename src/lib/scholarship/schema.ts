import { z } from "zod";

export const scholarshipPayloadSchema = z.object({
  parentName: z.string().trim().min(2),
  parentEmail: z.email(),
  parentWhatsapp: z.string().trim().min(6),
  childAge: z.coerce.number().int().min(4).max(18),
  childCountry: z.string().trim().min(2),
  occupation: z.string().trim().min(2),
  knowledgeLevel: z.enum(["Beginner", "Intermediate", "Advanced"]),
  previousStudy: z.string().trim().max(300).optional().or(z.literal("")),
  currentInvolvement: z.string().trim().max(300).optional().or(z.literal("")),
  whatDrawsYou: z.string().trim().min(12).max(800),
  howItBenefits: z.string().trim().min(12).max(900),
  mostInterestingTopic: z.string().trim().min(2).max(200),
  whyThisTopic: z.string().trim().min(2).max(300),
  canAttendRegularly: z.string().trim().min(2).max(200),
  attendedOrientation: z.boolean(),
  contributionPreference: z.enum(["FULL_SCHOLARSHIP", "PARTIAL_CONTRIBUTION"]),
  monthlyContribution: z.string().trim().max(40).optional().or(z.literal("")),
  manualSenderName: z.string().trim().max(200).optional().or(z.literal("")),
  manualSenderNumber: z.string().trim().max(100).optional().or(z.literal("")),
  manualReferenceKey: z.string().trim().max(100).optional().or(z.literal("")),
  manualNotes: z.string().trim().max(800).optional().or(z.literal("")),
  reasonForSupport: z.string().trim().min(20).max(1000),
  howHeard: z.string().trim().max(200).optional().or(z.literal("")),
  adabCommitment: z.literal(true),
  genuineFinancialNeed: z.literal(true),
  requestedPercent: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  offerSlug: z.string().trim().min(1).optional().or(z.literal("")),
});

export const scholarshipReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().min(4).max(400),
});

export type ScholarshipPayload = z.infer<typeof scholarshipPayloadSchema>;
export type ScholarshipReviewPayload = z.infer<typeof scholarshipReviewSchema>;
