import { z } from "zod";

export const registrationCheckoutSchema = z.object({
  gateway: z.enum(["STRIPE", "PAYPAL", "NAYAPAY", "BANK_TRANSFER", "SCHOLARSHIP", "FREE"]),
});

export type RegistrationCheckoutPayload = z.infer<typeof registrationCheckoutSchema>;
