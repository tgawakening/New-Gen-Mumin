import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, URL, URLSearchParams, console, require: id => id === 'server-only' ? {} : id in deps ? deps[id] : require(id) });
  return exports;
}
const terms = [{ id: 'term1', title: 'Term 1' }, { id: 'term2', title: 'Term 2' }];
function sharingFixture() {
  const teacher = { id: 'teacher', user: { role: 'TEACHER' }, programAssignments: [{ programId: 'program', program: { slug: 'seerah' } }], specialties: { list: ['Teaching'], curriculumOverrides: { saved: { title: 'Keep me' } } } };
  const clears = [];
  const tx = { $queryRaw: async () => [], teacherProfile: { findUnique: async () => teacher, update: async ({ data }) => Object.assign(teacher, data) }, notification: { updateMany: async input => clears.push(input) } };
  const db = { teacherProfile: { findMany: async () => [teacher] }, $transaction: fn => fn(tx) };
  const service = load('src/lib/curriculum/handover.ts', { '@/lib/db': { db }, '@/lib/genm/curriculum': { genMTerms: terms }, '@/lib/teacher/programme-scope': { canSeeTeacherProgramme: () => true } });
  return { ...service, teacher, clears };
}
test('handover defaults on, scopes by programme/module and resolves legacy week labels', async () => {
  const f = sharingFixture();
  assert.equal(f.moduleIsShared({}, 'program', 'term1'), true);
  assert.equal(f.curriculumModule(null, 'Term 2 Week 1'), 'term2');
  await f.saveModuleSharing('user', 'program', 'term2', false);
  const sharing = await f.loadModuleSharing(['program']);
  assert.equal(f.moduleIsShared(sharing, 'program', 'term2'), false);
  assert.equal(f.moduleIsShared(sharing, 'program', 'term1'), true);
  assert.equal(f.moduleIsShared(sharing, 'other', 'term2'), true);
  assert.equal(f.teacher.specialties.curriculumOverrides.saved.title, 'Keep me');
  assert.equal(f.clears.length, 1);
  await f.saveModuleSharing('user', 'program', 'term2', true);
  assert.equal(f.moduleIsShared(await f.loadModuleSharing(['program']), 'program', 'term2'), true);
});
test('unassigned programmes and invalid modules cannot be modified', async () => {
  const f = sharingFixture();
  await assert.rejects(() => f.saveModuleSharing('user', 'other', 'term1', false));
  await assert.rejects(() => f.saveModuleSharing('user', 'program', 'invalid', false));
  assert.equal(f.clears.length, 0);
});
function notificationFixture(enabled = true) {
  const notes = [], emails = [];
  const parent = { userId: 'parent', user: { email: 'parent@example.com', firstName: 'Parent' } };
  const enrollment = id => ({ studentId: id, student: { displayName: id, user: { firstName: id }, parents: [{ parent }] }, parent });
  const db = {
    enrollment: { findMany: async () => [enrollment('child'), enrollment('outside-roster')] },
    teacherStudentRoster: { findMany: async () => [{ studentId: 'child' }] }, program: { findUnique: async () => ({ title: 'Seerah' }) },
    notification: { findFirst: async ({ where }) => notes.find(note => note.href === where.href && note.userId === where.userId), create: async ({ data }) => notes.push(data) },
  };
  const { notifyCurriculumParents } = load('src/lib/curriculum/notifications.ts', { '@/lib/db': { db }, '@/lib/curriculum/handover': { curriculumModule: () => 'term1', loadModuleSharing: async () => ({}), moduleIsShared: () => enabled }, '@/lib/email/notifications': { sendCurriculumUpdateEmail: async input => { if (!emails.some(email => email.deduplicationKey === input.deduplicationKey)) emails.push(input); } } });
  return { notifyCurriculumParents, notes, emails };
}
const update = { programId: 'program', teacherUserId: 'teacher', title: 'New lesson', kind: 'lesson', contentId: 'lesson1', version: 'v1' };
test('hidden modules create neither parent alerts nor email', async () => {
  const f = notificationFixture(false);
  await f.notifyCurriculumParents(update);
  assert.equal(f.notes.length, 0); assert.equal(f.emails.length, 0);
});
test('relevant parents receive one alert/email per version, including lesson and material updates', async () => {
  const f = notificationFixture();
  await f.notifyCurriculumParents(update); await f.notifyCurriculumParents(update);
  assert.equal(f.notes.length, 1); assert.equal(f.emails.length, 1);
  assert.ok(f.notes[0].href.includes('&child=child&'));
  await f.notifyCurriculumParents({ ...update, updated: true, version: 'v2' });
  await f.notifyCurriculumParents({ ...update, kind: 'material', contentId: 'file1' });
  assert.equal(f.notes.length, 3); assert.equal(f.emails.length, 3);
  assert.ok(f.notes[1].title.startsWith('Updated curriculum lesson'));
  assert.ok(f.notes.every(note => note.userId === 'parent' && !note.body.includes('[v')));
});
test('mark reviewed is parent-only and can update only the signed-in parent’s curriculum snapshots', async () => {
  let user = { id: 'parent', role: 'PARENT' }, query;
  const { markCurriculumReviewed } = load('src/lib/curriculum/review.ts', { 'next/cache': { revalidatePath: () => {} }, '@/lib/auth/session': { getCurrentSession: async () => ({ user }) }, '@/lib/db': { db: { notification: { updateMany: async input => query = input } } } });
  const form = new FormData(); form.set('notificationIds', JSON.stringify(['viewed-version']));
  await markCurriculumReviewed(form);
  assert.equal(query.where.userId, 'parent');
  assert.equal(query.where.id.in[0], 'viewed-version');
  assert.equal(query.where.href.startsWith, '/parent/curriculum?');
  user = { id: 'student', role: 'STUDENT' };
  await assert.rejects(() => markCurriculumReviewed(form));
});
test('opening the bell excludes curriculum alerts from automatic read clearing', async () => {
  let query;
  const { POST } = load('src/app/api/notifications/read/route.ts', { 'next/server': { NextResponse: { json: value => value } }, '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'parent' } }) }, '@/lib/db': { db: { notification: { updateMany: async input => query = input } } } });
  await POST({ json: async () => ({}) });
  assert.equal(query.where.userId, 'parent');
  assert.equal(query.where.OR[1].NOT.href.startsWith, '/parent/curriculum?');
});
