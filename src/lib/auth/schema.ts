import { z } from "zod";

export const signupPayloadSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(8),
  phoneCountryCode: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(6),
  billingCountryCode: z.string().trim().min(2).max(2).optional().or(z.literal("")),
  billingCountryName: z.string().trim().optional().or(z.literal("")),
});

export const loginPayloadSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const teacherSignupPayloadSchema = z
  .object({
    firstName: z.string().trim().min(2),
    lastName: z.string().trim().min(2),
    email: z.email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    phoneCountryCode: z.string().trim().min(1),
    phoneNumber: z.string().trim().min(6),
    timezone: z.string().trim().min(2),
    bio: z.string().trim().max(600).optional().or(z.literal("")),
    specialties: z.array(z.string().trim().min(2)).default([]),
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type SignupPayload = z.infer<typeof signupPayloadSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type TeacherSignupPayload = z.infer<typeof teacherSignupPayloadSchema>;
