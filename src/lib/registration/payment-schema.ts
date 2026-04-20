import { z } from "zod";

export const registrationCheckoutSchema = z.object({
  gateway: z.enum(["STRIPE", "PAYPAL", "NAYAPAY", "BANK_TRANSFER", "SCHOLARSHIP", "FREE"]),
});

export const manualPaymentProofSchema = z.object({
  senderName: z.string().trim().min(2),
  senderNumber: z.string().trim().min(4),
  referenceKey: z.string().trim().min(3),
  screenshotUrl: z.string().trim().url().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type RegistrationCheckoutPayload = z.infer<typeof registrationCheckoutSchema>;
export type ManualPaymentProofPayload = z.infer<typeof manualPaymentProofSchema>;

