import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path,deps={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='server-only'?{}:id in deps?deps[id]:require(id),Date,Error,Buffer,console,process,...extra});return exports;}
const policy=load('src/lib/live-classes/zoom-presence-policy.ts');
const summary=load('src/lib/live-classes/zoom-presence-summary.ts',{'./zoom-presence-policy':policy});
const codes=()=>[{id:'first',names:['First Child'],emails:['shared@example.test']},{id:'second',names:['Second Child'],emails:['shared@example.test']}];
test('child attendance codes are stable, distinct and work without a Zoom email',()=>{const first=policy.zoomAttendanceCode('student','first');assert.equal(first,policy.zoomAttendanceCode('student','first'));assert.notEqual(first,policy.zoomAttendanceCode('parent','first'));assert.equal(policy.matchZoomIdentity('student',codes(),first+' - display name',null).id,'first');assert.equal(policy.matchZoomIdentity('parent',codes(),first,null),null);});
test('ambiguous shared email, unknown device and wrong attendance code remain unmatched',()=>{assert.equal(policy.matchZoomIdentity('student',codes(),'iPhone','shared@example.test'),null);assert.equal(policy.matchZoomIdentity('student',codes(),'iPhone'),null);assert.equal(policy.matchZoomIdentity('student',codes(),'GM-S-000000000000 First Child','shared@example.test'),null);assert.equal(policy.matchZoomIdentity('student',codes(),'Second Child','shared@example.test').id,'second');});
const date=value=>new Date('2026-10-05T'+value+'Z');
test('seconds exclude reconnect gaps, simultaneous devices and open connections without rounding to completion',()=>{const rows=[{joinedAt:date('09:00:00'),leftAt:date('09:30:00')},{joinedAt:date('09:20:00'),leftAt:date('09:40:00')},{joinedAt:date('09:50:00'),leftAt:date('10:00:00')},{joinedAt:date('10:00:00'),leftAt:null}];assert.equal(policy.connectedSeconds(rows),3000);assert.equal(policy.connectedSeconds([{joinedAt:date('09:00:00'),leftAt:date('09:59:59')}]),3599);});
const schedule=(id,title,weekday=1,startTime='14:00',endTime='15:00')=>({id,title,weekday,startTime,endTime,timezone:'Asia/Karachi',startsOn:null,endsOn:null,teacher:{user:{email:'teacher@example.test'}}});
test('shared meeting IDs route by actual topic and timetable, never first database row',()=>{const rows=[schedule('leadership','Life Lessons',2),schedule('arabic','Arabic',1)];assert.equal(policy.selectZoomAttendanceSchedule(rows,date('09:00:00')).id,'arabic');assert.equal(policy.selectZoomAttendanceSchedule([schedule('a','Arabic'),schedule('b','Seerah')],date('09:00:00')),null);assert.equal(policy.selectZoomAttendanceSchedule(rows,date('09:00:00'),'Life Lessons').id,'leadership');assert.equal(policy.selectZoomAttendanceSchedule([schedule('a','Arabic',3)],date('09:00:00')),null);});
function interval(id,subject,day,from='09:00:00',to='10:00:00',parent=false){return {id,studentId:parent?null:'child',parentId:parent?'parent':null,meetingUuid:'meeting'+id,participantName:'Child',joinedAt:new Date(day+'T'+from+'Z'),leftAt:to?new Date(day+'T'+to+'Z'):null,evidenceSource:'zoom-report',matchMethod:'attendance-code',sessionStartedAt:null,sessionEndedAt:null,schedule:{title:subject,program:{title:subject,slug:subject}}};}
const enrolled=['arabic','tajweed','seerah','leadership'].map(slug=>({slug,title:slug,startedAt:new Date('2026-09-01')}));
test('full programme has five one-hour days; duplicate Arabic and Tajweed enrolments are one requirement',()=>{const rows=[interval('1','arabic','2026-10-05'),interval('2','arabic','2026-10-07'),interval('3','tajweed','2026-10-09'),interval('4','seerah','2026-10-10'),interval('5','leadership','2026-10-11')];const report=summary.buildZoomPresenceSummary('2026-10',rows,enrolled,new Date('2026-11-01'));const week=report.weeks.find(w=>w.week==='2026-10-05');assert.equal(week.programmes.length,3);assert.equal(week.programmes.reduce((sum,p)=>sum+p.completed,0),5);assert.ok(week.programmes.every(p=>p.state==='Completed'));});
test('three hours in a single day do not fulfil three required days and 59:59 is partial',()=>{const rows=[interval('1','arabic','2026-10-05','09:00:00','12:00:00'),interval('2','arabic','2026-10-07','09:00:00','09:59:59')];const r=summary.buildZoomPresenceSummary('2026-10',rows,enrolled,new Date('2026-11-01'));const p=r.weeks.find(w=>w.week==='2026-10-05').programmes.find(p=>p.subject==='arabic');assert.equal(p.completed,1);assert.equal(p.minutes,239);});
test('Sunday parent attendance cannot satisfy child Seerah attendance',()=>{const rows=[interval('p','Parental session','2026-10-11','09:00:00','10:00:00',true)];const r=summary.buildZoomPresenceSummary('2026-10',rows,[...enrolled,{slug:'parental',title:'Parent session',startedAt:new Date('2026-09-01')}],new Date('2026-11-01'));const week=r.weeks.find(w=>w.week==='2026-10-05');assert.equal(week.programmes.find(p=>p.subject==='parental').completed,1);assert.equal(week.programmes.find(p=>p.subject==='seerah').completed,0);});
test('actual meeting boundary clips early joins and prevents counting time outside class',()=>{const row=interval('1','seerah','2026-10-10','08:00:00','10:00:00');row.sessionStartedAt=new Date('2026-10-10T09:30:00Z');const r=summary.buildZoomPresenceSummary('2026-10',[row],enrolled,new Date('2026-11-01'));assert.equal(r.programmeTotals.find(p=>p.subject==='seerah').minutes,30);});
test('partial calendar weeks and enrolment midweek are not judged against full-week targets',()=>{const partial=summary.buildZoomPresenceSummary('2026-10',[],enrolled,new Date('2026-11-01'));assert.ok(partial.weeks[0].programmes.every(p=>!p.assessable));const middle=summary.buildZoomPresenceSummary('2026-10',[],[{slug:'seerah',title:'Seerah',startedAt:new Date('2026-10-07')}],new Date('2026-11-01'));assert.equal(middle.weeks.find(w=>w.week==='2026-10-05').programmes[0].assessable,false);});
test('future months and invalid dates are refused',()=>{assert.equal(summary.validPresenceMonth('2026-13',new Date('2026-10-28')),false);assert.equal(summary.validPresenceMonth('2026-11',new Date('2026-10-28')),false);});
function workerFixture({enabled=true,failReport=false,ambiguous=false,reportCount=2}={}){
 const jobs=[],calls={joins:[],left:[],batches:[],reports:0,ends:0};let occurrence=false;
 function matches(row,where={}){return Object.entries(where).every(([key,value])=>{if(key==='OR')return value.some(v=>matches(row,v));if(key==='AND')return value.every(v=>matches(row,v));if(value&&typeof value==='object'&&!(value instanceof Date)){if(value.not!==undefined&&row[key]===value.not)return false;if(value.in)return value.in.includes(row[key]);if(value.lte&&!(row[key]<=value.lte))return false;if(value.lt&&!(row[key]<value.lt))return false;return true;}return row[key]===value;});}
 function create(data){const row={id:'job-'+jobs.length,attempts:0,availableAt:new Date(),createdAt:new Date(),updatedAt:new Date(),lockedAt:null,lockToken:null,...structuredClone(data)};jobs.push(row);return row;}
 const work={upsert:async({where,create:data})=>jobs.find(j=>j.eventKey===where.eventKey)||create(data),createMany:async({data})=>{let count=0;for(const row of data)if(!jobs.some(j=>j.eventKey===row.eventKey)){create(row);count++;}return{count};},findFirst:async({where})=>jobs.find(j=>matches(j,where))??null,findMany:async({where,take})=>jobs.filter(j=>matches(j,where)).slice(0,take).map(j=>structuredClone(j)),updateMany:async({where,data})=>{let count=0;for(const row of jobs)if(matches(row,where)){Object.assign(row,structuredClone(data));count++;}return{count};}};
 const rows=Array.from({length:reportCount},(_,i)=>({user_id:'participant-'+i,name:'Child '+i,join_time:'2026-10-05T09:00:00Z',leave_time:'2026-10-05T10:00:00Z',duration:3600}));
 const db={zoomAttendanceWork:work,classSchedule:{findMany:async()=>ambiguous?[schedule('a','Arabic'),schedule('b','Arabic')]:[schedule('a','Arabic')]},zoomAttendanceInterval:{updateMany:async()=>({count:0})},liveClassSessionOccurrence:{findFirst:async()=>occurrence?{id:'occurrence'}:null}};
 const api=load('src/lib/live-classes/zoom-attendance-work.ts',{'@prisma/client':{Prisma:{}},'@/lib/db':{db},'@/lib/zoom/client':{getZoomPastMeetingParticipants:async()=>{calls.reports++;if(failReport)throw Error('Zoom scope missing');return rows;},getZoomPastMeetingInstances:async()=>[]},'./attendance':{recordZoomParticipantJoined:async(s,e)=>calls.joins.push([s,e]),recordZoomParticipantLeft:async(s,e)=>calls.left.push([s,e]),reconcileZoomParticipantRows:async(s,m,u,batch)=>calls.batches.push(batch)},'./occurrences':{recordLiveClassSessionOccurrence:async()=>{occurrence=true;},recordLiveClassSessionEnd:async()=>{calls.ends++;}},'./zoom-presence-policy':policy},{process:{env:{ZOOM_ATTENDANCE_PIPELINE_ENABLED:enabled?'true':'false'}}});
 const event=(type='meeting.participant_joined',uuid='occurrence')=>({event:type,event_ts:Date.parse('2026-10-05T09:00:00Z'),payload:{object:{id:'meeting',uuid,topic:'Arabic',start_time:'2026-10-05T09:00:00Z',end_time:type==='meeting.ended'?'2026-10-05T10:00:00Z':undefined,participant:{user_id:'p',user_name:'Child',join_time:'2026-10-05T09:00:00Z',leave_time:'2026-10-05T10:00:00Z'}}}});
 return{api,jobs,calls,event,reportRows:rows,ready:()=>jobs.forEach(j=>j.availableAt=new Date(0))};
}
test('webhook inbox deduplicates retries and disabled rollout never writes queue rows',async()=>{const f=workerFixture();await f.api.captureZoomPresence(f.event());await f.api.captureZoomPresence(f.event());assert.equal(f.jobs.length,1);const disabled=workerFixture({enabled:false});assert.equal(await disabled.api.captureZoomPresence(disabled.event()),false);assert.equal(disabled.jobs.length,0);});
test('two worker instances cannot both claim the same participant event',async()=>{const f=workerFixture();await f.api.captureZoomPresence(f.event());await Promise.all([f.api.processZoomAttendanceWork(),f.api.processZoomAttendanceWork()]);assert.equal(f.calls.joins.length,1);assert.equal(f.jobs[0].status,'DONE');});
test('post-meeting report is fetched once and processed in recoverable batches',async()=>{const f=workerFixture({reportCount:45});await f.api.captureZoomPresence(f.event('meeting.ended'));f.ready();for(let i=0;i<3;i++)await f.api.processZoomAttendanceWork();assert.equal(f.calls.reports,1);assert.equal(f.calls.batches.map(b=>b.length).join(','),'20,20,5');assert.equal(f.jobs[0].status,'DONE');assert.equal(f.jobs[0].payload.cursor,45);});
test('report API failures survive restarts and surface after bounded retries',async()=>{const f=workerFixture({failReport:true});await f.api.captureZoomPresence(f.event('meeting.ended'));f.ready();await f.api.processZoomAttendanceWork();assert.equal(f.jobs[0].status,'PENDING');assert.equal(f.jobs[0].attempts,1);assert.match(f.jobs[0].lastError,/scope/);f.jobs[0].attempts=11;f.ready();await f.api.processZoomAttendanceWork();assert.equal(f.jobs[0].status,'FAILED');assert.equal(f.calls.batches.length,0);});
test('ambiguous schedules and missing occurrence UUIDs remain retryable, without arbitrary attendance',async()=>{for(const options of [{ambiguous:true},{uuid:null}]){const f=workerFixture(options);await f.api.captureZoomPresence(f.event('meeting.participant_joined',options.uuid===null?null:'occurrence'));await f.api.processZoomAttendanceWork();assert.equal(f.jobs[0].status,'PENDING');assert.equal(f.calls.joins.length,0);}});
function reportFixture(){
 let intervalReads=0;
 const student={id:'child',userId:'child-user',displayName:'Child',user:{firstName:'Child',lastName:'One'},parents:[{parent:{id:'parent-profile',userId:'parent-user',createdAt:new Date('2026-01-01'),user:{firstName:'Parent',lastName:'One'}}}],enrollments:[{programId:'arabic',status:'ACTIVE',startedAt:new Date('2026-01-01'),createdAt:new Date('2026-01-01'),program:{slug:'arabic',title:'Arabic'}}]};
 const db={studentProfile:{findUnique:async()=>student},teacherProfile:{findUnique:async({where})=>({programAssignments:where.userId==='assigned-teacher'?[{programId:'arabic'}]:[{programId:'other'}]})},zoomAttendanceInterval:{findMany:async()=>{intervalReads++;return [];}}};
 const api=load('src/lib/live-classes/zoom-presence-report.ts',{'@/lib/teacher/dashboard':{getTeacherDashboardData:async id=>({rosters:id==='assigned-teacher'?[{students:[{id:'child'}]}]:[]})},'@/lib/db':{db},'./zoom-presence-policy':policy,'./zoom-presence-summary':summary,'./zoom-attendance-work':{zoomPresenceEnabled:()=>true}});
 return{api,intervalReads:()=>intervalReads};
}
test('monthly reports reject another parent, another child account and an unrelated teacher before reading intervals',async()=>{for(const user of [{id:'other-parent',role:'PARENT'},{id:'other-child',role:'STUDENT'},{id:'other-teacher',role:'TEACHER'}]){const f=reportFixture();await assert.rejects(f.api.getZoomPresenceReport(user,'child','2026-10'),/access/);assert.equal(f.intervalReads(),0);}});
test('linked parent receives separate parent and child names; assigned teachers and admins can read reports',async()=>{for(const user of [{id:'parent-user',role:'PARENT'},{id:'assigned-teacher',role:'TEACHER'},{id:'admin',role:'ADMIN'}]){const f=reportFixture(),r=await f.api.getZoomPresenceReport(user,'child','2026-10');assert.match(r.studentZoomName,/GM-S-/);assert.match(r.parentZoomNames[0].zoomName,/GM-P-/);assert.equal(f.intervalReads(),1);}});
test('final report replaces uncertain webhook timing without double-counting the same occurrence',()=>{
 const provisional=interval('p','seerah','2026-10-10','08:30:00','10:00:00');provisional.meetingUuid='one-occurrence';provisional.evidenceSource='webhook';
 const final=interval('f','seerah','2026-10-10','09:15:00','10:00:00');final.meetingUuid='one-occurrence';
 const r=summary.buildZoomPresenceSummary('2026-10',[provisional,final],enrolled,new Date('2026-11-01'));
 assert.equal(r.programmeTotals.find(p=>p.subject==='seerah').minutes,45);
 assert.equal(r.weeks.find(w=>w.week==='2026-10-05').programmes.find(p=>p.subject==='seerah').completed,0);
});
test('legacy inferred intervals remain visible evidence without satisfying new hour requirements',()=>{
 const row=interval('old','seerah','2026-10-10');row.evidenceSource='legacy';
 assert.equal(summary.buildZoomPresenceSummary('2026-10',[row],enrolled,new Date('2026-11-01')).programmeTotals.find(p=>p.subject==='seerah').minutes,0);
});
test('a one-hour class crossing PKT midnight counts once in its teaching-start week',()=>{
 const row=interval('midnight','seerah','2026-10-11','18:30:00','19:30:00');row.sessionStartedAt=row.joinedAt;
 const r=summary.buildZoomPresenceSummary('2026-10',[row],enrolled,new Date('2026-11-01'));
 assert.equal(r.weeks.find(w=>w.week==='2026-10-05').programmes.find(p=>p.subject==='seerah').completed,1);
 assert.equal(r.weeks.find(w=>w.week==='2026-10-12').programmes.find(p=>p.subject==='seerah').completed,0);
});

test('an expired worker lease is recovered without leaving the event stuck processing',async()=>{
 const f=workerFixture();await f.api.captureZoomPresence(f.event());Object.assign(f.jobs[0],{status:'PROCESSING',lockedAt:new Date(0),lockToken:'expired'});
 await f.api.processZoomAttendanceWork();assert.equal(f.jobs[0].status,'DONE');assert.equal(f.calls.joins.length,1);
});
test('partial Zoom report snapshot is retained and refreshed instead of being marked complete',async()=>{
 const f=workerFixture();f.reportRows[0].leave_time=undefined;await f.api.captureZoomPresence(f.event('meeting.ended'));f.ready();await f.api.processZoomAttendanceWork();
 assert.equal(f.jobs[0].status,'PENDING');assert.equal(f.jobs[0].payload.reportReady,false);assert.equal(f.calls.batches.length,0);
 f.reportRows[0].leave_time='2026-10-05T10:00:00Z';f.ready();await f.api.processZoomAttendanceWork();assert.equal(f.jobs[0].status,'DONE');assert.equal(f.calls.reports,2);
});
test('participant processing is not blocked behind discovery backlog',async()=>{
 const f=workerFixture();await f.api.seedZoomAttendanceDiscovery();await f.api.captureZoomPresence(f.event());
 await f.api.processZoomAttendanceWork(1,true);assert.equal(f.calls.joins.length,1);assert.equal(f.jobs.find(j=>j.kind==='SEED').status,'PENDING');
});
test('two child codes in a shared device name are ambiguous, not attendance for the first child',()=>{
 assert.equal(policy.matchZoomIdentity('student',codes(),policy.zoomAttendanceCode('student','first')+' '+policy.zoomAttendanceCode('student','second')),null);
});
test('durable inbox stores attendance metadata without recording download tokens',async()=>{
 const f=workerFixture(),event=f.event();event.download_token='SENSITIVE_DOWNLOAD_TOKEN';event.payload.object.recording_files=[{download_url:'SENSITIVE_DOWNLOAD_URL'}];
 await f.api.captureZoomPresence(event);assert.doesNotMatch(JSON.stringify(f.jobs[0].payload),/SENSITIVE/);assert.equal(f.jobs[0].payload.payload.object.participant.user_name,'Child');
});
