import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient();
const name = '20261007120000_live_quiz_seats';
const sql = fs.readFileSync(new URL('../prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
try {
 const applied = await db.$queryRawUnsafe('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?', name);
 if (applied.some(x => x.finished_at && !x.rolled_back_at)) console.log('Live quiz migration already applied.');
 else if (process.argv.includes('--apply')) {
  const tables = await db.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='QuizLiveSeat'");
  const indexes = await db.$queryRawUnsafe("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='QuizLiveSession' AND index_name='QuizLiveSession_status_updatedAt_idx'");
  const statements = sql.split(';').map(x=>x.trim()).filter(Boolean);
  if (!tables.length) await db.$executeRawUnsafe(statements[0]);
  if (!indexes.length) await db.$executeRawUnsafe(statements[1]);
  await db.quizLiveSeat.count();
  await db.$executeRawUnsafe('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (?,?,NOW(3),?,NULL,NULL,NOW(3),2)', randomUUID(), createHash('sha256').update(sql).digest('hex'), name);
  console.log('Live quiz roster storage and active-session index applied.');
 } else console.log('Migration pending; use --apply.');
} finally { await db.$disconnect(); }
