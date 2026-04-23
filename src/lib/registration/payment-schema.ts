import { z } from "zod";

export const registrationCheckoutSchema = z.object({
  gateway: z.enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "SCHOLARSHIP", "FREE"]),
});

export const manualPaymentProofSchema = z.object({
  senderName: z.string().trim().min(2),
  senderNumber: z.string().trim().min(4),
  referenceKey: z.string().trim().min(3),
  manualMethod: z.enum(["BANK_TRANSFER", "JAZZCASH"]).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type RegistrationCheckoutPayload = z.infer<typeof registrationCheckoutSchema>;
export type ManualPaymentProofPayload = z.infer<typeof manualPaymentProofSchema>;
