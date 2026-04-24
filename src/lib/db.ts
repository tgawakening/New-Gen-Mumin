import type { PrismaClient as PrismaClientType } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __genMuminsPrisma: PrismaClientType | undefined;
}

function normalizeDatabaseUrl(value?: string) {
  if (!value) return value;

  let normalized = value
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim();
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  const mysqlMatch = normalized.match(/mysql:\/\/[^\s"'`]+/i);
  if (mysqlMatch) {
    normalized = mysqlMatch[0];
  }

  normalized = normalized.replace(/ssl-mode=REQUIRED/gi, "sslaccept=accept_invalid_certs");

  return normalized;
}

const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
if (normalizedDatabaseUrl && normalizedDatabaseUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

export const db =
  global.__genMuminsPrisma ??
  new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__genMuminsPrisma = db;
}
