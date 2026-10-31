import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture({allowed=true,submitted=true}={}) {
 const awards=new Map(); let reviews=0,notifications=0;
 const tx={assignmentSubmission:{update:async({data})=>{reviews++;return data;}},housePointLedger:{upsert:async({create,update})=>{awards.set(create.sourceId,awards.has(create.sourceId)?update.points:create.points);}},notification:{create:async()=>{notifications++;}}};
 const db={assignmentSubmission:{findFirst:async({where})=>allowed&&where.assignment.program.teacherAssignments.some.teacher.userId==='teacher'?{id:'work',studentId:'child',submittedAt:submitted?new Date():null,status:submitted?'SUBMITTED':'DRAFT',student:{userId:'user'},assignment:{title:'Practice'}}:null},$transaction:async fn=>fn(tx)};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/teacher/homework-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='server-only'?{}:id==='@/lib/db'?{db}:id==='@/lib/teacher/recognition-roster'?{teacherRecognitionStudentIds:async()=>['child']}:{ensureStudentHouseMembership:async()=>({houseId:'house'})}});
 return {...exports,awards,reviews:()=>reviews,notifications:()=>notifications};
}
function form(points,status='REVIEWED'){const f=new FormData();for(const [k,v]of Object.entries({submissionId:'work',homeworkPoints:points,reviewStatus:status}))f.set(k,v);return f;}
test('performance award can be corrected or removed without accumulating duplicate points',async()=>{const f=fixture();for(const p of ['30','30','12','0']){await f.reviewHomework('teacher',form(p));assert.equal(f.awards.get('work'),Number(p));assert.equal(f.awards.size,1);}});
test('blank and pending reviews preserve an existing award',async()=>{const f=fixture();await f.reviewHomework('teacher',form('20'));await f.reviewHomework('teacher',form(''));await f.reviewHomework('teacher',form('40','PENDING'));assert.equal(f.awards.get('work'),20);});
test('unassigned teachers and unsubmitted work cannot be awarded',async()=>{for(const opts of [{allowed:false},{submitted:false}]){const f=fixture(opts);await assert.rejects(()=>f.reviewHomework('teacher',form('10')));assert.equal(f.reviews(),0);assert.equal(f.awards.size,0);}});
test('invalid points, grades and scores are rejected before writes',async()=>{for(const value of ['-1','501','1.5','NaN','Infinity']){const f=fixture();await assert.rejects(()=>f.reviewHomework('teacher',form(value)));assert.equal(f.reviews(),0);}for(const [key,value]of [['grade','INVALID'],['score','1.5'],['reviewStatus','INVALID']]){const f=fixture(),input=form('10');input.set(key,value);await assert.rejects(()=>f.reviewHomework('teacher',input));assert.equal(f.reviews(),0);}});
