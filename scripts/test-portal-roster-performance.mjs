import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadDashboardScheduleRosters } from '../src/lib/live-classes/dashboard-rosters.ts';
const source = fs.readFileSync('src/lib/live-classes/service.ts', 'utf8');
const ast = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
const names = ['createReadOnlyRosterResolver', 'getScheduleRosterStudentIds'];
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n => n.getText(ast)).join('\n');
function harness() {
 const calls = { eligible: 0, teacher: 0, schedule: 0, writes: 0 };
 const exports = {};
 vm.runInNewContext(ts.transpileModule(functions, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports, console,
  db: {
   classScheduleRoster: { findMany: async ({where}) => where.scheduleId.startsWith('explicit') ? [{studentId:'old'}] : [] },
   classSchedule: { findUnique: async () => { calls.schedule++; return { teacherId:'teacher', programId:'program' }; } },
   studentProfile: { findMany: async () => [{ id:'old', displayName:'Child', user:{firstName:'Child'}, registrationStudents:[] }] },
  },
  getProgramEligibleRosterStudents: async (id, repair) => {
   assert.equal(repair, false, 'dashboard must not repair registrations'); calls.eligible++;
   return [{id:'current',displayName:'Child',user:{firstName:'Child'},registrationStudents:[]}];
  },
  getTeacherProgramRosterStudentIds: async (teacher, program, read) => { calls.teacher++; await read.eligible(program); return ['current']; },
  canonicalRosterIdentity: name => name,
  syncScheduleRoster: async () => { calls.writes++; throw Error('read attempted a write'); },
  isRosterTableUnavailable: () => false,
 });
 return { resolve:exports.createReadOnlyRosterResolver(), calls };
}
test('read-only resolution preserves stale profile replacement without writes and caches per program/teacher/schedule', async () => {
 const {resolve,calls}=harness();
 const results=await Promise.all(['explicit1','explicit2','default1','default2','explicit1'].map(resolve));
 assert.ok(results.every(ids=>ids.length===1 && ids[0]==='current'));
 assert.deepEqual(calls,{eligible:1,teacher:1,schedule:4,writes:0});
});
test('portal roster fan-out is bounded for large timetables', async () => {
 let active=0,peak=0;
 const students=[{enrollments:[{program:{schedules:Array.from({length:50},(_,i)=>({id:String(i)}))}}]}];
 const result=await loadDashboardScheduleRosters(students, async () => {
  peak=Math.max(peak,++active); await new Promise(resolve=>setTimeout(resolve,1)); active--;return ['child'];
 });
 assert.equal(result.size,50);assert.ok(peak<=2);
});

test('missing recovery audit table leaves an isolated, usable fallback', async () => {
 const page=fs.readFileSync('src/app/parent/attendance/page.tsx','utf8');
 const parsed=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const section=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='RecoverySection');
 const output=ts.transpileModule('export '+section.getText(parsed),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};let logged=false;
 vm.runInNewContext(output,{
  exports,require:()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}),
  console:{error:()=>{logged=true;}},SectionCard:'section',ParentAttendanceRecovery:'recovery',
  getParentAttendanceRecovery:async()=>{throw Object.assign(Error('missing table'),{code:'P2021'});},
 });
 const result=await exports.RecoverySection({parentUserId:'parent',studentId:'child'});
 assert.equal(result.type,'section');assert.equal(result.props.title,'Corrections temporarily unavailable');assert.equal(logged,true);
});
