import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as policy from '../src/lib/live-classes/attendance-policy.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const Prisma = require('@prisma/client').Prisma;
class TestDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-22T12:00:00Z'])); } }
function moduleAt(path, deps) {
 const exports = {};
 const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 vm.runInNewContext(compiled, { exports, require: id => id in deps ? deps[id] : require(id), Date: TestDate, console });
 return exports;
}
const ledgerModule = moduleAt('../src/lib/live-classes/attendance-ledger.ts', { 'server-only': {}, '@/lib/live-classes/attendance-policy': policy });
function matches(row, where = {}) {
 return Object.entries(where).every(([key,value]) => {
  if (key === 'OR') return value.some(clause => matches(row,clause));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
   if ('in' in value) return value.in.includes(row[key]);
   if ('startsWith' in value) return row[key]?.startsWith(value.startsWith);
   return (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte) && (!value.lt || row[key] < value.lt);
  }
  return row[key] === value;
 });
}
function harness() {
 const day = new Date('2026-09-05T09:00:00Z');
 const schedules = ['day','evening'].map(id => ({ id, title: 'Mehran Urdu Seerah', teacher: { user: { firstName: id === 'day' ? 'Mehran' : 'Sabah', lastName: null } }, program: { title: 'Seerah' }, sessionOccurrences: [{ startedAt: day, endedAt: new Date('2026-09-05T10:00:00Z') }] }));
 const records = schedules.map((schedule,index) => ({ id: 'record'+index, studentId: 'child', enrollmentId: 'enrollment', scheduleId: schedule.id, lessonDate: day, attendanceDay: '2026-09-05', status: 'ABSENT', source: 'zoom', joinedAt: null, leftAt: null, durationMinutes: null }));
 const ledger = [], audit = [], intervals = [];
 let failLedger = false;
 const db = {
  $queryRaw: async () => [{ id: 'child' }],
  parentStudent: { findFirst: async ({where}) => where.studentId === 'child' && where.parent.userId === 'parent' ? {id:'relation'} : null },
  user: { findMany: async () => [{ id:'parent', firstName:'Parent', lastName:'Name' }] },
  enrollment: { findMany: async ({include}) => [{ id:'enrollment', startedAt: null, program: { title:'Seerah', schedules: schedules.map(s => ({...s,
   sessionOccurrences: s.sessionOccurrences.filter(o => matches(o, include.program.include.schedules.include.sessionOccurrences.where)),
   attendances: records.filter(r => r.scheduleId === s.id && matches(r, include.program.include.schedules.include.attendances.where)),
  })) } }] },
  classSchedule: { findMany: async () => schedules },
  zoomAttendanceInterval: { findMany: async ({where}) => intervals.filter(r=>matches(r,where)), findFirst: async ({where}) => intervals.find(r=>matches(r,where)) ?? null },
  attendanceRecord: {
   findMany: async ({where}) => records.filter(r=>matches(r,where)),
   updateMany: async ({where,data}) => { records.filter(r=>matches(r,where)).forEach(r=>Object.assign(r,data)); },
   create: async ({data}) => { records.push({id:'record'+records.length,...data}); },
  },
  attendanceConfirmationAudit: {
   findMany: async () => audit,
   create: async ({data}) => { const row={id:'audit'+audit.length,createdAt:new Date(),...data};audit.push(row);return row; },
  },
  housePointLedger: {
   findMany: async ({where}) => ledger.filter(r=>matches(r,where)),
   create: async ({data}) => { if(failLedger)throw Error('Ledger unavailable');ledger.push(data); },
  },
 };
 let tail=Promise.resolve();
 db.$transaction = fn => {
  const run=tail.then(async()=>{
   const before=[records,ledger,audit].map(list=>structuredClone(list));
   try{return await fn(db);}catch(error){[records,ledger,audit].forEach((list,index)=>list.splice(0,list.length,...before[index]));throw error;}
  });
  tail=run.catch(()=>{});return run;
 };
 const service=moduleAt('../src/lib/live-classes/parent-attendance.ts', {
  'server-only': {}, '@prisma/client': {Prisma}, '@/lib/db': {db},
  '@/lib/community/house-points': {ensureStudentHouseMembership:async()=>({houseId:'house'})},
  '@/lib/live-classes/attendance-policy':policy, '@/lib/live-classes/attendance-ledger':ledgerModule,
  '@/lib/live-classes/service': {cleanLiveClassTitle:s=>s,isLiveClassVisibleToStudents:()=>true,isParentalLiveClass:()=>false,createReadOnlyRosterResolver:()=>async()=>['child']},
 });
 const key=ledgerModule.attendancePointKey('child',schedules[0],day);
 return {service,db,records,ledger,audit,intervals,schedules,key,setFailLedger:value=>{failLedger=value;}};
}
test('date list groups alternate sessions and labels missing Zoom matches unconfirmed',async()=>{
 const h=harness();const result=await h.service.getParentAttendanceRecovery('parent','child');
 assert.deepEqual(Array.from(result.rows[0].teacherNames),['Mehran','Sabah']);assert.equal(result.rows.length,1);assert.equal(result.rows[0].alternatives,2);assert.equal(result.rows[0].status,'NEEDS_CONFIRMATION');
});
test('parent confirmation updates both slots, awards five once, and preserves unknown minutes',async()=>{
 const h=harness();const changes=[{key:h.key,status:'PRESENT'}];
 await h.service.confirmParentAttendance('parent','child',changes);
 await h.service.confirmParentAttendance('parent','child',changes);
 assert.ok(h.records.every(r=>r.status==='PRESENT'&&r.source==='parent-confirmed'&&r.durationMinutes===null&&r.joinedAt===null));
 assert.equal(h.ledger.length,1);assert.equal(h.ledger[0].points,5);assert.equal(h.audit.length,1);assert.equal(h.audit[0].parentUserId,'parent');
});
test('correction reverses only confirmation points and permits a later correction back',async()=>{
 const h=harness();
 for(const status of ['PRESENT','ABSENT','PRESENT'])await h.service.confirmParentAttendance('parent','child',[{key:h.key,status}]);
 assert.deepEqual(h.ledger.map(r=>r.points),[5,-5,5]);assert.equal(h.audit.length,3);
});
test('simultaneous parent submissions award once',async()=>{
 const h=harness();await Promise.all([1,2].map(()=>h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'PRESENT'}])));
 assert.equal(h.ledger.length,1);assert.equal(h.audit.length,1);
});
test('legacy attendance rewards prevent an additional parent award',async()=>{
 const h=harness();h.ledger.push({studentId:'child',sourceType:'ATTENDANCE_ON_TIME',sourceId:'evening:2026-09-05',points:25});
 await h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'PRESENT'}]);assert.equal(h.ledger.length,1);assert.equal(h.audit[0].pointsDelta,0);
});
test('another parent cannot read or confirm a child',async()=>{
 const h=harness();await assert.rejects(h.service.getParentAttendanceRecovery('stranger','child'),/own child/);
 await assert.rejects(h.service.confirmParentAttendance('stranger','child',[{key:h.key,status:'PRESENT'}]),/own child/);assert.equal(h.ledger.length,0);
});
test('verified Zoom attendance is protected even when the stored record says absent',async()=>{
 const h=harness();h.intervals.push({id:'zoom',studentId:'child',scheduleId:'day',joinedAt:new Date('2026-09-05T09:30:00Z')});
 await assert.rejects(h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'ABSENT'}]),/Verified attendance/);
});
test('a Zoom join arriving during submission is checked again inside the transaction',async()=>{
 const h=harness();const original=h.db.$transaction;
 h.db.$transaction=fn=>{h.intervals.push({id:'zoom',studentId:'child',scheduleId:'day',joinedAt:new Date('2026-09-05T09:30:00Z')});return original(fn);};
 await assert.rejects(h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'ABSENT'}]),/now verified/);assert.equal(h.audit.length,0);
});
test('future, pre-September, and made-up dates cannot be submitted',async()=>{
 const h=harness();h.records.splice(0);h.schedules.forEach(s=>s.sessionOccurrences=[{startedAt:new Date('2026-08-20T09:00:00Z'),endedAt:new Date('2026-08-20T10:00:00Z')},{startedAt:new Date('2026-12-01T09:00:00Z'),endedAt:new Date('2026-12-01T10:00:00Z')}]);
 assert.equal((await h.service.getParentAttendanceRecovery('parent','child')).rows.length,0);
 await assert.rejects(h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'PRESENT'}]),/not eligible/);
});
test('a points failure rolls back attendance and its audit',async()=>{
 const h=harness();h.setFailLedger(true);
 await assert.rejects(h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'PRESENT'}]),/Ledger unavailable/);
 assert.ok(h.records.every(r=>r.status==='ABSENT'));assert.equal(h.audit.length,0);
});
test('a later Zoom report sees the parent reward and must not award again',async()=>{
 const h=harness();await h.service.confirmParentAttendance('parent','child',[{key:h.key,status:'PRESENT'}]);
 const state=await ledgerModule.attendancePointState(h.db,'child',h.schedules[1],new Date('2026-09-05T14:00:00Z'));
 assert.equal(state.parentBalance+state.verifiedBalance,5);
});
