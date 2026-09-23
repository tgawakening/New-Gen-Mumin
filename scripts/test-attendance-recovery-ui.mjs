import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,deps){
 const exports={};const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id in deps?deps[id]:require(id),Date,Intl,console});
 return exports;
}
const {ParentAttendanceRecovery}=load('../src/components/dashboard/family/ParentAttendanceRecovery.tsx',{'@/app/parent/attendance/actions':{saveAttendanceConfirmations:async()=>({message:'',error:''})}});
test('parent recovery screen distinguishes selectable missing attendance from protected verification',()=>{
 const html=renderToStaticMarkup(React.createElement(ParentAttendanceRecovery,{studentId:'child',audit:[],rows:[
  {key:'pending',day:'2026-09-05',title:'Seerah',status:'NEEDS_CONFIRMATION',locked:false,alternatives:2},
  {key:'verified',day:'2026-09-06',title:'Arabic',status:'PRESENT',locked:true,alternatives:1},
 ]}));
 assert.match(html,/Confirm past attendance/);assert.match(html,/5 points/);assert.match(html,/Needs confirmation/);
 assert.match(html,/Present · verified/);assert.equal((html.match(/<select/g)||[]).length,1);assert.match(html,/Attend either time slot/);
});
test('empty session lists explain missing dates without inventing classes',()=>{
 const html=renderToStaticMarkup(React.createElement(ParentAttendanceRecovery,{studentId:'child',audit:[],rows:[]}));
 assert.match(html,/No completed class dates/);assert.match(html,/teacher to check the session record/);
});
test('server action blocks non-parents and validates confirmation and payload',async()=>{
 let role='STUDENT',called=0;
 class AttendanceConfirmationError extends Error{}
 const {saveAttendanceConfirmations}=load('../src/app/parent/attendance/actions.ts',{
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/auth/session':{getCurrentSession:async()=>({user:{id:'parent',role}})},
  '@/lib/live-classes/parent-attendance':{AttendanceConfirmationError,confirmParentAttendance:async()=>{called++;return{saved:1,pointsDelta:5};}},
 });
 const form=new FormData();form.set('studentId','child');form.set('changes',JSON.stringify([{key:'a'.repeat(64),status:'PRESENT'}]));form.set('confirmed','yes');
 assert.match((await saveAttendanceConfirmations({},form)).error,/parent account/);assert.equal(called,0);
 role='PARENT';form.delete('confirmed');assert.match((await saveAttendanceConfirmations({},form)).error,/confirm/);
 form.set('confirmed','yes');form.set('changes','broken');assert.match((await saveAttendanceConfirmations({},form)).error,/valid attendance/);assert.equal(called,0);
 form.set('changes',JSON.stringify([{key:'a'.repeat(64),status:'PRESENT'}]));
 assert.match((await saveAttendanceConfirmations({},form)).message,/\+5 points/);assert.equal(called,1);
});
