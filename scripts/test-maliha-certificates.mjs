import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (!(id in dependencies)) throw Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  } });
  return exports;
}
const permission = load('src/lib/teacher/recognition-permissions.ts');
const maliha = { id: 'maliha', role: 'COMMUNICATIONS', email: 'emancheman413@gmail.com', status: 'ACTIVE' };
const navigation = { redirect: path => { throw Error(path); }, notFound: () => { throw Error('not found'); } };

test('only the active, named Communications account gains certificate delegation', () => {
  assert.equal(permission.canAwardWeeklyCertificates(maliha), true);
  for (const actor of [{ ...maliha, email: 'other@example.test' }, { ...maliha, status: 'SUSPENDED' }, { ...maliha, status: undefined }, { ...maliha, role: 'PARENT' }]) assert.equal(permission.canAwardWeeklyCertificates(actor), false);
});
test('delegated signatory is Sister Saba; faculty signatories keep their names', () => {
  assert.equal(permission.weeklyCertificateSignatory({ ...maliha, firstName: 'Maliha' }), 'Sister Saba');
  assert.equal(permission.weeklyCertificateSignatory({ firstName: 'Mehran', lastName: 'Tahir', email: 'mehranraziq@gmail.com' }), 'Mehran Tahir');
});
for (const leaf of ['recognition', 'parent-recognition']) test(`Communications ${leaf} route checks delegation before rendering`, async () => {
  let actor = { ...maliha }, renders = 0;
  const page = load(`src/app/communications/${leaf}/page.tsx`, {
    [`@/app/teacher/${leaf}/page`]: { default: async () => { renders++; return 'certificate workspace'; } },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: actor }), getDashboardHome: () => '/communications' },
    '@/lib/teacher/recognition-permissions': permission, 'next/navigation': navigation,
  }).default;
  assert.equal(await page({}), 'certificate workspace');
  for (const user of [{ ...maliha, email: 'other@example.test' }, { ...maliha, status: 'SUSPENDED' }, { ...maliha, role: 'TEACHER' }]) { actor = user; await assert.rejects(page({}), /communications/); }
  assert.equal(renders, 1);
});
test('Communications tabs link to both certificate forms without teacher tools', () => {
  const { TeacherRewardWorkspaceTabs } = load('src/components/dashboard/teacher/TeacherRewardWorkspaceTabs.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'lucide-react': { Award: () => null, HeartHandshake: () => null, Sparkles: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(TeacherRewardWorkspaceTabs, { active: 'certificate', communications: true, canAwardCertificates: true }));
  assert.match(html, /href="\/communications\/recognition\?tab=certificate"/);
  assert.match(html, /href="\/communications\/parent-recognition"/);
  assert.doesNotMatch(html, /\/teacher\/|Award badges|Live House Points/);
});
test('publish/hide actions return Maliha to her own portal and reject a suspended session', async () => {
  let actor = { ...maliha }; const writes = [], refreshed = [];
  const actions = load('src/app/teacher/certificate-actions.ts', {
    'next/cache': { revalidatePath: path => refreshed.push(path) }, 'next/navigation': navigation,
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: actor }) },
    '@/lib/teacher/recognition-permissions': permission,
    '@/lib/community/certificate-publication': { setCertificatePublication: async input => writes.push(input), hideAllWeeklyCertificates: async id => writes.push(id) },
  });
  const form = new FormData(); form.set('awardId', 'certificate'); form.set('isPublic', 'on');
  await assert.rejects(actions.changeCertificatePublication(form), /communications\/recognition\?tab=certificate/);
  form.set('parent', 'true');
  await assert.rejects(actions.changeCertificatePublication(form), /communications\/parent-recognition/);
  form.set('confirmHide', 'on');
  await assert.rejects(actions.hideWeeklyCertificates(form), /communications\/recognition/);
  assert.equal(writes.length, 3); assert.ok(refreshed.includes('/communications'));
  actor.status = 'SUSPENDED';
  await assert.rejects(actions.changeCertificatePublication(form), /auth\/login/);
  await assert.rejects(actions.hideWeeklyCertificates(form), /auth\/login/);
  assert.equal(writes.length, 3);
});
function find(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type); if (found) return found; }
  return null;
}
test('private Mum certificate preview permits Maliha and displays Sister Saba in exported artwork', async () => {
  const actor = { ...maliha };
  const award = { id: 'mum-award', parent: { userId: 'mother', user: { firstName: 'Mother', lastName: 'Ali' } }, isPublic: false, revokedAt: null, awardedByUserId: 'maliha', awardedAt: new Date(), recipientName: 'Mother Ali', title: 'Mum of the Week', evidence: 'Supporting her children', certificateCode: 'code' };
  const Certificate = () => null;
  const page = load('src/app/parent-certificates/[code]/page.tsx', {
    '@/lib/teacher/recognition-permissions': permission,
    '@/components/dashboard/RecognitionCertificate': { RecognitionCertificate: Certificate },
    '@/components/dashboard/CertificateActions': { CertificateActions: () => null },
    '@/lib/community/recognition-week': { recognitionWeekLabel: value => value },
    'next/navigation': navigation,
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: actor }) },
    '@/lib/db': { db: { parentRecognitionAward: { findUnique: async () => award }, user: { findUnique: async () => ({ ...maliha, firstName: 'Maliha', lastName: '' }) } } },
  }).default;
  const render = () => page({ params: Promise.resolve({ code: 'code' }) });
  assert.equal(find(await render(), Certificate).props.teacher, 'Sister Saba');
  actor.status = 'SUSPENDED'; await assert.rejects(render(), /not found/);
  actor.status = 'ACTIVE'; actor.email = 'other@example.test'; await assert.rejects(render(), /not found/);
});

test('Maliha dashboard shows both certificate entry links; other Communications accounts do not', async () => {
  const actor = { ...maliha, firstName: 'Maliha' };
  const empty = () => null;
  const page = load('src/app/communications/page.tsx', {
    '@/lib/teacher/recognition-permissions': permission,
    '@/components/payroll/PayrollOverview': { PayrollOverview: empty },
    '@/lib/payroll/service': { publishedPayslips: async () => [] },
    '@/lib/payroll/presentation': { payslipInitiallyOpen: () => false },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': navigation,
    'lucide-react': { MessageCircle: empty, ClipboardList: empty, Download: empty, Mail: empty },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: actor }), getDashboardHome: () => '/communications' },
    '@/lib/db': { db: { user: { findUnique: async () => actor }, monthlyParentFeedback: { count: async () => 0, findMany: async () => [] } } },
    '@/lib/feedback/monthly-questions': { feedbackMonth: () => '2026-11' },
    '@/components/dashboard/family/FamilyLogoutButton': { FamilyLogoutButton: empty },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /href="\/communications\/recognition"/);
  assert.match(html, /href="\/communications\/parent-recognition"/);
  actor.email = 'other@example.test';
  assert.doesNotMatch(renderToStaticMarkup(await page()), /href="\/communications\/(?:recognition|parent-recognition)"/);
});
