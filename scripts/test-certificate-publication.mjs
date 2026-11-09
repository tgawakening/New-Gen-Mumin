import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const sharesModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/community/mum-certificate-points.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:sharesModule});

const permission = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/teacher/recognition-permissions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: permission });

function fixture({ parent = false, allowed = true, published = false, delegate = false } = {}) {
  const award = { id: 'award', badgeKey: parent ? 'MUM_OF_WEEK' : 'MUMIN_OF_WEEK', ...(parent ? { parentId: 'mum' } : { studentId: 'child' }), title: 'Weekly certificate', evidence: 'Kindness in class', description: 'Recognition', certificateCode: 'code', isPublic: published, revokedAt: null, awardedAt: new Date() };
  const ledger = new Map(published ? [['award', { points: 150 }]] : []), notices = [], emails = [], locks = [];
  const user = { id: 'teacher', role: delegate ? 'COMMUNICATIONS' : 'TEACHER', status: 'ACTIVE', email: allowed ? (delegate ? 'emancheman413@gmail.com' : 'mehranraziq@gmail.com') : 'other@example.com' };
  const awardModel = { findUnique: async () => award, update: async ({ data }) => Object.assign(award, data), findMany: async () => award.isPublic ? [{ id: award.id }] : [] };
  const student = { id: 'child', userId: 'learner', displayName: 'Learner', user: { email: 'child@example.com', firstName: 'Learner' }, houseMembership: { houseId: 'house', qabilaGroup: 'Qabila Banu Asad' }, parents: [{ parent: { userId: 'mother', user: { email: 'mum@example.com', firstName: 'Mum' } } }] };
  const links = [{ studentId: 'child', student }];
  const db = {
    user: { findUnique: async () => user },
    $queryRaw: async (...args) => locks.push(args),
    recognitionAward: parent ? { ...awardModel, findMany: async () => [] } : awardModel,
    parentRecognitionAward: parent ? awardModel : { ...awardModel, findMany: async () => [] },
    studentProfile: { findMany: async ({ where }) => links.filter(link => where.id.in.includes(link.studentId)).map(link => ({ ...link.student, id: link.studentId })), findUnique: async ({ where }) => where.id === student.id ? student : links.find(link => link.studentId === where.id)?.student ?? null },
    parentProfile: { findUnique: async () => ({ id: 'mum', userId: 'mother', user: { email: 'mum@example.com', firstName: 'Mum' } }) },
    parentStudent: { findMany: async () => links },
    housePointLedger: { createMany: async ({ data }) => { for (const row of data) { const key = row.studentId === 'child' ? row.sourceId : `${row.sourceId}:${row.studentId}`; if (!ledger.has(key)) ledger.set(key, row); } }, deleteMany: async () => ledger.clear() },
    notification: { createMany: async ({ data }) => notices.push(...data), deleteMany: async () => { notices.length = 0; } },
  };
  db.$transaction = async fn => fn(db);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/community/certificate-publication.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => ({ 'server-only': {}, '@/lib/db': { db }, '@/lib/community/mum-certificate-points':sharesModule, '@/lib/teacher/weekly-certificate-parents': { getWeeklyCertificateParents: async () => [{ id: 'mum', children: links.map(link => ({ id: link.studentId })) }] }, '@/lib/teacher/recognition-permissions': permission, '@/lib/email/notifications': { sendParentRecognitionEmail: async x => emails.push(x), sendRecognitionEarnedEmail: async x => emails.push(x) } })[id] });
  return { ...exports, db, award, student, actor: user, links, ledger, notices, emails, locks, input: { userId: 'teacher', awardId: 'award', parent, isPublic: true } };
}

for (const parent of [false, true]) {
  test(`${parent ? 'Mum' : 'Mumin'} missing public credit is repaired without resending notices; long reasons fit the ledger`, async () => {
    const f = fixture({ parent, published: true }); f.ledger.clear(); f.award.evidence = 'Excellent effort '.repeat(15);
    await f.setCertificatePublication(f.input);
    assert.equal(f.ledger.get('award').points, 150);
    assert.ok(f.ledger.get('award').reason.length <= 191);
    assert.equal(f.notices.length, 0); assert.equal(f.emails.length, 0);
    if (parent) assert.equal(f.award.pointsStudentId, null);
  });
  test(`${parent ? 'Mum' : 'Mumin'} cannot silently publish without a Qabila credit`, async () => {
    const f = fixture({ parent }); f.student.houseMembership.qabilaGroup = null;
    await assert.rejects(f.setCertificatePublication(f.input), /Assign.*Qabila/);
    assert.equal(f.ledger.size, 0); assert.equal(f.emails.length, 0);
  });
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

test('existing Mum credit is rebalanced across daughter and son without another email or extra points', async () => {
  const f = fixture({parent:true,published:true});
  f.links.push({studentId:'son',student:{houseMembership:{houseId:'boys',qabilaGroup:'Qabila Banu Asad'}}});
  await f.setCertificatePublication(f.input);
  assert.equal(f.ledger.size,2);
  assert.equal(f.ledger.get('award').points,75); assert.equal(f.ledger.get('award:son').points,75);
  assert.equal(f.ledger.get('award:son').houseId,'boys');
  assert.equal(f.emails.length,0); assert.equal(f.notices.length,0);
  await f.setCertificatePublication(f.input);
  assert.equal([...f.ledger.values()].reduce((sum,row)=>sum+row.points,0),150);
  await f.setCertificatePublication({...f.input,isPublic:false}); assert.equal(f.ledger.size,0);
  await f.setCertificatePublication(f.input); assert.equal(f.ledger.size,2);
});

test('Mum shares retain 150 total with deterministic whole-point remainders and skip unassigned duplicate records', () => {
  const links = ['d','c','b','a'].map(studentId=>({studentId,student:{houseMembership:{houseId:'house',qabilaGroup:'Qabila Banu Asad'}}}));
  links.push({studentId:'unassigned',student:{houseMembership:null}},links[0]);
  const shares = sharesModule.mumCertificateShares(links);
  assert.deepEqual(Array.from(shares,row=>row.points),[38,38,37,37]);
  assert.equal(shares.reduce((sum,row)=>sum+row.points,0),150);
  assert.deepEqual(Array.from(shares,row=>row.studentId),['a','b','c','d']);
});

test('joint weekly certificate gives 75 points to each child and notifies a shared parent once', async () => {
  const f = fixture();
  f.award.secondStudentId = 'sibling';
  const sibling = { ...f.student, id: 'sibling', userId: 'sibling-user', displayName: 'Sibling', user: { email: 'sibling@example.com', firstName: 'Sibling' }, houseMembership: { houseId: 'other-house', qabilaGroup: 'Other Qabila' } };
  f.links.push({ studentId: 'sibling', student: sibling });
  await f.setCertificatePublication(f.input);
  assert.equal(f.ledger.size, 2);
  assert.equal(f.ledger.get('award').points, 75);
  assert.equal(f.ledger.get('award:sibling').points, 75);
  assert.equal(f.ledger.get('award:sibling').houseId, 'other-house');
  assert.deepEqual(f.notices.map(n => n.userId).sort(), ['learner', 'mother', 'sibling-user']);
  assert.equal(f.emails.length, 3);
  assert.ok(f.emails.every(email => email.pointsBonus === 75 && email.rewardsPath === '/certificates/code'));
  await f.setCertificatePublication(f.input);
  assert.equal(f.ledger.size, 2); assert.equal(f.emails.length, 3);
  await f.setCertificatePublication({ ...f.input, isPublic: false });
  assert.equal(f.ledger.size, 0); assert.equal(f.notices.length, 0);
});
test('joint publication requires both children and both Qabilas', async () => {
  const f = fixture(); f.award.secondStudentId = 'sibling';
  await assert.rejects(f.setCertificatePublication(f.input), /Assign.*Qabila/);
  f.links.push({ studentId: 'sibling', student: { ...f.student, id: 'sibling', houseMembership: null } });
  await assert.rejects(f.setCertificatePublication(f.input), /Assign.*Qabila/);
  assert.equal(f.ledger.size, 0); assert.equal(f.notices.length, 0);
});

for (const parent of [false, true]) test(`Maliha can publish/hide ${parent ? 'Mum' : 'child'} certificates; suspension immediately blocks publication`, async () => {
  const f = fixture({ parent, delegate: true });
  await f.setCertificatePublication(f.input);
  assert.equal(f.award.isPublic, true); assert.equal(f.ledger.get('award').points, 150);
  await f.setCertificatePublication({ ...f.input, isPublic: false });
  assert.equal(f.ledger.size, 0);
  f.actor.status = 'SUSPENDED';
  await assert.rejects(f.setCertificatePublication(f.input), /cannot manage/);
});

test('Mum certificate publication credits an eligible enrolled child even without a direct ParentStudent row', async () => {
  const f = fixture({ parent: true });
  f.db.parentStudent.findMany = async () => { throw Error('The direct parent link is missing'); };
  await f.setCertificatePublication(f.input);
  assert.equal(f.award.isPublic, true);
  assert.equal(f.ledger.get('award').points, 150);
  assert.equal(f.ledger.get('award').studentId, 'child');
  assert.equal(f.notices[0].userId, 'mother');
});
