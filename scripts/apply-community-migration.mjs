import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function normalizeDatabaseUrl(value) {
  if (!value) return "";

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

  return normalized.replace(/ssl-mode=REQUIRED/gi, "sslaccept=accept_invalid_certs");
}

const root = process.cwd();
loadDotEnv(path.join(root, ".env"));
loadDotEnv(path.join(root, ".env.local"));

const databaseUrl = normalizeDatabaseUrl(
  process.env.DATABASE_URL ||
    process.env.APP_DATABASE_URL ||
    process.env.GEN_MUMIN_DATABASE_URL,
);

if (!databaseUrl.startsWith("mysql://")) {
  console.error("No usable MySQL DATABASE_URL found. Set DATABASE_URL to the DigitalOcean mysql:// connection string.");
  process.exit(1);
}

const sqlFile = path.join(root, "prisma", "community-quest-feedback.sql");
const schemaFile = path.join(root, "prisma", "schema.prisma");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

for (const file of [sqlFile, schemaFile, prismaCli]) {
  if (!existsSync(file)) {
    console.error(`Required file not found: ${file}`);
    console.error(`Current working directory: ${root}`);
    process.exit(1);
  }
}

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    "db",
    "execute",
    "--file",
    sqlFile,
    "--schema",
    schemaFile,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  },
);

process.exit(result.status ?? 1);
