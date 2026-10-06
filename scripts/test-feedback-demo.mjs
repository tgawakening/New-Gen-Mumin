import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('src/app/api/feedback/demo/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(role='COMMUNICATIONS',status='ACTIVE') {
 let record=null, writes=0;
 const delegate={
  create:async({data})=>{if(record)throw Error('unique');writes++;record={...data,id:'dummy',version:1,submittedAt:new Date()};return record;},
  updateMany:async({where,data})=>{if(!record||where.userId!==record.userId||where.id!==record.id||where.version!==record.version)return{count:0};writes++;record={...record,...data,version:record.version+1};return{count:1};},
  findUniqueOrThrow:async()=>record,
  deleteMany:async({where})=>{if(!record||where.userId!==record.userId||where.id!==record.id||where.version!==record.version)return{count:0};record=null;writes++;return{count:1};},
 };
 const db={user:{findUnique:async()=>({role,status})},monthlyFeedbackDemo:delegate,$transaction:async fn=>fn({monthlyFeedbackDemo:delegate})};
 const exports={};
 vm.runInNewContext(compiled,{exports,URL,require:id=>{
  if(id==='next/server')return{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
  if(id==='@/lib/auth/session')return{getCurrentSession:async()=>({user:{id:'maliha'}})};
  if(id==='@/lib/db')return{db};
  if(id==='@/lib/feedback/monthly-questions')return{validMonth:x=>x==='2026-10',validateAnswers:x=>{if(!x?.complete)throw Error('required');return x;}};
  throw Error('Unexpected dependency '+id);
 }});
 return {api:exports,writes:()=>writes};
}
const body={month:'2026-10',details:{parentName:'Maliha',childName:'Sample child',age:'9',country:'Pakistan',timezone:'Asia/Karachi'},answers:{complete:true}};
function req(method,input=body,origin='https://genmumin.com'){return{method,headers:new Headers({origin,host:'genmumin.com'}),text:async()=>JSON.stringify(input)};}
test('dummy form rejects parents, teachers and inactive communications accounts',async()=>{for(const [role,status] of [['PARENT','ACTIVE'],['TEACHER','ACTIVE'],['COMMUNICATIONS','SUSPENDED']]){const f=fixture(role,status);assert.equal((await f.api.POST(req('POST'))).status,403);assert.equal(f.writes(),0);}});
test('dummy form rejects cross-origin and incomplete submissions',async()=>{const f=fixture();assert.equal((await f.api.POST(req('POST',body,'https://other.test'))).status,403);assert.equal((await f.api.POST(req('POST',{...body,answers:{}}))).status,400);assert.equal(f.writes(),0);});
test('dummy entry is isolated, editable, unique per month and deletable with revision checks',async()=>{const f=fixture();const first=await f.api.POST(req('POST'));assert.equal(first.status,200);assert.equal(first.body.studentId,'demo');assert.equal((await f.api.POST(req('POST'))).status,400);const changed=await f.api.PATCH(req('PATCH',{...body,id:'dummy',version:1}));assert.equal(changed.body.version,2);assert.equal((await f.api.DELETE(req('DELETE',{id:'dummy',version:1}))).status,409);assert.equal((await f.api.DELETE(req('DELETE',{id:'dummy',version:2}))).status,200);assert.equal((await f.api.POST(req('POST'))).status,200);assert.equal(f.writes(),4);});
