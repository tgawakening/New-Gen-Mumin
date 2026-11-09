import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const queries = [];
  const students = [
    { id: 'amna', displayName: 'Amna Ali', user: { firstName: 'Amna', lastName: 'Ali' }, registrationStudents: [{ gender: 'Girl' }], houseMembership: { qabilaGroup: 'Qabila Banu Makhzum' } },
    { id: 'other', displayName: null, user: { firstName: 'Zain', lastName: 'Ahmed' }, registrationStudents: [], houseMembership: null },
  ];
  const permissions = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/recognition-permissions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: permissions });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/weekly-certificate-students.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: id => ({
    'server-only': {},
    './recognition-permissions': permissions,
    '@/lib/db': { db: { studentProfile: { findMany: async query => { queries.push(query); return students; } } } },
  })[id] });
  return { ...exports, queries };
}
for (const email of ['mehranraziq@gmail.com', 'umm.abdissamee@gmail.com']) test(`all student accounts are listed for ${email}, without class, payment or last-login filtering`, async () => {
  const f = fixture();
  const result = await f.getWeeklyCertificateStudents({ role: 'TEACHER', email });
  assert.deepEqual(Array.from(result, student => student.name), ['Amna Ali', 'Zain Ahmed']);
  assert.equal(f.queries.length, 1);
  assert.equal(f.queries[0].where, undefined);
  assert.equal(f.queries[0].take, undefined);
  assert.equal(result[0].gender, 'Girl');
});
for (const user of [{ role: 'TEACHER', email: 'other@example.com' }, { role: 'STUDENT', email: 'mehranraziq@gmail.com' }]) test(`school-wide certificate list rejects ${user.role} ${user.email}`, async () => {
  const f = fixture();
  await assert.rejects(f.getWeeklyCertificateStudents(user), /cannot award/);
  assert.equal(f.queries.length, 0);
});
