import assert from 'node:assert/strict';
import test from 'node:test';
import { attendanceDayKey, deduplicateAttendance, connectedMinutes } from '../src/lib/live-classes/attendance-policy.ts';

const row = (id, status, title = 'Mehran Urdu Seerah', date = '2026-09-19T09:00:00Z', studentId = 'learner') => ({
  id, studentId, scheduleId: id, lessonDate: new Date(date), status,
  durationMinutes: status === 'ABSENT' ? null : 30, schedule: { title },
});

test('either Saturday Seerah slot fulfils the day, irrespective of order', () => {
  for (const statuses of [['PRESENT', 'ABSENT'], ['ABSENT', 'PRESENT'], ['LATE', 'ABSENT']]) {
    const rows = [row('day', statuses[0]), row('evening', statuses[1], 'Mehran Urdu Seerah', '2026-09-19T14:00:00Z')];
    for (const input of [rows, [...rows].reverse()]) {
      const result = deduplicateAttendance(input);
      assert.equal(result.length, 1);
      assert.equal(result[0].status, 'PRESENT');
    }
  }
});
test('Life Skills alternatives count once, including two absences or two attendances', () => {
  for (const status of ['ABSENT', 'PRESENT']) {
    assert.equal(deduplicateAttendance([row('day', status, 'Life Skills'), row('night', status, 'Life-skills')]).length, 1);
  }
});
test('subjects, students, dates and ordinary classes remain separate', () => {
  const rows = [row('seerah', 'PRESENT'), row('skills', 'ABSENT', 'Life Skills'),
    row('next-week', 'ABSENT', 'Seerah', '2026-09-26T09:00:00Z'),
    row('other-learner', 'ABSENT', 'Seerah', undefined, 'other'),
    row('arabic-1', 'PRESENT', 'Arabic'), row('arabic-2', 'ABSENT', 'Arabic')];
  assert.equal(deduplicateAttendance(rows).length, 6);
});
test('historical duplicate schedule records count once', () => {
  const present = row('schedule', 'PRESENT', 'Arabic');
  const absent = { ...present, id: 'duplicate', status: 'ABSENT', durationMinutes: null };
  assert.deepEqual(deduplicateAttendance([absent, present]), [present]);
});
test('Pakistan day boundaries group timestamps across UTC midnight', () => {
  assert.equal(attendanceDayKey(new Date('2026-09-18T20:00:00Z')), '2026-09-19');
  assert.equal(deduplicateAttendance([row('a', 'ABSENT', 'Seerah', '2026-09-18T20:00:00Z'), row('b', 'PRESENT')]).length, 1);
  assert.equal(deduplicateAttendance([row('a', 'ABSENT', 'Seerah', '2026-09-18T18:00:00Z'), row('b', 'PRESENT')]).length, 2);
});
test('reconnect gaps are excluded and overlapping duplicate reports count once', () => {
  const interval = (start, end) => ({ joinedAt: new Date(`2026-09-19T${start}:00Z`), leftAt: end ? new Date(`2026-09-19T${end}:00Z`) : null });
  assert.equal(connectedMinutes([interval('09:00','09:20'), interval('09:30','09:50')]), 40);
  assert.equal(connectedMinutes([interval('09:00','09:20'), interval('09:00','09:20'), interval('09:10','09:30'), interval('09:40',null)]), 30);
  assert.equal(connectedMinutes([interval('09:10','09:00')]), 0);
});
test('Life Lessons & Leadership uses the Life Skills attendance rule', () => {
  assert.equal(deduplicateAttendance([row('a', 'ABSENT', 'Life Lessons & Leadership'), row('b', 'PRESENT', 'Life Skills')]).length, 1);
});
test('historical manual subject records use programme title when no schedule exists', () => {
  const manual = { ...row('manual', 'PRESENT'), scheduleId: null, schedule: null, enrollment: { program: { title: "The Prophet's Seerah" } } };
  assert.equal(deduplicateAttendance([manual, row('slot', 'ABSENT')]).length, 1);
});
test('historical late arrivals always display as present without changing raw records', () => {
  const late = row('late', 'LATE', 'Arabic');
  assert.equal(deduplicateAttendance([late])[0].status, 'PRESENT');
  assert.equal(late.status, 'LATE');
});
test('verified join overrides absence even before any minutes are recorded', () => {
  const joined = { ...row('joined', 'ABSENT', 'Arabic'), joinedAt: new Date('2026-09-19T09:59:00Z'), durationMinutes: 0 };
  assert.equal(deduplicateAttendance([joined])[0].status, 'PRESENT');
  assert.equal(deduplicateAttendance([row('missed', 'ABSENT', 'Arabic')])[0].status, 'ABSENT');
});
