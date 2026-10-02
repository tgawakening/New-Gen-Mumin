import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient();
const name = '20261002120000_teacher_payslips';
const sql = fs.readFileSync(new URL('../prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
try {
 const migrations = await db.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?', name);
 const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('TeacherPayslip','TeacherPayslipRevision','TeacherPayrollSettings')");
 console.log(JSON.stringify({migration:name,recorded:migrations.some(m=>m.finished_at&&!m.rolled_back_at),tables:tables.map(t=>t.TABLE_NAME??t.table_name)}));
 if(process.argv.includes('--apply')) {
  if(migrations.some(m=>m.finished_at&&!m.rolled_back_at)) {console.log('Migration already applied.');}
  else {
   if(tables.length)throw new Error('Some payroll tables already exist without a completed migration. Review before applying.');
   for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
   await db.$executeRawUnsafe('INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, NOW(3), ?, NULL, NULL, NOW(3), 1)',randomUUID(),createHash('sha256').update(sql).digest('hex'),name);
   console.log('Payroll migration applied.');
  }
  const counts=await Promise.all([db.teacherPayslip.count(),db.teacherPayslipRevision.count(),db.teacherPayrollSettings.count()]);console.log(JSON.stringify({payslips:counts[0],revisions:counts[1],settings:counts[2]}));
 }
} finally {await db.$disconnect();}
