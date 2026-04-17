import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __genMuminsPrisma: PrismaClient | undefined;
}

export const db =
  global.__genMuminsPrisma ??
  new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__genMuminsPrisma = db;
}
