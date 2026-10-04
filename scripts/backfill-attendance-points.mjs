import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
export function loadPointsModule(name) {
  if (cache.has(name)) return cache.get(name);
  const exports = {};
  cache.set(name, exports);
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/live-classes', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, require: id => id === 'server-only' ? {} : id.startsWith('@/lib/live-classes/') ? loadPointsModule(id.split('/').at(-1)) : require(id) });
  return exports;
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const allowed = new Set(['--apply', '--audit']);
  for (let i = 2; i < process.argv.length; i++) { if (!allowed.has(process.argv[i])) throw new Error('Unknown argument'); if (process.argv[i] === '--audit') i++; }
  const auditIndex = process.argv.indexOf('--audit');
  const auditFile = auditIndex < 0 ? null : process.argv[auditIndex + 1];
  if (auditIndex >= 0 && (!auditFile || auditFile.startsWith('--'))) throw new Error('--audit requires a file path');
  if (auditFile && fs.existsSync(auditFile)) throw new Error('Audit file already exists; choose a new path');
  const apply = process.argv.includes('--apply');
  const { planAttendancePointsUpgrade } = loadPointsModule('attendance-points-backfill');
  const { lockAttendanceStudent } = loadPointsModule('attendance-ledger');
  const db = new PrismaClient();
  const audit = { policy: 25, mode: apply ? 'apply' : 'dry-run', startedAt: new Date().toISOString(), learners: [] };
  const persistAudit = () => { if (auditFile) fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2)); };
  try {
    const schedules = await db.classSchedule.findMany({ select: { id: true, title: true, programId: true, program: { select: { title: true } } } });
    const students = await db.studentProfile.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    for (const student of students) {
      const result = await db.$transaction(async tx => {
        await lockAttendanceStudent(tx, student.id);
        const membership = await tx.houseMembership.findUnique({ where: { studentId: student.id }, select: { houseId: true } });
        const records = await tx.attendanceRecord.findMany({ where: { studentId: student.id, lessonDate: { lte: new Date(audit.startedAt) } }, include: { enrollment: { select: { programId: true, program: { select: { title: true } } } } } });
        const rows = await tx.housePointLedger.findMany({ where: { studentId: student.id, sourceType: { startsWith: 'ATTENDANCE_' } }, select: { houseId: true, points: true, sourceType: true, sourceId: true } });
        const reports = await tx.adminAttendanceRecovery.findMany({ where: { studentId: student.id }, select: { id: true, missedCount: true, fromDay: true, toDay: true } });
        const plan = planAttendancePointsUpgrade({ studentId: student.id, houseId: membership?.houseId ?? null, schedules, records, rows, reports });
        // An incomplete missed-count plan must never create an overpayment.
        if (reports.some(report => report.missedCount > 0) && plan.skipped.length) throw new Error('Review unresolved evidence for learner ' + student.id + ' before adjusting an estimated attendance report');
        if (apply && plan.credits.length) await tx.housePointLedger.createMany({ data: plan.credits });
        return { studentId: student.id, ...plan };
      }, { maxWait: 10000, timeout: 60000 });
      audit.learners.push(result); persistAudit();
    }
    const credits = audit.learners.flatMap(learner => learner.credits);
    const byHouse = {};
    for (const row of credits) byHouse[row.houseId] = (byHouse[row.houseId] ?? 0) + row.points;
    const summary = { mode: audit.mode, learnersChanged: audit.learners.filter(learner => learner.credits.length).length, entries: credits.length, pointsDelta: credits.reduce((sum, row) => sum + row.points, 0), alreadyAtTarget: audit.learners.reduce((sum, learner) => sum + learner.alreadyAtTarget, 0), aboveTargetUnchanged: audit.learners.reduce((sum, learner) => sum + learner.aboveTarget, 0), unresolved: audit.learners.reduce((sum, learner) => sum + learner.skipped.length, 0), byHouse };
    audit.summary = summary; audit.finishedAt = new Date().toISOString(); persistAudit(); console.log(JSON.stringify(summary));
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.code ?? error.message); process.exitCode = 1; });
