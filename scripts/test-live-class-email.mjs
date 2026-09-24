import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 const logs=[];let sent=0;let fail=false;const exports={};
 const db={emailLog:{count:async()=>0,findFirst:async({where})=>logs.find(r=>r.status===where.status&&r.toEmail===where.toEmail&&r.template===where.template&&(where.payload?r.payload?.deduplicationKey===where.payload.equals:r.subject===where.subject))??null,create:async({data})=>{logs.push(data);return data;}}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/email/client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='@/lib/db'?{db}:{env:{success:true,data:{RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com'}}},Date,console,fetch:async()=>{sent++;return {ok:!fail,json:async()=>fail?{message:'temporary failure'}:{id:'provider-id'}};}});
 return {send:key=>exports.sendTransactionalEmail({toEmail:'parent@example.com',subject:'Zoom class has started',html:'test',template:'liveClassStarted',deduplicationKey:key}),logs,count:()=>sent,setFail:v=>{fail=v;}};
}
test('different classes and siblings receive separate emails; repeated same class and learner is suppressed',async()=>{
 const h=harness();await h.send('class-a:child-a');await h.send('class-b:child-a');await h.send('class-a:child-b');await h.send('class-a:child-a');assert.equal(h.count(),3);assert.equal(h.logs[3].status,'SKIPPED');
});
test('failed attempts do not prevent retrying a class notification',async()=>{
 const h=harness();h.setFail(true);await h.send('class-a:child-a');h.setFail(false);await h.send('class-a:child-a');assert.equal(h.count(),2);assert.equal(h.logs[1].status,'SENT');
});
