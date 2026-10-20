import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
function fixture(recipientName, displayName = 'Registered Name') {
  const award = { recipientName, student: { displayName, userId: 'student', user: { firstName: 'Account', lastName: 'Name' }, parents: [], registrationStudents: [], houseMembership: null }, isPublic: true, revokedAt: null, featuredWeek: '2026-10-19', awardedAt: new Date(), title: 'Mumin of the Week', evidence: 'Helping classmates', certificateCode: 'certificate' };
  const Certificate = () => null, Actions = () => null;
  const dependencies = {
    'react/jsx-runtime': jsxRuntime,
    '@/components/dashboard/RecognitionCertificate': { RecognitionCertificate: Certificate },
    '@/components/dashboard/CertificateActions': { CertificateActions: Actions },
    '@/lib/community/recognition-week': { recognitionWeekLabel: () => 'Week of 19 October' },
    'next/navigation': { notFound: () => { throw Error('not found'); }, redirect: () => { throw Error('login'); } },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'student', role: 'STUDENT' } }) },
    '@/lib/community/qabilas': { qabilaProfile: () => award.student.houseMembership?.profile ?? null },
    '@/lib/db': { db: { recognitionAward: { findUnique: async () => award } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/certificates/[code]/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return { render: () => exports.default({ params: Promise.resolve({ code: 'certificate' }) }), Certificate, Actions, award };
}
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) { const result = find(child, type); if (result) return result; }
  return null;
}
for (const [label, recipientName, displayName, expected] of [
  ['saved certificate name overrides registered name', 'Corrected Name', 'Registered Name', 'Corrected Name'],
  ['registered name is used for older certificates', null, 'Registered Name', 'Registered Name'],
  ['blank certificate name uses registered name', '   ', 'Registered Name', 'Registered Name'],
  ['account name remains the final fallback', null, '', 'Account Name'],
]) test(label, async () => {
  const f = fixture(recipientName, displayName), tree = await f.render();
  assert.equal(find(tree, f.Certificate).props.name, expected);
  assert.equal(find(tree, f.Actions).props.filename, expected + ' Mumin of the Week');
});
test('revoked certificates remain inaccessible', async () => { const f = fixture('Corrected Name'); f.award.revokedAt = new Date(); await assert.rejects(f.render(), /not found/); });

for (const gender of ['Girl', 'Female', 'F', ' female ']) test('girl certificate title and filename: ' + gender, async () => {
  const f = fixture('Corrected Name'); f.award.student.registrationStudents = [{ gender }];
  const tree = await f.render(), certificate = find(tree, f.Certificate).props;
  assert.equal(certificate.title, 'Mumina of the Week');
  assert.equal(certificate.recognition, 'Mumina of the Week');
  assert.equal(certificate.kind, 'girl');
  assert.equal(find(tree, f.Actions).props.filename, 'Corrected Name Mumina of the Week');
});
for (const gender of ['Boy', 'Male', 'M']) test('boy certificate title: ' + gender, async () => {
  const f = fixture('Corrected Name'); f.award.student.registrationStudents = [{ gender }];
  const certificate = find(await f.render(), f.Certificate).props;
  assert.equal(certificate.title, 'Mumin of the Week'); assert.equal(certificate.kind, 'boy');
});
test('gender-specific Qabila provides fallback when registration gender is missing', async () => {
  const f = fixture('Corrected Name'); f.award.student.houseMembership = { profile: { gender: 'GIRLS' } };
  assert.equal(find(await f.render(), f.Certificate).props.title, 'Mumina of the Week');
  f.award.student.registrationStudents = [{ gender: 'Boy' }];
  assert.equal(find(await f.render(), f.Certificate).props.title, 'Mumin of the Week');
});
test('character awards retain their badge description', async () => {
  const f = fixture('Corrected Name'); f.award.student.registrationStudents = [{ gender: 'Girl' }];
  f.award.title = 'The Helper'; f.award.featuredWeek = null;
  const certificate = find(await f.render(), f.Certificate).props;
  assert.equal(certificate.title, 'Certificate of Character'); assert.equal(certificate.recognition, 'The Helper');
});
