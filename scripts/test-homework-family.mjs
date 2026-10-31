import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { File } from 'node:buffer';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, Intl, URL, URLSearchParams, File, console, require: name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name) });
  return exports;
}
const wrapper = ({ children }) => React.createElement('section', null, children);
const link = ({ children, href }) => React.createElement('a', { href }, children);
const task = (id, programTitle) => ({ id, title: `${id} homework`, programTitle, instructions: 'Read and answer clearly', teacherName: 'Teacher', dueDate: new Date('2026-12-01'), dueDateLabel: '1 December', weekLabel: 'Week 1', attachments: [{ id: 'file', name: 'Worksheet.pdf', url: 'https://example.com/work.pdf' }], resourceLinks: [], feedback: null, score: null, submissionTiming: 'Not submitted', familyNote: null });
function pageFixture(role = 'STUDENT', { locked = false } = {}) {
  const child = { id: 'child', name: 'Learner', accessLocked: locked, assignments: [task('older', 'Arabic'), task('newest', 'Seerah')] };
  const reads = [];
  const deps = {
    'next/link': { default: link }, 'next/navigation': { redirect: url => { throw Error(url); } },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'actor', role } }), getDashboardHome: () => '/wrong-role' },
    '@/lib/dashboard/family': { getStudentDashboardData: async () => ({ child }), getParentDashboardData: async () => ({ children: [child], pendingReason: null }) },
    '@/lib/dashboard/family-nav': { getStudentNavItems: () => [], getParentNavItems: () => [] },
    '@/components/dashboard/family/FamilyDashboardFrame': { FamilyDashboardFrame: wrapper, SectionCard: wrapper, ChildSelector: () => null },
    '@/components/dashboard/family/HomeworkSubmissionFields': { HomeworkSubmissionFields: () => React.createElement('textarea', { name: 'submissionText', defaultValue: 'Answer' }) },
    '@/components/dashboard/HomeworkStatus': { HomeworkStatus: ({ status }) => React.createElement('span', null, status) },
    '@/components/dashboard/FormSubmitButton': { FormSubmitButton: ({ children }) => React.createElement('button', null, children) },
    '@/components/dashboard/ActionToast': { ActionToast: () => null },
    '@/lib/homework/student-action': { submitStudentHomework: async () => {} },
    '@/lib/homework/parent-review': { markHomeworkReviewed: async () => {} },
    '@/lib/homework/timing': { homeworkTiming: () => 'Not submitted' },
    '@/lib/db': { db: { assignment: { findMany: async () => { reads.push('assignments'); return [{ id: 'newest' }, { id: 'older' }]; } }, assignmentSubmission: { findMany: async () => [] }, notification: { findMany: async () => [{ id: 'alert', href: '/parent/homework?child=child&task=newest' }] } } },
  };
  const file = role === 'PARENT' ? 'src/app/parent/homework/page.tsx' : 'src/app/student/homework/page.tsx';
  const Page = load(file, deps).default;
  return { child, reads, render: async params => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params || {}) })) };
}
test('student homework has a dedicated submission form, newest first and programme filters', async () => {
  const f = pageFixture(); const html = await f.render();
  assert.ok(html.indexOf('newest homework') < html.indexOf('older homework'));
  assert.match(html, /Homework programmes/); assert.match(html, /Submit homework/); assert.match(html, /Worksheet.pdf/); assert.match(html, /name="assignmentId"/);
  const linked = await f.render({ task: 'newest' }); assert.match(linked, /id="homework-newest" open/); assert.doesNotMatch(linked, /older homework/);
});
test('parents open the exact homework with review controls and no student submission form', async () => {
  const html = await pageFixture('PARENT').render({ task: 'newest' });
  assert.match(html, /id="homework-newest" open/); assert.match(html, /Mark reviewed/); assert.match(html, /notificationIds/); assert.match(html, /Worksheet.pdf/); assert.doesNotMatch(html, /name="submissionText"/);
});
test('locked student portals do not expose assignment instructions, attachments or submission forms', async () => {
  const f = pageFixture('STUDENT', { locked: true }); const html = await f.render(); assert.doesNotMatch(html, /Worksheet.pdf|name="assignmentId"|Read and answer clearly/); assert.equal(f.reads.length, 0);
});
test('homework review updates only the signed-in parent own homework alerts', async () => {
  const updates = [];
  const service = load('src/lib/homework/parent-review.ts', { 'next/cache': { revalidatePath: () => {} }, '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'parent', role: 'PARENT' } }) }, '@/lib/db': { db: { notification: { updateMany: async query => updates.push(query) } } } });
  const form = new FormData(); form.set('notificationIds', '["alert"]'); await service.markHomeworkReviewed(form);
  assert.equal(updates[0].where.userId, 'parent'); assert.equal(updates[0].where.href.startsWith, '/parent/homework?'); assert.equal(updates[0].where.id.in[0], 'alert');
});
test('red homework navigation ignores deleted, future and hidden module tasks and stays persistent', async () => {
  const payload = load('src/lib/genm/published-content.ts', {}), timing = load('src/lib/homework/timing.ts', {});
  const rows = ['visible', 'future', 'hidden', 'deleted'].map(id => ({ id, title: 'Homework is live', body: 'Read', href: `/parent/homework?child=child&task=${id}` }));
  const queries = [];
  const service = load('src/lib/notifications/navigation.ts', { '@/lib/db': { db: { notification: { findMany: async query => { queries.push(query); return rows; } }, assignment: { findMany: async () => ['visible', 'future', 'hidden'].map(id => ({ id, programId: 'seerah', instructions: payload.buildTaskPayload({ title: 'Read', instructions: 'Read', launchAt: id === 'future' ? '2099-01-01T00:00:00Z' : null, termId: id }) })) } } }, '@/lib/genm/published-content': payload, '@/lib/homework/timing': timing, '@/lib/curriculum/handover': { loadModuleSharing: async () => ({}), moduleIsShared: (_sharing, _program, module) => module !== 'hidden' } });
  const [item] = await service.getNavigationActivity('parent', [{ label: 'Homework & Tasks', href: '/parent/homework?child=child' }]);
  assert.equal(item.activity.count, 1); assert.equal(item.activity.ids[0], 'visible'); assert.equal(item.activity.persistent, true); assert.equal(queries[1].where.href.startsWith, '/parent/homework?child=child&');
});
function actionFixture({ locked = false, allowed = true } = {}) {
  const saved = [], points = [], afters = [];
  const service = load('src/lib/homework/student-action.ts', { 'next/server': { after: fn => afters.push(fn) }, 'next/cache': { revalidatePath: () => {} }, 'next/navigation': { redirect: url => { throw Error(url); } }, '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'student', role: 'STUDENT' } }) }, '@/lib/dashboard/family': { getStudentDashboardData: async () => ({ child: { accessLocked: locked, assignments: allowed ? [{ id: 'task' }] : [] } }) }, '@/lib/db': { db: { assignment: { findUnique: async () => ({ id: 'task', title: 'Read', programId: 'program', program: { title: 'Seerah' } }) }, studentProfile: { findUnique: async () => ({ id: 'child', user: { firstName: 'Learner' } }) }, enrollment: { findFirst: async () => ({ id: 'enrollment' }) } } }, '@/lib/google-drive/materials': { uploadStudentSubmissionFile: async () => { throw Error('Unexpected upload'); } }, '@/lib/homework/submission': { saveHomeworkSubmission: async input => { saved.push(input); return { id: 'submission' }; } }, '@/lib/community/point-awards': { HOUSE_POINT_RULES: { HOMEWORK_SUBMITTED: { points: 10, label: 'Homework submitted' } }, awardHousePointsOnce: async input => points.push(input) }, '@/lib/homework/notifications': { deliverHomeworkNotifications: async () => {} } });
  const form = new FormData(); form.set('assignmentId', 'task'); form.set('submissionText', 'My completed work');
  return { saved, points, afters, submit: () => service.submitStudentHomework(form) };
}
test('student submission saves their own answer, credits once and redirects to the exact homework', async () => {
  const f = actionFixture(); await assert.rejects(f.submit(), /\/student\/homework\?task=task&submitted=1/); assert.equal(f.saved[0].studentId, 'child'); assert.equal(f.saved[0].submissionText, 'My completed work'); assert.equal(f.points[0].points, 10); assert.equal(f.points[0].sourceId, 'task'); assert.equal(f.afters.length, 1);
});
test('forged hidden assignments and locked accounts cannot submit or award points', async () => {
  for (const options of [{ locked: true }, { allowed: false }]) { const f = actionFixture(options); await assert.rejects(f.submit()); assert.equal(f.saved.length, 0); assert.equal(f.points.length, 0); }
});
