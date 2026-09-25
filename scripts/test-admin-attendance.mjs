import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { harness } from './test-parent-attendance.mjs';
const require=createRequire(import.meta.url);
const policy=await import('../src/lib/live-classes/attendance-policy.ts');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id in deps?deps[id]:require(id),Date,console});return exports;}
const ledger=load('src/lib/live-classes/attendance-ledger.ts',{'server-only':{},'@/lib/live-classes/attendance-policy':policy});
function setup(){
 const h=harness();let role='ADMIN';const reports=[];
 h.db.user.findUnique=async()=>({role});
 for(let i=0;i<2;i++){
  h.schedules[i].teacherId='teacher';
  const date=new Date(`2026-09-${i===0?'05':'12'}T09:00:00Z`);
  h.schedules[i].sessionOccurrences=[{startedAt:date,endedAt:new Date(date.getTime()+3600000)}];
  h.records[i].lessonDate=date;
 }
 h.db.attendanceRecord.createMany=async({data})=>{for(const row of data)await h.db.attendanceRecord.create({data:row});};
 h.db.housePointLedger.createMany=async({data})=>{for(const row of data)await h.db.housePointLedger.create({data:row});};
 h.db.adminAttendanceRecovery={findMany:async({where})=>reports.filter(r=>r.studentId===where.studentId&&r.fromDay<=where.fromDay.lte&&r.toDay>=where.toDay.gte),upsert:async({where,create,update})=>{const r=reports.find(r=>r.studentId===where.studentId_fromDay_toDay.studentId&&r.fromDay===where.studentId_fromDay_toDay.fromDay&&r.toDay===where.studentId_fromDay_toDay.toDay);if(r){Object.assign(r,update);return r;}reports.push(create);return create;}};
 const service=load('src/lib/live-classes/admin-attendance.ts',{'server-only':{},'@/lib/db':{db:h.db},'@/lib/live-classes/parent-attendance':h.service,'@/lib/live-classes/attendance-policy':policy,'@/lib/live-classes/attendance-ledger':ledger,'@/lib/community/house-points':{ensureStudentHouseMembership:async()=>({houseId:'house'})}});
 const input={studentId:'child',from:'2026-09-01',to:'2026-09-22',parentName:'Parent',note:'Attended all, except count if specified',mode:'all',missedCount:0,missedKeys:[],teacherId:'',fingerprint:''};
 return {...h,service,reports,input,setRole:r=>{role=r;}};
}
async function ready(h){const p=await h.service.previewAdminAttendance('admin','child',h.input.from,h.input.to);h.input.fingerprint=p.fingerprint;return p;}
test('admin recovery saves all eligible classes, five points each, with repeat-save protection',async()=>{const h=setup();await ready(h);let r=await h.service.saveAdminAttendance('admin',h.input);assert.equal(r.attended,2);assert.equal(r.pointsDelta,10);r=await h.service.saveAdminAttendance('admin',h.input);assert.equal(r.pointsDelta,0);assert.equal(h.ledger.reduce((s,r)=>s+r.points,0),10);assert.equal(h.reports[0].revisions.length,2);});
test('unknown missed count adjusts total rewards without inventing absent lesson dates',async()=>{const h=setup();await ready(h);h.input.mode='count';h.input.missedCount=1;let r=await h.service.saveAdminAttendance('admin',h.input);assert.equal(r.attended,1);assert.equal(r.pointsDelta,5);assert.ok(h.records.every(r=>r.status==='PRESENT'&&r.source==='admin-recovery-estimate'));r=await h.service.saveAdminAttendance('admin',h.input);assert.equal(r.pointsDelta,0);h.input.mode='all';r=await h.service.saveAdminAttendance('admin',h.input);assert.equal(r.pointsDelta,5);assert.equal(h.ledger.reduce((s,r)=>s+r.points,0),10);});
test('exact missed dates become absent; verified classes and excessive counts are protected',async()=>{const h=setup();const p=await ready(h);h.input.mode='dates';h.input.missedKeys=[p.sessions[0].key];const result=await h.service.saveAdminAttendance('admin',h.input);assert.equal(result.attended,1);assert.equal(h.records.filter(r=>r.status==='ABSENT').length,1);const v=setup();const vp=await ready(v);v.records[0].status='PRESENT';v.input.mode='count';v.input.missedCount=2;await assert.rejects(v.service.saveAdminAttendance('admin',v.input),/Missed count exceeds/);v.input.mode='dates';v.input.missedKeys=[vp.sessions.find(s=>s.day==='2026-09-05').key];await assert.rejects(v.service.saveAdminAttendance('admin',v.input),/Verified attendance/);});
test('non-admins, overlapping ranges and stale previews cannot mutate attendance',async()=>{const h=setup();await ready(h);h.setRole('PARENT');await assert.rejects(h.service.saveAdminAttendance('parent',h.input),/Administrator/);h.setRole('ADMIN');await h.service.saveAdminAttendance('admin',h.input);h.input.from='2026-08-01';await ready(h);await assert.rejects(h.service.saveAdminAttendance('admin',h.input),/overlaps/);h.input.fingerprint='wrong';await assert.rejects(h.service.saveAdminAttendance('admin',h.input),/Preview|preview/);});
test('failed points write rolls back attendance and creates no recovery report',async()=>{const h=setup();await ready(h);h.setFailLedger(true);await assert.rejects(h.service.saveAdminAttendance('admin',h.input),/Ledger unavailable/);assert.ok(h.records.every(r=>r.status==='ABSENT'));assert.equal(h.reports.length,0);});
test('ordinary class rewards do not borrow legacy points from another class on the same date',async()=>{const a={id:'a',title:'Arabic',program:{title:'Arabic'}},b={id:'b',title:'Arabic',program:{title:'Arabic'}};const state=await ledger.attendancePointState({},'child',a,new Date('2026-09-05T09:00:00Z'),{schedules:[a,b],rows:[{sourceId:'b:2026-09-05',points:5,sourceType:'ATTENDANCE_ZOOM'}]});assert.equal(state.verifiedBalance,0);});
const summary=load('src/lib/live-classes/attendance-summary.ts',{'./attendance-policy':policy});
test('monthly and overall percentages subtract estimates once and disclose unknown monthly splits',()=>{const rows=[{lessonDate:new Date('2026-08-10T12:00:00Z'),status:'PRESENT'},{lessonDate:new Date('2026-09-10T12:00:00Z'),status:'PRESENT'}];const report={fromDay:'2026-08-01',toDay:'2026-09-22',missedCount:1,parentName:'Parent'};assert.equal(summary.attendanceTotals(rows,[report]).rate,50);assert.ok(summary.monthlyAttendance(rows,[report]).every(m=>m.uncertain&&m.rate===null));assert.equal(summary.attendanceTotals(rows,[]).rate,100);});

test('admin-recorded attendance cannot be overwritten by a stale parent confirmation',async()=>{
 const h=setup();await ready(h);h.input.mode='dates';h.input.missedKeys=[(await ready(h)).sessions[0].key];await h.service.saveAdminAttendance('admin',h.input);
 // The admin loader remains revisable, while the ordinary parent loader marks it protected.
 const parentGroups=await load('src/lib/live-classes/parent-attendance.ts',{'server-only':{},'@/lib/db':{db:h.db},'@/lib/live-classes/attendance-policy':policy,'@/lib/live-classes/attendance-ledger':ledger,'@/lib/live-classes/service':{cleanLiveClassTitle:s=>s,isLiveClassVisibleToStudents:()=>true,isParentalLiveClass:()=>false,createReadOnlyRosterResolver:()=>async()=>['child']},'@/lib/community/house-points':{ensureStudentHouseMembership:async()=>({houseId:'house'})}}).loadRecoveryGroups('parent','child',new Date('2026-09-22T12:00:00Z'));
 assert.ok(parentGroups.every(group=>group.locked));
});

test('admin form exposes multiple learners and defaults to August without saving on render',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const exports={};
 const source=fs.readFileSync('src/components/admin/AdminAttendanceRecovery.tsx','utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id==='@/app/admin/attendance/actions'?{previewRecovery:()=>{throw Error('unexpected preview');},saveRecovery:()=>{throw Error('unexpected save');}}:require(id)});
 const html=renderToStaticMarkup(React.createElement(exports.AdminAttendanceRecovery,{today:'2026-09-25',learners:[{id:'a',name:'Mustafa',parents:'Nida',teachers:['Mehran']},{id:'b',name:'Child B',parents:'Parent B',teachers:['Sabah']}]}));
 assert.match(html,/2026-08-01/);assert.match(html,/Mustafa/);assert.match(html,/Child B/);assert.equal((html.match(/type="checkbox"/g)||[]).length,2);assert.match(html,/Parent report/);
});
