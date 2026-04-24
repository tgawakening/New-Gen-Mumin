import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __genMuminsPrisma: PrismaClient | undefined;
}

function normalizeDatabaseUrl(value?: string) {
  if (!value) return value;

  let normalized = value.trim();
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  const mysqlIndex = normalized.indexOf("mysql://");
  if (mysqlIndex > 0) {
    normalized = normalized.slice(mysqlIndex);
  }

  return normalized;
}

const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
if (normalizedDatabaseUrl && normalizedDatabaseUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

export const db =
  global.__genMuminsPrisma ??
  new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__genMuminsPrisma = db;
}
