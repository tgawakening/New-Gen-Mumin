import { z } from "zod";

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(1200),
});

export type ContactPayload = z.infer<typeof contactPayloadSchema>;
