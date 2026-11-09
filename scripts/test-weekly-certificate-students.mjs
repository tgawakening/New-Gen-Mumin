import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function learner(id, name, options = {}) {
  const [firstName, ...last] = name.split(' ');
  return {
    id, displayName: name, createdAt: new Date(options.createdAt ?? '2026-10-01'),
    user: { firstName, lastName: last.join(' '), email: id + '@example.test', role: options.role ?? 'STUDENT', status: options.status ?? 'ACTIVE' },
    enrollments: options.enrollment === null ? [] : [{ status: options.enrollment ?? 'ACTIVE' }],
    registrationStudents: options.registration === null ? [] : [{ firstName, lastName: last.join(' '), gender: 'Girl', registration: { status: options.registration ?? 'CONVERTED', createdAt: new Date(options.approvedAt ?? '2026-10-01'), parentEmail: options.family ?? 'mother@example.test' } }],
    parents: [{ parent: { user: { email: options.family ?? 'mother@example.test' } } }],
    houseMembership: { qabilaGroup: 'Qabila Banu Makhzum' },
  };
}
function fixture(students = [learner('amna', 'Amna Ali'), learner('other', 'Zain Ahmed')]) {
  const queries = [];
  const permissions = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/recognition-permissions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: permissions });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/weekly-certificate-students.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => ({
    'server-only': {}, './recognition-permissions': permissions,
    // Return all fixtures so the eligibility and canonical-record rules are also exercised.
    '@/lib/db': { db: { studentProfile: { findMany: async query => { queries.push(query); return students; } } } },
  })[id] });
  return { ...exports, queries };
}
const teacher = { role: 'TEACHER', email: 'umm.abdissamee@gmail.com' };
for (const email of ['mehranraziq@gmail.com', 'umm.abdissamee@gmail.com']) test(`approved enrolled learners across all classes are listed for ${email}`, async () => {
  const f = fixture(); const result = await f.getWeeklyCertificateStudents({ role: 'TEACHER', email });
  assert.deepEqual(Array.from(result, student => student.name), ['Amna Ali', 'Zain Ahmed']);
  const query = f.queries[0];
  assert.equal(query.where.user.status, 'ACTIVE'); assert.equal(query.where.user.role, 'STUDENT');
  assert.deepEqual(Array.from(query.where.enrollments.some.status.in), ['CONFIRMED', 'ACTIVE', 'COMPLETED']);
  assert.deepEqual(Array.from(query.where.OR[0].registrationStudents.some.registration.status.in), ['PAID', 'CONVERTED']);
  assert.equal(query.take, undefined); assert.equal(result[0].gender, 'Girl');
});
test('pending and unapproved registrations, cancelled enrolments, unenrolled accounts and inactive users are excluded', async () => {
  const students = ['DRAFT','SUBMITTED','PENDING_PAYMENT','PAYMENT_REVIEW','CANCELLED','EXPIRED'].map(status => learner(status, 'Unapproved ' + status, { registration: status }));
  students.push(learner('pending', 'Pending Enrollment', { enrollment: 'PENDING' }), learner('cancelled', 'Cancelled Enrollment', { enrollment: 'CANCELLED' }), learner('none', 'Not Enrolled', { enrollment: null }), learner('suspended', 'Suspended User', { status: 'SUSPENDED' }), learner('invited', 'Invited User', { status: 'INVITED' }), learner('parent', 'Parent Test', { role: 'PARENT' }));
  students.push(learner('confirmed', 'Confirmed Student', { enrollment: 'CONFIRMED', registration: 'PAID' }), learner('active', 'Active Student'), learner('completed', 'Completed Student', { enrollment: 'COMPLETED' }));
  const result = await fixture(students).getWeeklyCertificateStudents(teacher);
  assert.deepEqual(Array.from(result, student => student.id), ['active','completed','confirmed']);
});
test('direct staff-approved enrolments remain eligible, but bare and pending-only profiles do not', async () => {
  const result = await fixture([learner('manual', 'Manual Learner', { registration: null, enrollment: 'CONFIRMED' }), learner('bare', 'Bare Account', { registration: null, enrollment: null }), learner('pending', 'Pending Account', { registration: null, enrollment: 'PENDING' })]).getWeeklyCertificateStudents(teacher);
  assert.deepEqual(Array.from(result, student => student.id), ['manual']);
});
test('repeat registrations collapse to the newest approved learner, preserving siblings and same-name children in different families', async () => {
  const students = [
    learner('old', 'Amna Ali', { approvedAt: '2026-09-01', createdAt: '2026-11-01' }),
    learner('new', 'Amna Ali', { approvedAt: '2026-10-01' }),
    learner('pending-copy', 'Amna Ali', { registration: 'PAYMENT_REVIEW', approvedAt: '2026-11-01' }),
    learner('sibling', 'Fatima Ali'),
    learner('different-family', 'Amna Ali', { family: 'another-mother@example.test' }),
  ];
  const result = await fixture(students).getWeeklyCertificateStudents(teacher);
  assert.deepEqual(Array.from(result, student => student.id).sort(), ['different-family', 'new', 'sibling']);
});
test('registered name, normalized spacing and case identify duplicates even when profile labels differ', async () => {
  const old = learner('old', 'Amna Ali', { approvedAt: '2026-09-01' }); old.displayName = 'Amna Parent';
  const current = learner('new', 'AMNA  ALI', { family: ' MOTHER@EXAMPLE.TEST ', approvedAt: '2026-10-01' });
  const result = await fixture([old,current]).getWeeklyCertificateStudents(teacher);
  assert.deepEqual(Array.from(result, student => student.id), ['new']);
});
test('pending renewal data does not replace the approved registration identity or gender', async () => {
  const child = learner('amna', 'Amna Ali');
  child.registrationStudents.unshift({ firstName: 'Random', lastName: 'Draft', gender: 'Boy', registration: { status: 'DRAFT', createdAt: new Date('2026-11-01'), parentEmail: 'other@example.test' } });
  assert.equal((await fixture([child]).getWeeklyCertificateStudents(teacher))[0].gender, 'Girl');
});
for (const user of [{ role: 'TEACHER', email: 'other@example.com' }, { role: 'STUDENT', email: 'mehranraziq@gmail.com' }]) test(`certificate list rejects ${user.role} ${user.email}`, async () => {
  const f = fixture(); await assert.rejects(f.getWeeklyCertificateStudents(user), /cannot award/); assert.equal(f.queries.length, 0);
});
test('active Maliha receives the same eligible list; other or inactive Communications users are rejected', async () => {
  const f = fixture(); const actor = { role: 'COMMUNICATIONS', email: 'emancheman413@gmail.com', status: 'ACTIVE' };
  assert.equal((await f.getWeeklyCertificateStudents(actor)).length, 2);
  for (const user of [{ ...actor, status: 'SUSPENDED' }, { ...actor, email: 'other@example.com' }]) await assert.rejects(f.getWeeklyCertificateStudents(user), /cannot award/);
  assert.equal(f.queries.length, 1);
});
