import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(source,deps={},globals={}) { const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,URLSearchParams,AbortSignal,console,require:id=>{if(id in deps)return deps[id];throw Error(id);},...globals});return exports; }
const policy=load(fs.readFileSync('src/lib/live-classes/schedule-lifecycle.ts','utf8'));
test('a stopped schedule cannot become live because of an older open occurrence',async()=>{
 const source=fs.readFileSync('src/lib/live-classes/service.ts','utf8');const ast=ts.createSourceFile('service.ts',source,ts.ScriptTarget.Latest,true);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getLiveClassAccessState').getText(ast);let occurrenceReads=0;
 const db={classSchedule:{findUnique:async()=>({endsOn:new Date(0),teacher:{userId:'teacher'}})},liveClassSessionOccurrence:{findFirst:async()=>{occurrenceReads++;return{endedAt:null};}}};
 const {getLiveClassAccessState}=load(fn,{}, {...policy,db});assert.equal(await getLiveClassAccessState('stopped'),'ended');assert.equal(occurrenceReads,0);
});
test('stopped portal joins cannot write attendance or award points',async()=>{
 let writes=0;
 const tx={classSchedule:{findUnique:async()=>({endsOn:new Date(0),meetingUrl:'https://example.invalid'})},liveClassSessionOccurrence:{findFirst:async()=>{writes++;}}};
 const {recordPortalClassJoin}=load(fs.readFileSync('src/lib/live-classes/portal-join.ts','utf8'),{'server-only':{},crypto:{randomUUID:()=>''},'@/lib/db':{db:{$transaction:fn=>fn(tx)}},'@/lib/live-classes/schedule-lifecycle':policy,'@/lib/community/house-points':{ensureStudentHouseMembership:async()=>({})},'@/lib/live-classes/attendance-policy':{},'@/lib/live-classes/attendance-ledger':{lockAttendanceStudent:async()=>{}}});
 await assert.rejects(recordPortalClassJoin('schedule','student','user'),/stopped/);assert.equal(writes,0);
});
test('recording inventory rejects anonymous and non-admin access before storage queries',async()=>{
 let reads=0;for(const role of [null,'PARENT','STUDENT','TEACHER']){
  const {GET}=load(fs.readFileSync('src/app/api/admin/recordings/recovery/route.ts','utf8'),{'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'@/lib/auth/session':{getCurrentSession:async()=>role?{user:{role}}:null},'@/lib/db':{db:{teacherProfile:{findUnique:()=>{reads++;}}}},'@/lib/google-drive/client':{driveRequest:()=>{reads++;}},'@/lib/zoom/client':{getZoomUserRecordings:()=>{reads++;}}});
  assert.equal((await GET({nextUrl:new URL('https://example.invalid/?teacherUserId=teacher')})).status,403);
 }assert.equal(reads,0);
});
test('all four schedule-removal paths archive instead of deleting related history',()=>{
 for(const path of ['src/app/teacher/live-sessions/actions/route.ts','src/app/admin/classes/page.tsx','src/lib/live-classes/service.ts','src/app/teacher/course-builder/CourseBuilderWorkspace.tsx']){const source=fs.readFileSync(path,'utf8');assert.ok(source.includes('archiveClassSchedule('));assert.ok(!/classSchedule\.delete(?:Many)?\(/.test(source));}
});
