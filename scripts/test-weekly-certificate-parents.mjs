import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const laiba = { id: 'laiba', name: 'Laiba', gender: 'Girl', qabilaGroup: 'Qabila Banu Makhzum' };
const amna = { id: 'amna', name: 'Amna Ali', gender: 'Girl', qabilaGroup: 'Qabila Banu Zuhra' };
function parent(id = 'anum', sources = {}) {
  return { id, user: { firstName: id === 'anum' ? 'Anum' : id, lastName: 'Sheikh', email: id + '@example.test' }, students: [], enrollments: [], registrations: [], ...sources };
}
function fixture(parents, students = [laiba, amna]) {
  const queries = [], exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/weekly-certificate-parents.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => ({
    'server-only': {},
    '@/lib/db': { db: { parentProfile: { findMany: async query => { queries.push(query); return parents; } } } },
    './weekly-certificate-students': { getWeeklyCertificateStudents: async () => students },
  })[id] });
  return { ...exports, queries };
}
for (const source of ['link', 'enrollment', 'registration']) test(`Anum is selectable through ${source} ownership, including when ParentStudent is missing`, async () => {
  const sources = source === 'link' ? { students: [{ studentId: 'laiba' }] } : source === 'enrollment' ? { enrollments: [{ studentId: 'laiba', status: 'CONFIRMED' }] } : { registrations: [{ status: 'CONVERTED', students: [{ studentProfileId: 'laiba' }] }] };
  const f = fixture([parent('anum',sources)]);
  const parents = await f.getWeeklyCertificateParents({});
  assert.equal(parents.length,1); assert.equal(parents[0].name,'Anum Sheikh'); assert.equal(parents[0].children[0].id,'laiba');
  const paths=f.queries[0].where.OR;
  assert.equal(paths.length,3);
  assert.deepEqual(Array.from(paths[1].enrollments.some.status.in),['CONFIRMED','ACTIVE','COMPLETED']);
  assert.deepEqual(Array.from(paths[2].registrations.some.status.in),['PAID','CONVERTED']);
});
test('siblings and repeated ownership sources produce one parent and one entry per eligible child',async()=>{
 const f=fixture([parent('anum',{students:[{studentId:'laiba'}],enrollments:[{studentId:'laiba',status:'ACTIVE'},{studentId:'amna',status:'COMPLETED'}],registrations:[{status:'PAID',students:[{studentProfileId:'laiba'},{studentProfileId:'amna'}]}]})]);
 const result=await f.getWeeklyCertificateParents({});assert.equal(result.length,1);assert.deepEqual(Array.from(result[0].children,child=>child.id),['laiba','amna']);
});
test('pending/cancelled ownership and ineligible students never add a parent to the list',async()=>{
 const f=fixture([
  parent('pending',{enrollments:[{studentId:'laiba',status:'PENDING'}],registrations:[{status:'PAYMENT_REVIEW',students:[{studentProfileId:'laiba'}]}]}),
  parent('cancelled',{enrollments:[{studentId:'laiba',status:'CANCELLED'}]}),
  parent('random',{students:[{studentId:'unapproved-child'}]}),
 ]);assert.equal((await f.getWeeklyCertificateParents({})).length,0);
});
test('both actual parent owners appear, while unrelated accounts sharing the name do not',async()=>{
 const f=fixture([parent('anum',{enrollments:[{studentId:'laiba',status:'ACTIVE'}]}),parent('father',{students:[{studentId:'laiba'}]}),parent('same-name')]);
 const result=await f.getWeeklyCertificateParents({});assert.deepEqual(Array.from(result,parent=>parent.id),['anum','father']);
});
test('no eligible learners avoids querying parent accounts',async()=>{const f=fixture([],[]);assert.equal((await f.getWeeklyCertificateParents({})).length,0);assert.equal(f.queries.length,0);});
