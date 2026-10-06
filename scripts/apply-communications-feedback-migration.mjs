import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient();
const name = '20261006150000_communications_feedback_edits';
const sql = fs.readFileSync(new URL('../prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
try {
 const applied=await db.$queryRawUnsafe('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?',name);
 const columns=await db.$queryRawUnsafe("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='MonthlyParentFeedback' AND column_name IN ('version','updatedAt')) OR (table_name='Notification' AND column_name='monthlyFeedbackId'))");
 console.log(JSON.stringify({migration:name,recorded:applied.some(x=>x.finished_at&&!x.rolled_back_at),newColumns:columns.length}));
 if(process.argv.includes('--apply')&&!applied.some(x=>x.finished_at&&!x.rolled_back_at)) {
  if(columns.length)throw new Error('Partial migration detected; review before applying.');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
  await db.$executeRawUnsafe('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (?,?,NOW(3),?,NULL,NULL,NOW(3),3)',randomUUID(),createHash('sha256').update(sql).digest('hex'),name);
  console.log('Communications and feedback-edit migration applied.');
 }
}finally{await db.$disconnect();}
