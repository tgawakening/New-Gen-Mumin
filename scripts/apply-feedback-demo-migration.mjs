import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient();
const name = '20261006200000_monthly_feedback_demo';
const sql = fs.readFileSync(new URL('../prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
try {
 const applied = await db.$queryRawUnsafe('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?', name);
 if (applied.some(x => x.finished_at && !x.rolled_back_at)) console.log('Dummy feedback migration already applied.');
 else if (process.argv.includes('--apply')) {
  const tables = await db.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='MonthlyFeedbackDemo'");
  if (tables.length) throw new Error('Unrecorded table exists; review before applying.');
  await db.$executeRawUnsafe(sql.trim().replace(/;$/, ''));
  await db.$executeRawUnsafe('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (?,?,NOW(3),?,NULL,NULL,NOW(3),1)', randomUUID(), createHash('sha256').update(sql).digest('hex'), name);
  console.log('Isolated dummy feedback storage created.');
 } else console.log('Migration is pending; use --apply to create isolated dummy feedback storage.');
} finally { await db.$disconnect(); }
