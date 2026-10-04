import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPointsModule } from './backfill-attendance-points.mjs';
const { planAttendancePointsUpgrade: plan } = loadPointsModule('attendance-points-backfill');
const { attendancePointKey, parentAttendancePointDelta } = loadPointsModule('attendance-ledger');
const day = new Date('2026-09-05T09:00:00Z');
const schedule = { id: 'day', title: 'Seerah morning', programId: 'seerah', program: { title: 'Seerah' } };
const evening = { ...schedule, id: 'evening', title: 'Seerah evening' };
const key = attendancePointKey('child', schedule, day);
const record = (overrides = {}) => ({ id: 'record', scheduleId: 'day', lessonDate: day, status: 'PRESENT', joinedAt: null, durationMinutes: null, source: 'parent-confirmed', enrollmentId: 'enrollment', enrollment: { programId: 'seerah', program: { title: 'Seerah' } }, ...overrides });
const row = (points, overrides = {}) => ({ points, houseId: 'house', sourceType: 'ATTENDANCE_PARENT', sourceId: key + ':original', ...overrides });
const input = (overrides = {}) => ({ studentId: 'child', houseId: 'house', schedules: [schedule, evening], records: [record()], rows: [], reports: [], ...overrides });
test('all confirmation paths target 25, preserve old 25 and reverse the entire parent credit', () => {
 assert.equal(parentAttendancePointDelta('PRESENT', { parentBalance: 0, verifiedBalance: 0 }), 25);
 assert.equal(parentAttendancePointDelta('PRESENT', { parentBalance: 5, verifiedBalance: 0 }), 20);
 assert.equal(parentAttendancePointDelta('PRESENT', { parentBalance: 0, verifiedBalance: 5 }), 20);
 assert.equal(parentAttendancePointDelta('PRESENT', { parentBalance: 5, verifiedBalance: 25 }), -5);
 assert.equal(parentAttendancePointDelta('ABSENT', { parentBalance: 25, verifiedBalance: 0 }), -25);
 assert.equal(parentAttendancePointDelta('ABSENT', { parentBalance: 0, verifiedBalance: 25 }), 0);
});
test('historical five becomes 25 once and same-day alternatives never double credit', () => {
 const state = input({ rows: [row(5)], records: [record(), record({ id: 'second', scheduleId: 'evening' })] });
 const result = plan(state); assert.equal(result.credits.length, 1); assert.equal(result.credits[0].points, 20);
 assert.equal(result.credits[0].sourceType, 'ATTENDANCE_PARENT_POLICY_UPGRADE');
 assert.equal(result.credits[0].houseId, 'house');
 assert.equal(plan({ ...state, rows: [...state.rows, ...result.credits] }).credits.length, 0);
});
test('legacy early and late awards resolve to the same daily requirement', () => {
 assert.equal(plan(input({ rows: [row(25, { sourceType: 'ATTENDANCE_ON_TIME', sourceId: 'evening:2026-09-05' })] })).credits.length, 0);
 assert.equal(plan(input({ rows: [row(5, { sourceType: 'ATTENDANCE_LATE', sourceId: 'evening:2026-09-05' })] })).credits[0].points, 20);
});
test('recorded presence without a ledger award earns 25, but absent and reverted records do not', () => {
 assert.equal(plan(input()).credits[0].points, 25);
 assert.equal(plan(input({ records: [record({ status: 'ABSENT' })] })).credits.length, 0);
 assert.equal(plan(input({ records: [record({ status: 'ABSENT' })], rows: [row(5), row(-5, { sourceType: 'ATTENDANCE_PARENT_REVERSAL', sourceId: key + ':reversal' })] })).credits.length, 0);
});
test('estimated missed classes are repriced along with provisional present records and stay idempotent', () => {
 const state = input({ rows: [row(5), row(-5, { sourceType: 'ATTENDANCE_ADMIN_ESTIMATE', sourceId: 'report:original' })], reports: [{ id: 'report', missedCount: 1, fromDay: '2026-09-01', toDay: '2026-09-30' }] });
 const result = plan(state); assert.deepEqual(Array.from(result.credits, c => c.points), [20, -20]);
 assert.equal(plan({ ...state, rows: [...state.rows, ...result.credits] }).credits.length, 0);
});
test('verified evidence keeps its provenance and original house; orphan ambiguity is reported', () => {
 const result = plan(input({ records: [record({ source: 'zoom', status: 'LATE' })], rows: [row(5, { sourceType: 'ATTENDANCE_VERIFIED', houseId: 'original-house' })] }));
 assert.equal(result.credits[0].sourceType, 'ATTENDANCE_POLICY_UPGRADE');assert.equal(result.credits[0].houseId, 'original-house');
 const arabic = { ...schedule, programId: 'arabic', title: 'Arabic', program: { title: 'Arabic' } };
 const state = input({ schedules: [arabic], records: [record({ enrollment: { programId: 'arabic', program: { title: 'Arabic' } } }), record({ id: 'orphan', scheduleId: null, enrollment: { programId: 'arabic', program: { title: 'Arabic' } } })] });
 assert.equal(plan(state).credits.length, 1);assert.equal(plan(state).skipped.length, 1);
});
test('distinct ordinary classes retain independent credits, and historical overpayments are not silently deducted', () => {
 const a = { ...schedule, title: 'Arabic', program: { title: 'Arabic' } };
 const b = { ...a, id: 'second' };
 assert.equal(plan(input({ schedules: [a, b], records: [record(), record({ id: 'other', scheduleId: 'second' })] })).credits.length, 2);
 const result = plan(input({ rows: [row(50)] }));assert.equal(result.credits.length, 0);assert.equal(result.aboveTarget, 1);
});
test('a deleted-schedule record is credited once and a repeat run leaves it unchanged', () => {
 const state = input({ records: [record({ scheduleId: null, source: 'zoom', enrollment: { programId: 'arabic', program: { title: 'Arabic' } } })] });
 const result = plan(state);assert.equal(result.credits[0].points, 25);assert.equal(plan({ ...state, rows: result.credits }).credits.length, 0);
});

test('unlinked same-program records on one day cannot create multiple speculative awards', () => {
 const first = record({ scheduleId: null, source: 'zoom', enrollment: { programId: 'arabic', program: { title: 'Arabic' } } });
 const second = { ...first, id: 'rejoin', lessonDate: new Date('2026-09-05T09:05:00Z') };
 const result = plan(input({ records: [first, second] }));assert.equal(result.credits.length, 1);assert.equal(result.credits[0].points, 25);
});
