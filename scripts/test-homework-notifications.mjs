import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
function load(file, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl, Map, Set, URL, URLSearchParams, console, require: name => name === 'server-only' ? {} : deps[name] });
  return exports;
}
const payload = load('src/lib/genm/published-content.ts', {});
const timing = load('src/lib/homework/timing.ts', {});
function fixture({ future = false, shared = true, failEmail = false } = {}) {
  const emails = [], notifications = new Map(), jobs = [], updates = [];
  const parent = (id) => ({ userId: id, user: { email: `${id}@example.com`, firstName: id } });
  const student = { id: 'child', userId: 'student', displayName: 'Learner', user: { email: 'student@example.com', firstName: 'Learner' }, parents: [{ parent: parent('mum') }, { parent: parent('dad') }] };
  const assignment = { id: 'task', programId: 'seerah', program: { title: 'Seerah', slug: 'seerah' }, title: 'Read the lesson', dueDate: new Date('2026-12-01'), instructions: payload.buildTaskPayload({ title: 'Read', instructions: 'Answer', launchAt: future ? '2099-01-01T00:00:00Z' : null, weekLabel: 'Week 1' }) };
  const teacher = { userId: 'owner', user: { role: 'TEACHER', status: 'ACTIVE', email: 'owner@example.com', firstName: 'Teacher' }, programAssignments: [{ programId: 'seerah' }], programRosters: [{ programId: 'seerah', studentId: 'child' }] };
  const submission = { id: 'submission', studentId: student.id, student, assignment, submittedAt: new Date(), updatedAt: new Date('2026-10-31T12:00:00Z') };
  assignment.program.teacherAssignments = [{ teacher }, { teacher: { ...teacher, userId: 'other', user: { ...teacher.user, email: 'other@example.com' } } }];
  const db = {
    assignment: { findUnique: async () => assignment, create: async () => assignment },
    assignmentSubmission: { findUnique: async () => submission },
    teacherProfile: { findUnique: async () => teacher },
    enrollment: { findMany: async () => [{ studentId: student.id, student, parent: parent('mum') }, { studentId: 'outsider', student: { ...student, id: 'outsider' }, parent: parent('outside') }] },
    notification: { upsert: async ({ where, create }) => { if (!notifications.has(where.id)) notifications.set(where.id, create); } },
    billingEmailJob: { create: async query => jobs.push(query.data), findUnique: async () => ({ payload: { teacherUserId: 'owner' } }), findMany: async () => jobs, updateMany: async query => { updates.push(query); return { count: 1 }; } },
  };
  db.$transaction = async fn => fn(db);
  const service = load('src/lib/homework/notifications.ts', { 'node:crypto': crypto, '@/lib/db': { db }, '@/lib/genm/published-content': payload, '@/lib/homework/timing': timing, '@/lib/curriculum/handover': { loadModuleSharing: async () => ({}), moduleIsShared: () => shared }, '@/lib/teacher/programme-scope': { canSeeTeacherProgramme: () => true }, '@/lib/email/notifications': { sendStudentTaskAssignedEmail: async input => { emails.push(input); return failEmail ? { failed: true } : {}; }, sendHomeworkSubmittedEmail: async input => { emails.push(input); return {}; } } });
  return { ...service, assignment, submission, teacher, emails, notifications, jobs, updates };
}
test('all linked parents receive their child and programme link even when the student has a deliverable email', async () => {
  const f = fixture(); await f.notifyHomeworkLaunch('task', 'owner');
  assert.deepEqual(f.emails.map(mail => mail.toEmail).sort(), ['dad@example.com', 'mum@example.com', 'student@example.com']);
  assert.equal(f.notifications.size, 3);
  for (const email of f.emails) { assert.equal(email.programTitle, 'Seerah'); assert.equal(email.weekLabel, 'Week 1'); assert.ok(email.deduplicationKey.startsWith('homework:')); assert.ok(email.completionPath.startsWith(email.parentView ? '/parent/homework?child=child&task=task' : '/student/homework?task=task')); }
  await f.notifyHomeworkLaunch('task', 'owner'); assert.equal(f.notifications.size, 3);
  assert.equal(new Set(f.emails.map(email => email.deduplicationKey)).size, 3);
});
test('future launches and private curriculum modules do not send premature alerts or emails', async () => {
  for (const options of [{ future: true }, { shared: false }]) { const f = fixture(options); const result = await f.notifyHomeworkLaunch('task', 'owner'); assert.ok(result.deferUntil); assert.equal(f.emails.length, 0); assert.equal(f.notifications.size, 0); }
});
test('saving homework atomically queues a durable job at its actual launch time', async () => {
  const f = fixture(); await f.createHomeworkWithNotification({ data: { programId: 'seerah', title: 'Read' } }, 'owner', '2099-01-01T10:00:00Z');
  assert.equal(f.jobs[0].kind, 'HOMEWORK_LAUNCH'); assert.equal(f.jobs[0].recordId, 'task'); assert.equal(f.jobs[0].nextAttemptAt.toISOString(), '2099-01-01T10:00:00.000Z');
});
test('portal alerts are created for every recipient even when an email needs retrying', async () => {
  const f = fixture({ failEmail: true }); await assert.rejects(f.notifyHomeworkLaunch('task', 'owner'), /deferred/); assert.equal(f.notifications.size, 3);
});
test('submission emails and review links go only to the responsible roster teacher', async () => {
  const f = fixture(); await f.notifyHomeworkSubmission('submission', f.submission.updatedAt.toISOString());
  assert.equal(f.emails.length, 1); assert.equal(f.emails[0].toEmail, 'owner@example.com'); assert.equal(f.emails[0].reviewPath, '/teacher/homework?task=task#homework-task');
  assert.equal([...f.notifications.values()][0].userId, 'owner');
});
test('superseded submissions and teachers outside the student roster do not receive alerts', async () => {
  const f = fixture(); await f.notifyHomeworkSubmission('submission', '2000-01-01T00:00:00Z'); assert.equal(f.emails.length, 0);
  f.teacher.programRosters = [{ programId: 'seerah', studentId: 'another-child' }]; await f.notifyHomeworkSubmission('submission'); assert.equal(f.emails.length, 0);
});
test('failed launch emails return to the durable queue with a retry time', async () => {
  const f = fixture({ failEmail: true }); f.jobs.push({ id: 'job', kind: 'HOMEWORK_LAUNCH', recordId: 'task', payload: { teacherUserId: 'owner' }, attempts: 0 });
  await f.deliverHomeworkNotifications(); assert.equal(f.updates[0].data.status, 'HOMEWORK_PROCESSING'); assert.equal(f.updates.at(-1).data.status, 'HOMEWORK_PENDING'); assert.ok(f.updates.at(-1).data.nextAttemptAt > new Date());
});
