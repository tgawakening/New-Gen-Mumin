import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture({ parent = false, allowed = true, published = false } = {}) {
  const award = { id: 'award', badgeKey: parent ? 'MUM_OF_WEEK' : 'MUMIN_OF_WEEK', ...(parent ? { parentId: 'mum' } : { studentId: 'child' }), title: 'Weekly certificate', evidence: 'Kindness in class', description: 'Recognition', certificateCode: 'code', isPublic: published, revokedAt: null, awardedAt: new Date() };
  const ledger = new Map(published ? [['award', { points: 150 }]] : []), notices = [], emails = [], locks = [];
  const user = { id: 'teacher', role: 'TEACHER', email: allowed ? 'mehranraziq@gmail.com' : 'other@example.com' };
  const awardModel = { findUnique: async () => award, update: async ({ data }) => Object.assign(award, data), findMany: async () => award.isPublic ? [{ id: award.id }] : [] };
  const student = { id: 'child', userId: 'learner', displayName: 'Learner', user: { email: 'child@example.com', firstName: 'Learner' }, houseMembership: { houseId: 'house' }, parents: [{ parent: { userId: 'mother', user: { email: 'mum@example.com', firstName: 'Mum' } } }] };
  const db = {
    user: { findUnique: async () => user },
    $queryRaw: async (...args) => locks.push(args),
    recognitionAward: parent ? { ...awardModel, findMany: async () => [] } : awardModel,
    parentRecognitionAward: parent ? awardModel : { ...awardModel, findMany: async () => [] },
    studentProfile: { findUnique: async () => student },
    parentProfile: { findUnique: async () => ({ id: 'mum', userId: 'mother', user: { email: 'mum@example.com', firstName: 'Mum' } }) },
    parentStudent: { findMany: async () => [{ studentId: 'child', student }] },
    housePointLedger: { findFirst: async () => ledger.size ? { studentId: "child" } : null, createMany: async ({ data }) => { for (const row of data) if (!ledger.has(row.sourceId)) ledger.set(row.sourceId, row); }, deleteMany: async () => ledger.clear() },
    notification: { createMany: async ({ data }) => notices.push(...data), deleteMany: async () => { notices.length = 0; } },
  };
  db.$transaction = async fn => fn(db);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/community/certificate-publication.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => ({ 'server-only': {}, '@/lib/db': { db }, '@/lib/teacher/recognition-permissions': { canAwardWeeklyCertificates: user => user.email === 'mehranraziq@gmail.com' && user.role === 'TEACHER' }, '@/lib/email/notifications': { sendParentRecognitionEmail: async x => emails.push(x), sendRecognitionEarnedEmail: async x => emails.push(x) } })[id] });
  return { ...exports, award, ledger, notices, emails, locks, input: { userId: 'teacher', awardId: 'award', parent, isPublic: true } };
}

for (const parent of [false, true]) {
  test(`${parent ? 'Mum' : 'Mumin'} publication is private until published; retries never duplicate points or notifications`, async () => {
    const f = fixture({ parent });
    assert.equal(f.ledger.size, 0); assert.equal(f.emails.length, 0);
    await f.setCertificatePublication(f.input);
    assert.equal(f.award.isPublic, true); assert.equal(f.ledger.size, 1); assert.equal(f.ledger.get('award').points, 150);
    const messages = f.notices.length, emails = f.emails.length;
    assert.ok(messages > 0); assert.ok(emails > 0);
    await f.setCertificatePublication(f.input);
    assert.equal(f.ledger.size, 1); assert.equal(f.notices.length, messages); assert.equal(f.emails.length, emails);
    await f.setCertificatePublication({ ...f.input, isPublic: false });
    assert.equal(f.award.isPublic, false); assert.equal(f.ledger.size, 0); assert.equal(f.notices.length, 0); assert.equal(f.emails.length, emails);
    await f.setCertificatePublication(f.input);
    assert.equal(f.ledger.size, 1); assert.equal(f.ledger.get('award').points, 150);
    assert.equal(f.locks.length, 4);
  });
  test(`${parent ? 'Mum' : 'Mumin'} existing public certificates can be hidden in bulk without deletion`, async () => {
    const f = fixture({ parent, published: true });
    await f.hideAllWeeklyCertificates('teacher');
    assert.equal(f.award.isPublic, false); assert.equal(f.ledger.size, 0); assert.equal(f.award.id, 'award');
  });
}
test('unauthorized teachers cannot publish, hide, or bulk hide certificates', async () => {
  const f = fixture({ allowed: false });
  await assert.rejects(f.setCertificatePublication(f.input), /cannot manage/);
  await assert.rejects(f.hideAllWeeklyCertificates('teacher'), /cannot manage/);
  assert.equal(f.locks.length, 0); assert.equal(f.ledger.size, 0);
});
test('revoked awards and separate student badges cannot be published as weekly certificates', async () => {
  const f = fixture(); f.award.badgeKey = 'HELPER';
  await assert.rejects(f.setCertificatePublication(f.input), /not found/);
  f.award.badgeKey = 'MUMIN_OF_WEEK'; f.award.revokedAt = new Date();
  await assert.rejects(f.setCertificatePublication(f.input), /not found/);
  assert.equal(f.ledger.size, 0);
});
