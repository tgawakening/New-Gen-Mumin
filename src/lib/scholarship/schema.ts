import { z } from "zod";

export const scholarshipPayloadSchema = z.object({
  parentName: z.string().trim().min(2),
  parentEmail: z.email(),
  parentWhatsapp: z.string().trim().min(6),
  childAge: z.coerce.number().int().min(4).max(18),
  childCountry: z.string().trim().min(2),
  householdSize: z.coerce.number().int().min(1).max(20),
  monthlyIncome: z.string().trim().min(2),
  reasonForSupport: z.string().trim().min(20).max(800),
  supportingDetails: z.string().trim().max(800).optional().or(z.literal("")),
  requestedPercent: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  offerSlug: z.string().trim().min(1).optional().or(z.literal("")),
});

export const scholarshipReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().min(4).max(400),
});

export type ScholarshipPayload = z.infer<typeof scholarshipPayloadSchema>;
export type ScholarshipReviewPayload = z.infer<typeof scholarshipReviewSchema>;

