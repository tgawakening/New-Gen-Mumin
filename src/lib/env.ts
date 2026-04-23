import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url(),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  AUTH_SESSION_SECRET: z.string().min(16),
  AUTH_COOKIE_NAME: z.string().min(1).default("gen_mumins_session"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  EXTERNAL_ADMIN_FEED_SECRET: z.string().min(16).optional(),
});

export const env = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  APP_ENV: process.env.APP_ENV,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
  EXTERNAL_ADMIN_FEED_SECRET: process.env.EXTERNAL_ADMIN_FEED_SECRET,
});
