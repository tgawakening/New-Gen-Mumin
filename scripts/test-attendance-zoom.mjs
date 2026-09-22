import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { connectedMinutes, attendanceDayKey } from '../src/lib/live-classes/attendance-policy.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function harness(participants) {
  const rows = [];
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some((entry) => matches(row, entry));
      if (value instanceof Date) return row[key]?.getTime() === value.getTime();
      if (value && typeof value === 'object') return (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte);
      return (row[key] ?? null) === value;
    });
  }
  const db = { zoomAttendanceInterval: {
    findFirst: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    create: async ({ data }) => { const row = { id: String(rows.length), leftAt: null, durationSeconds: 0, ...data }; rows.push(row); return row; },
    update: async ({ where, data }) => { const row = rows.find((entry) => entry.id === where.id); Object.assign(row, data); return row; },
  } };
  const deps = {
    'server-only': {}, '@prisma/client': { Prisma: {} }, '@/lib/db': { db },
    '@/lib/community/point-awards': {}, '@/lib/env': {},
    '@/lib/live-classes/attendance-policy': { connectedMinutes, attendanceDayKey },
    '@/lib/zoom/client': { getZoomPastMeetingParticipants: async () => participants },
    '@/lib/live-classes/service': { resolveScheduleStudentIds: async () => [] },
  };
  const exports = {};
  const source = fs.readFileSync(new URL('../src/lib/live-classes/attendance.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (id) => id in deps ? deps[id] : require(id), Date, Buffer, console });
  return { rows, api: exports };
}

test('replaying a Zoom report updates the original reconnect intervals', async () => {
  const participants = [
    { user_id: 'zoom-learner', name: 'Learner', join_time: '2026-09-19T09:00:00Z', leave_time: '2026-09-19T09:20:00Z', duration: 1200 },
    { user_id: 'zoom-learner', name: 'Learner', join_time: '2026-09-19T09:30:00Z', leave_time: '2026-09-19T09:50:00Z', duration: 1200 },
  ];
  const { rows, api } = harness(participants);
  await api.reconcileZoomParticipantReport('schedule', 'meeting');
  await api.reconcileZoomParticipantReport('schedule', 'meeting');
  assert.equal(rows.length, 2);
  assert.equal(connectedMinutes(rows), 40);
  assert.equal(rows[0].leftAt.toISOString(), participants[0].leave_time.replace('Z', '.000Z'));
});

test('simultaneous joins without Zoom IDs preserve different participants', async () => {
  const { rows, api } = harness([]);
  const event = { meetingId: 'meeting', occurredAt: new Date('2026-09-19T09:00:00Z') };
  await api.recordZoomParticipantJoined('schedule', { ...event, name: 'First learner' });
  await api.recordZoomParticipantJoined('schedule', { ...event, name: 'Second learner' });
  assert.equal(rows.length, 2);
});
