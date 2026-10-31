import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl, URL, require: id => id === 'server-only' ? {} : deps[id] });
  return exports;
}
const payload = load('src/lib/genm/published-content.ts');
const timing = load('src/lib/homework/timing.ts');
function fixture({ allowed = true, scoped = true } = {}) {
  const writes = [], uploads = [];
  const task = { id: 'work', programId: 'program', program: { slug: 'seerah' }, title: 'Old homework', dueDate: new Date('2026-11-07T23:59:59.999Z'), instructions: payload.buildTaskPayload({ title: 'Old homework', instructions: 'Read', instructorName: 'Original teacher', termId: 'term1', lessonId: 'lesson', timezone: 'UTC', attachments: [{ id: 'file1', name: 'Keep.pdf', url: 'https://example.com/keep', mimeType: 'application/pdf' }, { id: 'file2', name: 'Remove.pdf', url: 'https://example.com/remove', mimeType: 'application/pdf' }] }) };
  const db = { teacherProfile: { findUnique: async () => ({ user: { role: 'TEACHER', timezone: 'UTC' }, programAssignments: allowed ? [{ programId: 'program' }] : [] }) }, assignment: { findUnique: async () => task, update: async query => { writes.push(query); return { ...task, ...query.data }; }, delete: async query => writes.push(query) } };
  const service = load('src/lib/homework/manage.ts', { '@/lib/db': { db }, '@/lib/teacher/programme-scope': { canSeeTeacherProgramme: () => scoped }, '@/lib/genm/published-content': payload, '@/lib/homework/timing': timing, '@/lib/google-drive/materials': { uploadTeacherMaterial: async input => { uploads.push(input); return { id: 'new-file', name: input.file.name, webViewLink: 'https://example.com/new', mimeType: 'text/plain' }; } } });
  return { ...service, task, writes, uploads };
}
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ taskId: 'work', title: 'Updated homework', instructions: 'Read and answer', launchDate: '', dueDate: '2026-11-07T23:59', resourceLinks: 'https://example.com/reading', familyNote: 'Please support your child' })) data.set(key, value);
  data.append('keepAttachment', 'file1');
  return data;
}
test('edits preserve lesson metadata and unchanged deadline precision, and only update the assignment', async () => {
  const f = fixture();
  const result = await f.updateTeacherHomework('teacher', form());
  const parsed = payload.parseTaskPayload(result.instructions);
  assert.equal(result.title, 'Updated homework');
  assert.equal(result.dueDate.toISOString(), '2026-11-07T23:59:59.999Z');
  assert.equal(parsed.lessonId, 'lesson'); assert.equal(parsed.instructorName, 'Original teacher');
  assert.equal(parsed.attachments.length, 1); assert.equal(parsed.attachments[0].id, 'file1');
  assert.deepEqual(Object.keys(f.writes[0].data).sort(), ['dueDate', 'instructions', 'title']);
});
test('additional files are appended while selected existing files are retained', async () => {
  const f = fixture(), input = form(); input.append('files', new Blob(['homework']), 'new.txt');
  const result = await f.updateTeacherHomework('teacher', input);
  assert.equal(payload.parseTaskPayload(result.instructions).attachments.length, 2);
  assert.equal(f.uploads[0].termId, 'term1');
  assert.equal(f.uploads[0].suppressNotifications, true);
});
test('unassigned or excluded programmes cannot be edited or deleted', async () => {
  for (const options of [{ allowed: false }, { scoped: false }]) {
    const f = fixture(options);
    await assert.rejects(() => f.updateTeacherHomework('teacher', form()));
    await assert.rejects(() => f.deleteTeacherHomework('teacher', 'work'));
    assert.equal(f.writes.length, 0);
  }
});
test('invalid dates and resource links are rejected before database updates', async () => {
  for (const [key, value] of [['dueDate', 'not-a-date'], ['resourceLinks', 'javascript:alert(1)'], ['title', '']]) {
    const f = fixture(), input = form(); input.set(key, value);
    await assert.rejects(() => f.updateTeacherHomework('teacher', input));
    assert.equal(f.writes.length, 0);
  }
});
test('delete removes the authorized task without changing earned point ledger entries', async () => {
  const f = fixture(); await f.deleteTeacherHomework('teacher', 'work');
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].where.id, 'work');
});
