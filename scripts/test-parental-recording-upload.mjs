import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
function load(path,deps={}) { const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='server-only'?{}:(deps[id]??{}),console,Buffer,crypto:webcrypto});return exports; }
const category=load('src/lib/live-classes/manual-recording-category.ts');
function fixture(name='Mehran',source='drive') {
 const teacher={id:'teacher',userId:'teacher-user',user:{id:'teacher-user',firstName:name,lastName:'Raziq',email:name==='Mehran'?'mehranraziq@gmail.com':'other@example.test'},programAssignments:[{programId:'arabic',program:{id:'arabic',slug:'arabic',title:'Arabic'}},{programId:'seerah',program:{id:'seerah',slug:'seerah',title:'Seerah'}}]};
 const state={schedule:null,recording:null,uploads:[],notifications:[]};
 const db={teacherProfile:{findMany:async()=>[teacher]},program:{findUnique:async({where})=>teacher.programAssignments.find(a=>a.programId===where.id)?.program},classSchedule:{create:async({data})=>{state.schedule={...data,id:'schedule'};return state.schedule;}},liveClassRecording:{upsert:async({create})=>{state.recording={...create,id:'recording',deletedAt:null,schedule:{...state.schedule,teacher,program:teacher.programAssignments.find(a=>a.programId===state.schedule.programId).program}};return state.recording;},findMany:async()=>[state.recording],findFirst:async()=>state.recording},notification:{findFirst:async()=>null,create:async({data})=>state.notifications.push(data)},parentStudent:{findFirst:async()=>({studentId:'child'}),findMany:async()=>[{studentId:'child',parent:{userId:'parent-user'}}]},enrollment:{findFirst:async()=>null}};
 const parental=title=>(title??'').includes('[Category:PARENTAL]');
 const recordings=load('src/lib/live-classes/recordings.ts',{'@/lib/db':{db},'@/lib/live-classes/manual-recording-category':category,'@/lib/genm/curriculum':{displayProgramTitle:title=>title},'@/lib/google-drive/client':{driveRequest:async()=>({id:'abcdefghijklmnopqrstuv',webViewLink:'https://drive.google.com/file/d/abcdefghijklmnopqrstuv/view',mimeType:'video/mp4'})},'@/lib/google-drive/materials':{uploadLiveClassRecordingToDrive:async input=>{state.uploads.push(input);return {id:'uploaded-file',webViewLink:'https://drive.google.com/file/d/uploaded-file/view'};}},'@/lib/live-classes/service':{PARENTAL_SESSION_MARKER:'[Category:PARENTAL]',isParentalLiveClass:parental,isLiveClassVisibleToStudents:()=>true,cleanLiveClassTitle:title=>title.replace(/\[[^\]]+\]/g,'').trim()},'@/lib/live-classes/recording-share':{createRecordingShareToken:()=>({expiresAt:123,token:'token'})}});
 const input={adminUserId:'admin',teacherId:'teacher',programId:'parental-sessions',title:'Family learning session',sessionDate:'2026-10-20',source,driveUrl:'abcdefghijklmnopqrstuv',file:{size:5,name:'parental.mp4',type:'video/mp4',arrayBuffer:async()=>new Uint8Array(5).buffer}};
 return {recordings,state,input};
}
test('Mehran gets a Parental Session option; other teachers retain assigned programmes',async()=>{
 const f=fixture();const options=await f.recordings.listManualRecordingFormOptions();assert.ok(options[0].programs.some(p=>p.id==='parental-sessions'&&p.title==='Parental Session'));
 const other=fixture('Other');assert.ok(!(await other.recordings.listManualRecordingFormOptions())[0].programs.some(p=>p.id==='parental-sessions'));
 await assert.rejects(other.recordings.addManualLiveClassRecording(other.input),/Sir Mehran/);
});
for(const source of ['drive','upload'])test('parental '+source+' is categorized and playable for a linked parent outside Seerah',async()=>{
 const f=fixture('Mehran',source);await f.recordings.addManualLiveClassRecording(f.input);
 assert.equal(f.state.schedule.programId,'seerah');assert.match(f.state.schedule.title,/\[Category:PARENTAL\]/);assert.match(f.state.recording.topic,/\[Category:PARENTAL\]/);
 const visible=await f.recordings.listParentChildRecordings('parent','child');assert.equal(visible[0].programSlug,'parental-sessions');assert.equal(visible[0].programTitle,'Parental Sessions');
 assert.ok(await f.recordings.userCanAccessRecording('recording',{id:'parent',role:'PARENT'}));
 const playback=await f.recordings.getRecordingPlaybackDetails('recording',{id:'parent',role:'PARENT'});assert.equal(playback.programTitle,'Parental Sessions');
 if(source==='upload')assert.equal(f.state.uploads[0].programId,'seerah');
});
test('regular programme recording retains its classification and enrolment access requirement',async()=>{
 const f=fixture();await f.recordings.addManualLiveClassRecording({...f.input,programId:'arabic'});
 assert.doesNotMatch(f.state.schedule.title,/Category:PARENTAL/);
 assert.equal((await f.recordings.listParentChildRecordings('parent','child'))[0].programSlug,'arabic');
 assert.equal(await f.recordings.userCanAccessRecording('recording',{id:'parent',role:'PARENT'}),null);
});

test('parental ready notifications go to linked parents without course-specific student alerts',async()=>{
 const f=fixture();await f.recordings.addManualLiveClassRecording({...f.input,notifyUsers:true});
 const parentAlert=f.state.notifications.find(n=>n.userId==='parent-user');assert.ok(parentAlert);assert.match(parentAlert.href,/parent\/recordings/);
 assert.ok(!f.state.notifications.some(n=>n.userId==='child'));
});
