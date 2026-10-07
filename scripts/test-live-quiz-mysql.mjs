import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
const require=createRequire(import.meta.url);
function load(file,deps={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,URL,console,require:id=>id in deps?deps[id]:id==='server-only'?{}:require(id)});return exports;}
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const db=new PrismaClient();const rollback=new Error('ROLLBACK_TEST_FIXTURES');let passed=false,fixtureId;
try {
 const enrollment=await db.enrollment.findFirst({
  where:{status:{in:['ACTIVE','CONFIRMED','COMPLETED']},student:{user:{status:'ACTIVE'},houseMembership:{isNot:null},parents:{some:{}}}},
  select:{programId:true,student:{select:{id:true,userId:true,parents:{take:1,select:{parent:{select:{userId:true}}}}}}}
 });
 const teacher=await db.teacherProfile.findFirst({select:{userId:true}});
 if(!enrollment||!teacher)throw Error('No eligible fixture references');
 try { await db.$transaction(async tx=>{
  const quiz=await tx.quiz.create({data:{programId:enrollment.programId,title:'Rollback-only live quiz validation',type:'POST_LESSON',isPublished:true,meta:{responseWindowSeconds:60},questions:{create:[{prompt:'Choose A',type:'MCQ',sortOrder:0,answerKey:{answer:'A'},meta:{choices:['A','B']}},{prompt:'Choose B',type:'MCQ',sortOrder:1,answerKey:{answer:'B'},meta:{choices:['A','B']}}]}},include:{questions:{orderBy:{sortOrder:'asc'}}}});
  fixtureId=quiz.id;
  const session=await tx.quizLiveSession.create({data:{quizId:quiz.id,teacherUserId:teacher.userId,status:'WAITING',seats:{create:{studentId:enrollment.student.id,joinedAt:new Date()}}}});
  const isolated=new Proxy(tx,{get(target,key){if(key==='$transaction')return fn=>fn(tx);return target[key];}});
  const protocol=load('src/lib/quizzes/protocol.ts');
  const runtime=load('src/lib/quizzes/runtime.ts',{'@/lib/db':{db:isolated},'@/lib/live-classes/service':{createReadOnlyRosterResolver(){throw Error('Unexpected roster load');}},'@/lib/community/house-points':{ensureStudentHouseMembership:async()=>{}},'@/lib/quizzes/avatars':{QUIZ_AVATARS:[]},'./protocol':protocol});
  const parent={id:enrollment.student.parents[0].parent.userId,role:'PARENT'},host={id:teacher.userId,role:'TEACHER'};
  assert.ok((await runtime.quizLobbyList(parent)).some(x=>x.sessionId===session.id));
  await assert.rejects(()=>runtime.quizState(session.id,parent,'not-owned'),e=>e.status===403);
  await runtime.controlQuiz(session.id,host,{action:'open',questionId:quiz.questions[0].id,round:null});
  const state=await runtime.quizState(session.id,parent,enrollment.student.id);
  assert.equal(state.question.id,quiz.questions[0].id);assert.equal(state.question.answerKey,undefined);
  const input={studentId:enrollment.student.id,questionId:state.questionId,round:state.round,answer:'A'};
  assert.equal(await tx.quizLiveResponse.count({where:{sessionId:session.id}}),0);
  // Real callbacks share this rollback-only transaction; establish the write before parallel retry reads.
  await runtime.submitQuizAnswer(session.id,parent,input,new Date());
  const results=await Promise.all(Array.from({length:6},()=>runtime.submitQuizAnswer(session.id,parent,input,new Date())));
  assert.equal(results.length,6);assert.equal(await tx.quizLiveResponse.count({where:{sessionId:session.id}}),1);
  const response=await tx.quizLiveResponse.findFirst({where:{sessionId:session.id}});
  assert.equal(await tx.housePointLedger.count({where:{sourceId:response.id}}),1);
  const before=state.round;
  await runtime.controlQuiz(session.id,host,{action:'reopen',questionId:state.questionId,round:before});
  assert.equal(await tx.quizLiveResponse.count({where:{sessionId:session.id}}),1);
  const reopened=await runtime.quizState(session.id,host);
  await runtime.controlQuiz(session.id,host,{action:'open',questionId:quiz.questions[1].id,round:reopened.round});
  const second=await runtime.quizState(session.id,parent,enrollment.student.id);
  await assert.rejects(()=>runtime.submitQuizAnswer(session.id,parent,{...input,questionId:second.questionId},new Date()),e=>e.status===409);
  await runtime.submitQuizAnswer(session.id,parent,{...input,questionId:second.questionId,round:second.round,answer:'B'},new Date());
  await runtime.controlQuiz(session.id,host,{action:'end'});
  await runtime.controlQuiz(session.id,host,{action:'end'});
  const finished=await runtime.quizState(session.id,parent,enrollment.student.id);
  assert.equal(finished.status,'ENDED');assert.equal(finished.responses.length,2);assert.equal(finished.bonus,10);
  assert.equal(await tx.housePointLedger.count({where:{sourceType:'QUIZ_LIVE_COMPLETE',sourceId:quiz.id}}),1);
  passed=true;throw rollback;
 },{timeout:90000,maxWait:10000}); } catch(e){if(e!==rollback)throw e;}
 assert.ok(passed);assert.equal(await db.quiz.count({where:{id:fixtureId}}),0);
 console.log('PASS: real MySQL lobby, ownership, duplicate retries, atomic points, reopen, stale round, finish bonus; all fixture writes rolled back.');
} finally {await db.$disconnect();}
