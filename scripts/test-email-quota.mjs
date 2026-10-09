import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,AbortSignal,console:{error(){}},require:id=>deps[id],...globals});return exports;}
function matches(row,where){return Object.entries(where).every(([key,value])=>{
 if(key==='OR')return value.some(w=>matches(row,w));
 if(key==='payload')return row.payload?.deduplicationKey===value.equals;
 if(value===null)return row[key]==null;
 if(typeof value==='object'){if(value.in)return value.in.includes(row[key]);if(value.gte)return row[key]!=null&&new Date(row[key])>=value.gte;}
 return row[key]===value;
});}
function fixture({sent=0,provider='ok',brokenQuota=false}={}){
 const rows=Array.from({length:sent},(_,i)=>({id:'old'+i,status:'SENT',sentAt:new Date(),createdAt:new Date(),toEmail:'old'+i+'@example.invalid',template:'old'}));let tail=Promise.resolve(),calls=0,seq=0;
 const emailLog={upsert:async({where,create,update})=>{let r=rows.find(r=>r.id===where.id);if(r)Object.assign(r,update);else rows.push(r={...create});return r;},findFirst:async({where})=>rows.find(r=>matches(r,where))||null,count:async({where})=>rows.filter(r=>matches(r,where)).length,create:async({data})=>{const r={id:'new'+seq++,createdAt:new Date(),sentAt:null,...data};rows.push(r);return r;},update:async({where,data})=>{const r=rows.find(r=>r.id===where.id);assert.ok(r);Object.assign(r,data);return r;}};
 const db={emailLog,$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'ReadCommitted');const previous=tail;let release;tail=new Promise(r=>release=r);await previous;try{if(brokenQuota)throw Error('database unavailable');return await fn({emailLog});}finally{release();}}};
 const deps={'@/lib/db':{db},'@/lib/env':{env:{success:true,data:{RESEND_API_KEY:'fake',EMAIL_FROM:'test@example.invalid'}}}};
 deps['@/lib/email/quota']=load('src/lib/email/quota.ts',deps);
 function client(){return load('src/lib/email/client.ts',deps,{fetch:async()=>{calls++;if(provider==='timeout')throw Error('timeout after possible acceptance');return{ok:provider==='ok',status:provider==='ok'?200:provider==='server-error'?500:422,json:async()=>provider==='ok'?{id:'accepted'+calls}:{message:'provider error'}};}}).sendTransactionalEmail;}
 return{rows,client,calls:()=>calls};
}
const message=(i,template='passwordReset')=>({toEmail:'test'+i+'@example.invalid',template,subject:'Subject '+i,html:'test'});
test('independent sender instances never send more than 60 during a concurrent burst',async()=>{
 const f=fixture(),clients=[f.client(),f.client(),f.client()];const results=await Promise.all(Array.from({length:100},(_,i)=>clients[i%3](message(i,['passwordReset','liveClassStarted','adminNewEnrollment'][i%3]))));assert.equal(f.calls(),60);assert.equal(f.rows.filter(r=>r.status==='SENT').length,60);assert.equal(results.filter(r=>r.skipped).length,40);
});
test('all template priorities stop at 60, including receipts and login mail',async()=>{
 const f=fixture({sent:60}),send=f.client();for(const template of ['monthlyPaymentReceipt','passwordReset','accountCreationConfirmation','liveClassStarted','adminNewEnrollment'])assert.equal((await send(message(template,template))).skipped,true);assert.equal(f.calls(),0);
});
test('only one concurrent sender can take the final slot',async()=>{
 const f=fixture({sent:59});const results=await Promise.all([f.client()(message(1)),f.client()(message(2))]);assert.equal(f.calls(),1);assert.equal(results.filter(r=>r.skipped).length,1);
});
test('capacity returns based on send time, including older logs without sentAt',async()=>{
 const f=fixture({sent:60});f.rows[0].sentAt=new Date(Date.now()-25*3600000);f.rows[0].createdAt=f.rows[0].sentAt;await f.client()(message(1));assert.equal(f.calls(),1);const g=fixture({sent:60});g.rows.forEach(r=>r.sentAt=null);assert.equal((await g.client()(message(2))).skipped,true);assert.equal(g.calls(),0);
});
test('unknown transport outcomes and provider 5xx retain their quota slots',async()=>{
 for(const provider of ['timeout','server-error']){const f=fixture({sent:59,provider});assert.equal((await f.client()(message(1))).failed,true);assert.equal(f.rows.filter(r=>r.status==='UNKNOWN').length,1);assert.equal((await f.client()(message(2))).skipped,true);assert.equal(f.calls(),1);}
});
test('confirmed rejection releases the slot and quota database failure sends nothing',async()=>{
 const f=fixture({sent:59,provider:'rejected'});await f.client()(message(1));await f.client()(message(2));assert.equal(f.calls(),2);assert.equal(f.rows.filter(r=>r.status==='FAILED').length,2);const g=fixture({brokenQuota:true});assert.equal((await g.client()(message(3))).failed,true);assert.equal(g.calls(),0);
});
test('durable notification retries do not consume a second slot',async()=>{
 const f=fixture(),send=f.client(),input={...message(1,'monthlyPaymentReceipt'),deduplicationKey:'billing:order:1'};await send(input);const result=await send(input);assert.equal(result.skipped,false);assert.equal(result.failed,false);assert.equal(f.calls(),1);
});
