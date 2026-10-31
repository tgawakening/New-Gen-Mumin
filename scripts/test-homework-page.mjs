import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, Intl, URL, require: id => id in deps ? deps[id] : require(id) });
  return exports;
}
const payload = load('src/lib/genm/published-content.ts');
async function render(instructions, { role = 'TEACHER', hidden = false } = {}) {
  const task = { id: 'work', programId: 'program', programTitle: 'Seerah', title: 'My homework', instructions, dueDate: new Date('2026-11-02T23:59:59Z'), submissionDetails: [{ canReview: true, submissionTiming: 'Submitted late' }, { canReview: false, submissionTiming: 'Not submitted' }] };
  const wrapper = ({ children }) => React.createElement('section', null, children);
  const { default: Page } = load('src/app/teacher/homework/page.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { redirect: href => { throw Error(`redirect:${href}`); } },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'teacher', role } }), getDashboardHome: () => '/parent' },
    '@/lib/teacher/dashboard': { getTeacherDashboardData: async () => ({ profile: { timezone: 'Europe/London' }, rosters: [{ programId: 'program', title: 'Seerah' }], moduleSharing: {}, assignments: [task] }) },
    '@/lib/teacher/nav': { getTeacherNavItems: () => [] },
    '@/lib/genm/published-content': payload,
    '@/lib/genm/curriculum': { getGenMProgrammeByTitle: () => ({ slug: 'seerah' }), isArabicTajweedSlug: () => false },
    '@/lib/community/point-rules': { HOUSE_POINT_RULES: { HOMEWORK_SUBMITTED: { points: 10 } } },
    '@/lib/curriculum/handover': { moduleIsShared: () => !hidden },
    '@/lib/homework/timing': load('src/lib/homework/timing.ts'),
    '@/components/dashboard/teacher/TeacherDashboardFrame': { TeacherDashboardFrame: wrapper, TeacherSection: wrapper },
  });
  return renderToStaticMarkup(await Page());
}
test('structured homework displays readable instructions and named files, never internal JSON', async () => {
  const html = await render(payload.buildTaskPayload({ title: 'Work', instructions: 'Read the story and answer the questions.', attachments: [{ id: 'file', name: 'Story worksheet.pdf', url: 'https://drive.google.com/file/d/example/view', mimeType: 'application/pdf', thumbnailUrl: 'https://example.com/internal-thumbnail' }], resourceLinks: ['javascript:alert(1)', 'https://example.com/reading'] }));
  assert.match(html, /Read the story and answer the questions/);
  assert.match(html, /Story worksheet.pdf/);
  assert.match(html, /https:\/\/drive.google.com\/file\/d\/example\/view/);
  assert.doesNotMatch(html, /__GENM_TASK__|thumbnailUrl|mimeType|internal-thumbnail|javascript:/);
  assert.match(html, /1 received · 1 not submitted · 1 late/);
  assert.match(html, /\/teacher\/course-builder\/seerah\?tab=task#homework-work/);
});
test('legacy instructions remain readable and corrupt metadata is not printed', async () => {
  assert.match(await render('Practise your reading.'), /Practise your reading/);
  assert.doesNotMatch(await render('__GENM_TASK__:{broken'), /__GENM_TASK__|\{broken/);
});
test('scheduled and hidden homework have accurate visibility labels', async () => {
  const instructions = payload.buildTaskPayload({ title: 'Work', instructions: 'Read', launchAt: '2099-01-01T00:00:00Z' });
  assert.match(await render(instructions), />Scheduled</);
  assert.match(await render(instructions, { hidden: true }), /Hidden from families/);
});
test('other account roles cannot load teacher homework', async () => {
  await assert.rejects(() => render('Read', { role: 'PARENT' }), /redirect:\/parent/);
});
test('launch defaults to the current local time and deadline to seven calendar days later', () => {
  const timing = load('src/lib/homework/timing.ts');
  const dates = timing.homeworkDateDefaults('Asia/Karachi', new Date('2026-10-31T12:35:00Z'));
  assert.equal(dates.launch, '2026-10-31T17:35');
  assert.equal(dates.due, '2026-11-07T17:35');
});
test('timed deadlines use the exact local minute and teachers may override the one-week default', () => {
  const timing = load('src/lib/homework/timing.ts');
  const dates = timing.homeworkWindow('2026-10-31T17:35', '2026-11-14T18:00', 'Asia/Karachi');
  assert.equal(dates.launchAt, '2026-10-31T12:35:00.000Z');
  assert.equal(dates.dueDate.toISOString(), '2026-11-14T13:00:00.000Z');
  assert.equal(timing.homeworkTiming(dates.dueDate, dates.dueDate), 'Submitted on time');
  assert.equal(timing.homeworkTiming(new Date(+dates.dueDate + 1), dates.dueDate), 'Submitted late');
  assert.throws(() => timing.homeworkDate('2027-03-28T01:30', 'Europe/London'));
});
test('lesson-specific assignment metadata survives parsing without affecting programme tasks', () => {
  assert.equal(payload.parseTaskPayload(payload.buildTaskPayload({ title: 'Read', instructions: 'Practise', lessonId: 'lesson-one' })).lessonId, 'lesson-one');
  assert.equal(payload.parseTaskPayload('Legacy programme task').lessonId, null);
});
