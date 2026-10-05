import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PrismaClient, Prisma } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Only --apply is supported');
const apply = process.argv.includes('--apply');
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/payroll/email-queue.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => { if (id === 'server-only') return {}; throw new Error('Unexpected dependency ' + id); } });
const db = new PrismaClient();
try {
 const candidates = await db.teacherPayslip.findMany({ where: { publishedAt: { not: null }, teacher: { user: { status: 'ACTIVE', role: 'TEACHER' } } }, select: { id: true, teacherId: true } });
 const results = [];
 for (const candidate of candidates) {
  const result = await db.$transaction(async tx => {
   await tx.$queryRaw(Prisma.sql`SELECT id FROM TeacherProfile WHERE id = ${candidate.teacherId} FOR UPDATE`);
   const slip = await tx.teacherPayslip.findUnique({ where: { id: candidate.id }, include: { teacher: { include: { user: true } }, revisions: { orderBy: { version: 'desc' }, take: 1 } } });
   const revision = slip?.revisions[0];
   if (!slip?.publishedAt || !slip.publishedData || !revision || slip.teacher.user.status !== 'ACTIVE' || slip.teacher.user.role !== 'TEACHER') return { eligible: false };
   const key = exports.payrollEmailKey(slip.id, revision.version);
   const existing = await tx.billingEmailJob.findUnique({ where: { key } });
   if (apply) await exports.queuePayrollEmail(tx, slip.id, revision.version, slip.teacher.user.email);
   return { eligible: true, month: slip.month, status: existing?.status ?? (apply ? 'PAYROLL_PENDING' : 'WOULD_QUEUE'), newlyQueued: !existing };
  }, { maxWait: 10000, timeout: 30000 });
  results.push(result);
 }
 console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', slipsReviewed: candidates.length, eligible: results.filter(r=>r.eligible).length, newNotifications: results.filter(r=>r.newlyQueued).length, results }));
} catch (error) { console.error(error.code ?? error.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
