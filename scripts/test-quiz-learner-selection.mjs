import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';

function fixture(role = 'PARENT', published = true) {
  const queries = [];
  const dependencies = {
    'react/jsx-runtime': jsx,
    'next/link': { default: ({ children, href }) => React.createElement('a', { href }, children) },
    'next/navigation': { redirect: path => { throw Error(path); }, notFound: () => { throw Error('404'); } },
    '@/lib/auth/session': { getCurrentSession: async () => ({ user: { id: 'parent', role } }), getDashboardHome: () => '/wrong-role' },
    '@/components/quizzes/LiveQuizRoom': { LiveQuizRoom: ({ child }) => React.createElement('div', { 'data-playing-for': child }, 'Quiz room') },
    '@/lib/db': { db: { quizLiveSession: { findUnique: async () => ({ quizId: 'quiz' }) }, quiz: { findUnique: async () => ({ isPublished: published }) }, quizLiveSeat: { findMany: async query => { queries.push(query); return [{ studentId: 'mustafa', student: { displayName: 'Mustafa', user: { firstName: 'Mustafa' } } }, { studentId: 'sibling', student: { displayName: 'Sibling', user: { firstName: 'Sibling' } } }]; } } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/parent/quizzes/live/[sessionId]/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: key => dependencies[key], encodeURIComponent });
  return { queries, render: async child => renderToStaticMarkup(await exports.default({ params: Promise.resolve({ sessionId: 'quiz-session' }), searchParams: Promise.resolve(child ? { child } : {}) })) };
}
test('bare parent quiz links require an explicit learner choice and scope the choices to that parent', async () => {
  const f = fixture(); const html = await f.render();
  assert.match(html, /Who is taking this quiz/); assert.match(html, /child=mustafa/); assert.match(html, /child=sibling/); assert.doesNotMatch(html, /Quiz room/);
  assert.equal(f.queries[0].where.student.parents.some.parent.userId, 'parent'); assert.equal(f.queries[0].where.sessionId, 'quiz-session'); assert.equal(f.queries[0].where.student.user.status, 'ACTIVE');
});
test('links with a selected child preserve that child when opening the quiz', async () => {
  const f = fixture(); const html = await f.render('mustafa'); assert.match(html, /data-playing-for="mustafa"/); assert.equal(f.queries.length, 0);
});
test('other account roles cannot load the parent learner selection or roster', async () => {
  const f = fixture('STUDENT'); await assert.rejects(f.render(), /wrong-role/); assert.equal(f.queries.length, 0);
});

test("unpublished quizzes do not expose a learner selector", async () => { const f=fixture("PARENT",false); await assert.rejects(f.render(), /404/); assert.equal(f.queries.length,0); });
