import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(new URL('../src/components/dashboard/family/PointsHistory.tsx', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: id => id === "@/lib/community/point-display" ? require("../src/lib/community/point-display.ts") : require(id), Date, Intl });
const render = (entries) => renderToStaticMarkup(React.createElement(exports.PointsHistory, { entries }));

test('points audit shows net totals, quiz subtotal, signed adjustments and reasons', () => {
 const base = { awardedAt: new Date('2026-09-19T09:00:00Z') };
 const html = render([
  { ...base, id: 'a', points: 25, sourceType: 'ATTENDANCE_ON_TIME', reason: 'Joined class on time' },
  { ...base, id: 'b', points: 10, sourceType: 'QUIZ_LIVE_COMPLETE', reason: 'Seerah quiz: perfect bonus' },
  { ...base, id: 'c', points: -3, sourceType: 'TEACHER_MANUAL_REVERSAL', reason: 'Teacher correction' },
 ]);
 assert.match(html, /32 total points, including 10 quiz points/);
 assert.match(html, /Seerah quiz: perfect bonus/);
 assert.match(html, /\+25 pts/);
 assert.match(html, /-3 pts/);
 assert.match(html, /14:00/);
 assert.match(html, /Quiz points/);
});
test('empty audit states that no awards are recorded', () => {
 assert.match(render([]), /No point awards are recorded yet/);
});
test('history remains compact with access to older awards', () => {
 const entries = Array.from({ length: 11 }, (_, i) => ({ id: String(i), awardedAt: new Date(), points: 1, sourceType: 'QUIZ', reason: `Award ${i}` }));
 const html = render(entries);
 assert.match(html, /11 total points, including 11 quiz points/);
 assert.match(html, /Page 1 of 2/);
 assert.doesNotMatch(html, /Award 10</);
});
test('legacy late points show neutral attendance wording without changing the award', () => {
 const html = render([{ id: 'legacy', awardedAt: new Date('2026-09-19T09:00:00Z'), points: 5, sourceType: 'ATTENDANCE_LATE', reason: 'Joined class after the on-time window' }]);
 assert.match(html, /Attended live class/);
 assert.doesNotMatch(html, /late|after the on-time window/i);
 assert.match(html, /\+5 pts/);
});
