import { z } from "zod";

export const registrationStudentSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(1),
  age: z.coerce.number().int().min(4).max(18),
  gender: z.string().trim().optional().or(z.literal("")),
  selectedOfferSlugs: z.array(z.string().trim().min(1)).min(1),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const registrationPayloadSchema = z.object({
  parentFirstName: z.string().trim().min(2),
  parentLastName: z.string().trim().min(2),
  parentEmail: z.email(),
  phoneCountryCode: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(6),
  whatsappNumber: z.string().trim().optional().or(z.literal("")),
  selectedCountryCode: z.string().trim().min(2).max(2),
  selectedCountryName: z.string().trim().min(2),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  students: z.array(registrationStudentSchema).min(1).max(6),
});

export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;
