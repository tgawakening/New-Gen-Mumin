import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDashboardScheduleRosters, isStudentInDashboardRoster } from '../src/lib/live-classes/dashboard-rosters.ts';
import { getParentNavItems, getStudentNavItems } from '../src/lib/dashboard/family-nav.ts';

const learner = (...scheduleIds) => ({ enrollments: [{ program: { schedules: scheduleIds.map(id => ({ id })) } }] });

test('timetable uses canonical learner IDs returned by class access', async () => {
  const rosters = await loadDashboardScheduleRosters([learner('seerah')], async () => ['current-mustafa']);
  assert.equal(isStudentInDashboardRoster('seerah', 'current-mustafa', rosters), true);
  assert.equal(isStudentInDashboardRoster('seerah', 'old-mustafa', rosters), false);
});
test('combined programme teacher rosters are resolved for each schedule', async () => {
  const rosters = await loadDashboardScheduleRosters([learner('arabic', 'tajweed')], async () => ['learner']);
  assert.equal(isStudentInDashboardRoster('arabic', 'learner', rosters), true);
  assert.equal(isStudentInDashboardRoster('tajweed', 'learner', rosters), true);
});
test('class-specific exclusions do not expose another learner\'s class', async () => {
  const rosters = await loadDashboardScheduleRosters([learner('restricted')], async () => ['assigned-child']);
  assert.equal(isStudentInDashboardRoster('restricted', 'other-child', rosters), false);
  assert.equal(isStudentInDashboardRoster('missing', 'assigned-child', rosters), false);
});
test('shared schedules are resolved once across siblings and enrolments', async () => {
  const calls = [];
  await loadDashboardScheduleRosters([learner('a', 'a'), learner('a', 'b')], async id => { calls.push(id); return []; });
  assert.deepEqual(calls.sort(), ['a', 'b']);
});
test('empty families do not query rosters', async () => {
  const rosters = await loadDashboardScheduleRosters([], async () => { throw new Error('Unexpected lookup'); });
  assert.equal(rosters.size, 0);
});
test('Join Classes navigation retains selected child and student destination', () => {
  assert.equal(getParentNavItems('mustafa').find(item => item.label === 'Join Classes').href, '/parent/schedule?child=mustafa');
  assert.equal(getStudentNavItems().find(item => item.label === 'Join Classes').href, '/student/schedule');
});
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const familySource = fs.readFileSync(new URL('../src/lib/dashboard/family.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('family.ts', familySource, ts.ScriptTarget.Latest, true);
const mapper = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'mapScheduleEntries');
const exports = {};
vm.runInNewContext(ts.transpileModule(mapper.getText(ast) + '\nexports.map = mapScheduleEntries;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports, isStudentInDashboardRoster,
  isLiveClassVisibleToStudents: title => title !== 'Hidden',
  getLiveClassAudienceGroup: () => 'PK_UK',
  countryMatchesLiveClassAudience: countries => countries.includes('PK'),
  mapScheduleSummary: schedule => ({ ...schedule, nextStartsAt: new Date('2026-09-26T09:00:00Z') }),
});
const schedules = (schedule) => [{ program: { id: 'program', title: 'Seerah', schedules: [schedule] } }];
test('actual dashboard mapper shows a learner whose raw roster ID was superseded', () => {
  const result = exports.map(schedules({ id: 'class', title: 'Seerah', scheduleRosters: [{ studentId: 'old' }] }), { id: 'current' }, new Map([['class', ['current']]]));
  assert.equal(result.length, 1);
});
test('actual dashboard mapper respects explicit exclusions and hidden sessions', () => {
  const source = schedules({ id: 'class', title: 'Seerah', scheduleRosters: [{ studentId: 'other' }] });
  assert.equal(exports.map(source, { id: 'current', countryCode: 'PK' }, new Map([['class', ['other']]])).length, 0);
  assert.equal(exports.map(schedules({ id: 'class', title: 'Hidden' }), { id: 'current' }, new Map([['class', ['current']]])).length, 0);
});
test('unconfigured classes retain their existing country audience', () => {
  const source = schedules({ id: 'class', title: 'Seerah', scheduleRosters: [] });
  assert.equal(exports.map(source, { id: 'current', countryCode: 'PK' }, new Map([['class', []]])).length, 1);
  assert.equal(exports.map(source, { id: 'current', countryCode: 'US' }, new Map([['class', []]])).length, 0);
});
