import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, Intl, URLSearchParams, console, require: id => id === 'server-only' ? {} : id in deps ? deps[id] : require(id) });
  return exports;
}
const timing = load('src/lib/homework/timing.ts');
test('launch is enforced at its boundary; no launch means immediately available', () => {
  assert.equal(timing.homeworkIsOpen(null), true);
  assert.equal(timing.homeworkIsOpen('2026-10-30T12:00:00Z', new Date('2026-10-30T11:59:59Z')), false);
  assert.equal(timing.homeworkIsOpen('2026-10-30T12:00:00Z', new Date('2026-10-30T12:00:00Z')), true);
});
test('submission timing distinguishes missing, on-time including exact deadline, and late', () => {
  const due = new Date('2026-10-30T23:59:59.999Z');
  assert.equal(timing.homeworkTiming(null, due), 'Not submitted');
  assert.equal(timing.homeworkTiming(due, due), 'Submitted on time');
  assert.equal(timing.homeworkTiming(new Date(+due + 1), due), 'Submitted late');
  assert.equal(timing.homeworkTiming(due, null), 'Submitted on time');
});
test('teacher homework rows include missing roster students and exclude other teachers students', () => {
  const { homeworkReviewRows } = load('src/lib/homework/review-roster.ts', { '@/lib/homework/timing': timing });
  const due = new Date('2026-10-30T10:00:00Z');
  const work = { id: 'one', studentId: 'child', status: 'SUBMITTED', submittedAt: new Date(+due + 1), submissionText: 'Answer', score: null, grade: null, feedback: null, attachmentUrl: null };
  const rows = homeworkReviewRows('task', [{ id: 'child', name: 'Learner' }, { id: 'missing', name: 'Waiting learner' }], [work, { ...work, id: 'outside', studentId: 'outsider' }], new Map([['one', 25]]), due);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].submissionTiming, 'Submitted late');
  assert.equal(rows[0].homeworkPoints, 25);
  assert.equal(rows[1].submissionTiming, 'Not submitted');
  assert.equal(rows[1].canReview, false);
});
test('date-only deadlines include the whole local day and handle London daylight-saving changes', () => {
  const pakistan = timing.homeworkWindow('2026-10-30', '2026-10-30', 'Asia/Karachi');
  assert.equal(pakistan.launchAt, '2026-10-29T19:00:00.000Z');
  assert.equal(pakistan.dueDate.toISOString(), '2026-10-30T18:59:59.999Z');
  const london = timing.homeworkWindow('2026-10-25', '2026-10-25', 'Europe/London');
  assert.equal(london.launchAt, '2026-10-24T23:00:00.000Z');
  assert.equal(london.dueDate.toISOString(), '2026-10-25T23:59:59.999Z');
  assert.throws(() => timing.homeworkWindow('2026-11-01', '2026-10-30', 'UTC'));
  assert.throws(() => timing.homeworkDate('2026-02-30', 'UTC'));
});
test('task launch metadata survives parsing; older tasks remain available', () => {
  const payload = load('src/lib/genm/published-content.ts');
  const task = payload.parseTaskPayload(payload.buildTaskPayload({ title: 'Work', instructions: 'Read', launchAt: '2026-11-01T00:00:00Z', timezone: 'UTC' }));
  assert.equal(task.launchAt, '2026-11-01T00:00:00Z');
  assert.equal(payload.parseTaskPayload('Legacy work').launchAt, null);
  assert.equal(payload.parseTaskPayload('__GENM_TASK__:{invalid').launchAt, null);
});
function submissionFixture() {
  let saved = null, locks = 0;
  const tx = { $queryRaw: async () => { locks++; }, assignmentSubmission: {
    findFirst: async () => saved,
    create: async ({ data }) => saved = { id: 'submission', updatedAt: new Date(), ...data },
    update: async ({ data }) => saved = { ...saved, ...data },
  } };
  tx.billingEmailJob = { upsert: async () => ({}) };
  const service = load('src/lib/homework/submission.ts', { '@/lib/db': { db: { $transaction: fn => fn(tx) } } });
  return { ...service, saved: () => saved, locks: () => locks };
}
const submission = { assignmentId: 'work', studentId: 'child', enrollmentId: 'enrollment', submissionText: 'My answer', attachmentUrl: 'https://example.com/file' };
test('updating homework preserves first submission time and file; blank first submissions are rejected', async () => {
  const f = submissionFixture();
  const first = await f.saveHomeworkSubmission(submission);
  first.submittedAt = new Date('2026-10-29T10:00:00Z');
  const update = await f.saveHomeworkSubmission({ ...submission, submissionText: 'Revised answer', attachmentUrl: null });
  assert.equal(update.id, first.id);
  assert.equal(update.submittedAt.toISOString(), '2026-10-29T10:00:00.000Z');
  assert.equal(update.attachmentUrl, submission.attachmentUrl);
  assert.equal(f.locks(), 2);
  await assert.rejects(() => submissionFixture().saveHomeworkSubmission({ ...submission, submissionText: '', attachmentUrl: null }));
});
function awardFixture() {
  const notifications = [];
  const teachers = [
    { id: 't1', userId: 'teacher1', user: { role: 'TEACHER', status: 'ACTIVE' }, programAssignments: [{ program: { id: 'arabic' } }] },
    { id: 't2', userId: 'teacher2', user: { role: 'TEACHER', status: 'ACTIVE' }, programAssignments: [{ program: { id: 'arabic' } }] },
    { id: 't3', userId: 'teacher3', user: { role: 'TEACHER', status: 'ACTIVE' }, programAssignments: [{ program: { id: 'seerah' } }] },
  ];
  const notification = { findFirst: async ({ where }) => notifications.find(row => row.href === where.href) ?? null, findMany: async ({ where }) => notifications.filter(row => row.href === where.href && where.userId.in.includes(row.userId)), createMany: async ({ data }) => notifications.push(...data) };
  const db = { teacherProfile: { findUnique: async ({ where }) => teachers.find(row => row.userId === where.userId), findMany: async () => teachers }, notification, $transaction: fn => fn({ notification, $queryRaw: async () => [] }) };
  const service = load('src/lib/teacher/recognition-roster.ts', { '@/lib/db': { db }, '@/lib/live-classes/service': {
    createReadOnlyRosterResolver: () => ({ warm: async () => {}, read: { eligible: async id => id === 'arabic' ? [{ id: 'child' }, { id: 'other' }] : [{ id: 'child' }] } }),
    getTeacherProgramRosterEntries: async id => id === 't1' ? [{ programId: 'arabic', studentId: 'child' }] : id === 't2' ? [{ programId: 'arabic', studentId: 'other' }] : [],
    getTeacherRosterAssignments: teacher => teacher.programAssignments,
  } });
  return { ...service, notifications };
}
test('badge alerts reach relevant rosters without duplicate certificate badges or retry alerts', async () => {
  const f = awardFixture();
  for (const badgeKey of ['CONSISTENT', 'HELPER', 'MUMIN_OF_WEEK']) {
    const award = { id: badgeKey, studentId: 'child', studentName: 'Learner', badgeKey, title: badgeKey, evidence: 'Helpful effort.' };
    await f.notifyRosterTeachersOfAward(award);
    await f.notifyRosterTeachersOfAward(award);
  }
  assert.equal(f.notifications.length, 4);
  assert.deepEqual([...new Set(f.notifications.map(row => row.userId))].sort(), ['teacher1', 'teacher3']);
  assert.ok(f.notifications.every(row => row.href.includes('badgeImage=') && row.href.includes('awardStudent=child') && row.body.includes('in class')));
});
test('notification thumbnail only accepts approved badge keys on teacher award links', () => {
  const { notificationBadge } = load('src/components/badges/BadgeEmblem.tsx');
  assert.equal(notificationBadge('/teacher/recognition?badgeImage=CONSISTENT#roster-awards'), 'CONSISTENT');
  assert.equal(notificationBadge('/teacher/recognition?badgeImage=unknown'), null);
  assert.equal(notificationBadge('https://example.com/?badgeImage=HELPER'), null);
});
test('revoked or private achievements do not create teacher alerts', async () => {
  const f = awardFixture();
  const award = { id: 'hidden', studentId: 'child', studentName: 'Learner', badgeKey: 'HELPER', title: 'Helper', evidence: null };
  await f.notifyRosterTeachersOfAward({ ...award, isPublic: false });
  await f.notifyRosterTeachersOfAward({ ...award, revokedAt: new Date() });
  assert.equal(f.notifications.length, 0);
});
test('award history remains scoped to roster IDs and applies bounded pagination and certificate filtering', async () => {
  const queries = [];
  const db = { recognitionAward: { count: async input => { queries.push(input); return 25; }, groupBy: async () => [], findMany: async input => { queries.push(input); return []; } } };
  const { RosterAwards } = load('src/components/dashboard/teacher/RosterAwards.tsx', { '@/lib/db': { db }, 'next/link': { default: 'a' }, '@/components/badges/BadgeEmblem': { BadgeEmblem: () => null }, '@/components/badges/EarnedBadgeArtwork': { EarnedBadgeArtwork: () => null } });
  await RosterAwards({ students: [{ id: 'child', name: 'Learner' }], filters: { awardStudent: 'outsider', awardPage: '99999999', awardKind: 'certificate' } });
  const query = queries.at(-1);
  assert.deepEqual(Array.from(query.where.studentId.in), ['child']);
  assert.equal(query.where.badgeKey, 'MUMIN_OF_WEEK');
  assert.equal(query.where.revokedAt, null);
  assert.equal(query.skip, 20);
  assert.equal(query.take, 10);
});
