import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
export function load(file,deps={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,URL,console,require:id=>id in deps?deps[id]:id==='server-only'?{}:require(id)});return exports; }
const protocol=load('src/lib/quizzes/protocol.ts');
const round=new Date('2026-10-07T10:00:00.000Z');
const live={id:'session',quizId:'quiz',teacherUserId:'teacher',status:'LIVE',currentQuestionId:'q1',currentQuestionStartedAt:round};
const quiz={id:'quiz',programId:'arabic',title:'Test quiz',isPublished:true,meta:{responseWindowSeconds:60},questions:[{id:'q1',prompt:'Choose A',type:'MCQ',points:5,meta:{choices:['A','B']},answerKey:{answer:'A'}},{id:'q2',prompt:'Choose B',type:'MCQ',points:5,meta:{choices:['A','B']},answerKey:{answer:'B'}}]};
function fixture({allowed=true,status='LIVE'}={}) {
 let responses=[],ledgers=[],rosterReads=0; const session={...live,status};
 const learner={id:'child',displayName:'Child',user:{firstName:'Child',avatarUrl:null},houseMembership:{house:{name:'House'}}};
 const seat={id:'seat',studentId:'child',sessionId:'session',joinedAt:round,student:learner};
 const db={
  quizLiveSession:{findUnique:async()=>({...session}),findMany:async()=>[{...session}],updateMany:async({where,data})=>{if(where.currentQuestionStartedAt!==undefined && +where.currentQuestionStartedAt!==+session.currentQuestionStartedAt)return{count:0};Object.assign(session,data);return{count:1};}},
  quiz:{findUnique:async()=>quiz,findMany:async()=>[quiz]},studentProfile:{findMany:async()=>[learner]},enrollment:{findMany:async()=>[{studentId:'child',programId:'arabic'}]},
  quizLiveSeat:{findFirst:async({where})=>{assert.equal(where.student.parents.some.parent.userId,'parent');assert.equal(where.student.enrollments.some.programId,'arabic');return allowed&&(!where.studentId||where.studentId==='child')?seat:null;},findMany:async()=>allowed?[seat]:[],update:async()=>seat},
  houseMembership:{findUnique:async()=>({houseId:'house'})},housePointLedger:{create:async({data})=>ledgers.push(data)},
  quizLiveResponse:{findMany:async()=>responses,findUnique:async({where})=>responses.find(r=>r.questionId===where.sessionId_questionId_studentId.questionId)||null},
  $executeRaw:async(strings,...args)=>{const [id,questionId,studentId,answer,isCorrect,earnedPoints,housePointsAwarded,answeredAt,sessionId,currentQuestionId,currentRound]=args;if(sessionId!==session.id||session.status!=='LIVE'||session.currentQuestionId!==currentQuestionId||+session.currentQuestionStartedAt!==+currentRound)return 0;if(responses.some(r=>r.questionId===questionId))throw Object.assign(new Error('duplicate'),{code:'P2010'});responses.push({id,questionId,studentId,answer:JSON.parse(answer),isCorrect,earnedPoints,housePointsAwarded,answeredAt});return 1;},
 };
 db.$transaction=async fn=>fn(db);
 const service=load('src/lib/quizzes/runtime.ts',{'@/lib/db':{db},'@/lib/live-classes/service':{createReadOnlyRosterResolver:()=>{rosterReads++;throw Error('Roster should not load during polling');}},'@/lib/community/house-points':{ensureStudentHouseMembership:async()=>{}},'@/lib/quizzes/avatars':{QUIZ_AVATARS:[]},'./protocol':protocol});
 return {service,session,db,responses,ledgers,rosterReads:()=>rosterReads};
}
const parent={id:'parent',role:'PARENT'},teacher={id:'teacher',role:'TEACHER'};
const answer={studentId:'child',questionId:'q1',round:round.toISOString(),answer:'A'};
test('answer deadline uses server receipt time, with bounded grace and exact round',()=>{assert.equal(protocol.roundAcceptsAnswer(live,'q1',round.toISOString(),new Date(+round+65000),60),true);for(const [q,r,time] of [['q2',round.toISOString(),+round],['q1',new Date(+round+1).toISOString(),+round],['q1',round.toISOString(),+round+65001]])assert.equal(protocol.roundAcceptsAnswer(live,q,r,new Date(time),60),false);assert.equal(protocol.roundAcceptsAnswer({...live,status:'ENDED'},'q1',round.toISOString(),round,60),false);});
test('public question never exposes answer key and strips invalid media',()=>{const publicQ=protocol.publicQuestion({...quiz.questions[0],meta:{choices:['A',{},'B'],imageDataUrl:'javascript:alert(1)'}});assert.equal(publicQ.answerKey,undefined);assert.equal(publicQ.image,undefined);assert.equal(publicQ.choices.length,2);});
test('WAITING lobby is visible only for invited learners without roster recomputation',async()=>{const f=fixture({status:'WAITING'});const rows=await f.service.quizLobbyList(parent);assert.equal(rows.length,1);assert.equal(rows[0].status,'WAITING');assert.equal(f.rosterReads(),0);assert.equal((await fixture({allowed:false}).service.quizLobbyList(parent)).length,0);});
test('parent cannot read or answer another child and teacher cannot control another host',async()=>{const f=fixture();await assert.rejects(()=>f.service.quizState('session',parent,'other'),e=>e.status===403);await assert.rejects(()=>f.service.submitQuizAnswer('session',parent,{...answer,studentId:'other'},round),e=>e.status===403);await assert.rejects(()=>f.service.controlQuiz('session',{id:'other',role:'TEACHER'},{action:'open',questionId:'q2',round:round.toISOString()}),e=>e.status===403);});
test('concurrent duplicate answers save one response and award one point',async()=>{const f=fixture();const results=await Promise.all(Array.from({length:12},()=>f.service.submitQuizAnswer('session',parent,answer,new Date(+round+5000))));assert.equal(results.length,12);assert.equal(f.responses.length,1);assert.equal(f.ledgers.length,1);assert.equal(f.ledgers[0].points,1);const retry=await f.service.submitQuizAnswer('session',parent,answer,new Date(+round+100000));assert.equal(retry.points,1);assert.equal(f.ledgers.length,1);});
test('teacher advancing round invalidates an in-flight old answer at SQL write',async()=>{const f=fixture();const raw=f.db.$executeRaw;f.db.$executeRaw=async(...args)=>{f.session.currentQuestionId='q2';return raw(...args);};await assert.rejects(()=>f.service.submitQuizAnswer('session',parent,answer,round),e=>e.status===409);assert.equal(f.responses.length,0);assert.equal(f.ledgers.length,0);});
test('expired and malformed answers cannot earn points',async()=>{for(const input of [{...answer,answer:'unknown'},answer]){const f=fixture();await assert.rejects(()=>f.service.submitQuizAnswer('session',parent,input,new Date(+round+(input.answer==='unknown'?1000:66000))));assert.equal(f.ledgers.length,0);}});
test('polling state returns learner-only answers and omits unchanged question payload',async()=>{const f=fixture();const first=await f.service.quizState('session',parent,'child');assert.equal(first.question.id,'q1');assert.equal(first.roster,undefined);assert.equal(first.questions,undefined);const next=await f.service.quizState('session',parent,'child','q1');assert.equal(next.question,undefined);assert.equal(f.rosterReads(),0);});
test('reopening needs current round and refreshes timer without deleting answers',async()=>{const f=fixture();await f.service.submitQuizAnswer('session',parent,answer,round);await assert.rejects(()=>f.service.controlQuiz('session',teacher,{action:'reopen',questionId:'q1',round:new Date(+round-1).toISOString()}),e=>e.status===409);await f.service.controlQuiz('session',teacher,{action:'reopen',questionId:'q1',round:round.toISOString()});assert.ok(+f.session.currentQuestionStartedAt>+round);assert.equal(f.responses.length,1);});
