import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,console,Intl,URL,require:id=>id==='server-only'?{}:id.startsWith('node:')?require(id):deps[id],...globals});return exports;}
const schedules=load('src/lib/payments/manual-billing-schedule.ts');
const policy=load('src/lib/payments/billing-policy.ts');
const pk={childName:'Learner',currency:'PKR',student:{countryCode:'PK'},parent:{user:{firstName:'Parent',lastName:'Family',email:'parent@example.test'}}};
const start=new Date('2026-11-03T00:00:00Z');
test('Pakistan dues recur on 20th with 18th reminders; named parent exceptions cover every child',()=>{
 for(const month of ['2026-11','2026-12','2027-01']){const d=schedules.manualBillingDates(pk,new Date(month+'-03T00:00:00Z'));assert.equal(d.dueDate.toISOString(),month+'-20T18:59:59.999Z');assert.equal(d.reminderDate.toISOString(),month+'-18T04:00:00.000Z');}
 for(const name of ['Anum Sheikh','Anum Shaikh','Parisa Noor','Prisa Noor','Mussab Ashfaq'])for(const childName of ['First child','Second child']){
  const d=schedules.manualBillingDates({...pk,childName,parent:{user:{firstName:name,lastName:''}}},start);assert.equal(d.dueDay,10);assert.equal(d.reminderDay,8);
 }
 assert.equal(schedules.manualBillingDates({...pk,parent:{user:{email:'Parisa.Noor041082@gmail.com'}}},start).dueDay,10);
 assert.equal(schedules.manualBillingDates({...pk,childName:"Mohammad Mus'ab Ashfaq"},start).dueDay,10);
 const yasher=schedules.manualBillingDates({...pk,currency:'GBP',student:{countryCode:'GB'},childName:'Yasher Muhammad Shahbaz'},start);assert.equal(yasher.dueDay,20);assert.equal(yasher.reminderDay,18);
});
test('non-Pakistani accounts and historical October dates retain their existing policy',()=>{
 assert.equal(schedules.manualBillingDates({currency:'PKR',student:{countryCode:'GB'}},start),null);
 assert.equal(schedules.manualBillingDates({currency:'GBP',student:{countryCode:'GB'}},start),null);
 assert.ok(schedules.manualBillingDates({currency:'PKR'},start));
 assert.equal(schedules.manualBillingDates(pk,new Date('2026-10-03')),null);
 assert.equal(schedules.manualBillingDates({...pk,parent:{user:{firstName:'Anum',lastName:'Other'}}},start).dueDay,20);
});
test('reminders do not send early or mark a due-day payment overdue, and deadlines stay inside the coverage cycle',()=>{
 const d=schedules.manualBillingDates(pk,start);
 assert.equal(schedules.scheduledManualStage(d,new Date('2026-11-18T03:59:59Z')),null);
 assert.match(schedules.scheduledManualStage(d,new Date('2026-11-18T04:00:00Z')),/:reminder$/);
 assert.match(schedules.scheduledManualStage(d,new Date('2026-11-20T18:59:59Z')),/:reminder$/);
 assert.match(schedules.scheduledManualStage(d,new Date('2026-11-20T19:00:00Z')),/:overdue0$/);
 assert.equal(schedules.manualBillingDates(pk,new Date('2026-11-25')).dueDate.toISOString(),'2026-12-20T18:59:59.999Z');
});
test('reconciliation changes only dates/metadata on unpaid manual records, retaining custom metadata and tolerating JSON key order',async()=>{
 const row={...pk,id:'record',method:'MANUAL',status:'PENDING',billingPeriodStart:start,billingPeriodEnd:new Date('2026-12-03'),dueDate:new Date('2026-11-08'),amount:9000,metadata:{financeNote:'Retain'}};
 let updates=0;
 const db={monthlyPaymentRecord:{findMany:async({where})=>{assert.equal(where.method,'MANUAL');assert.deepEqual(Array.from(where.status.in),['PENDING','FAILED']);return[row];},updateMany:async({where,data})=>{assert.equal(where.status,'PENDING');assert.equal('amount' in data,false);updates++;Object.assign(row,data);return{count:1};}}};
 const cycle=load('src/lib/payments/billing-cycle.ts',{'@prisma/client':{},'@/lib/db':{db},'@/lib/payments/manual-billing-schedule':schedules});
 assert.equal(await cycle.reconcileManualBillingDates(),1);assert.equal(row.amount,9000);assert.equal(row.metadata.financeNote,'Retain');assert.equal(row.dueDate.toISOString(),'2026-11-20T18:59:59.999Z');
 row.metadata.manualBillingSchedule=Object.fromEntries(Object.entries(row.metadata.manualBillingSchedule).reverse());
 assert.equal(await cycle.reconcileManualBillingDates(),0);assert.equal(updates,1);
});
test('fixed-date reminder queue cancels obsolete early messages and queues one date-scoped reminder on the approved day',async()=>{
 const row={...pk,id:'r',method:'MANUAL',status:'PENDING',billingPeriodStart:start,billingPeriodEnd:new Date('2026-12-03'),billingKey:'cycle:r'};
 const jobs=new Map([['old',{key:'old',status:'PENDING'}]]);
 const db={monthlyPaymentRecord:{findMany:async()=>[row]},billingEmailJob:{updateMany:async({where})=>{for(const job of jobs.values())if(job.status==='PENDING'&&job.key!==where.key?.not)job.status='CANCELLED';return{count:1};},upsert:async({where,create})=>{if(!jobs.has(where.key))jobs.set(where.key,{status:'PENDING',...create});return jobs.get(where.key);}}};
 const cycle=load('src/lib/payments/billing-cycle.ts',{'@prisma/client':{},'@/lib/db':{db},'@/lib/payments/manual-billing-schedule':schedules,'@/lib/payments/billing-policy':policy});
 assert.equal((await cycle.queueManualReminders(new Date('2026-11-10'))).reminded,0);assert.equal(jobs.get('old').status,'CANCELLED');
 await cycle.queueManualReminders(new Date('2026-11-18T04:00:00Z'));await cycle.queueManualReminders(new Date('2026-11-19'));
 assert.equal([...jobs.values()].filter(job=>job.status==='PENDING').length,1);
});
test('delivery rechecks the new schedule and cancels an old immediate reminder before contacting the email provider',async()=>{
 const now=new Date('2026-11-03T12:00:00Z');class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
 let sent=0,cancelled=false;
 const db={billingEmailJob:{findMany:async()=>[{id:'j',kind:'MANUAL',recordId:'r',attempts:0,payload:{stage:'initial'}}],updateMany:async({data})=>{if(data.status==='CANCELLED')cancelled=true;return{count:1};}},monthlyPaymentRecord:{findUnique:async()=>({...pk,id:'r',method:'MANUAL',status:'PENDING',billingKey:'b',billingPeriodStart:start,billingPeriodEnd:new Date('2026-12-03'),dueDate:new Date('2026-11-08')} )}};
 const mail=load('src/lib/payments/billing-mail.ts',{'@prisma/client':{},'@/lib/db':{db},'@/lib/payments/manual-billing-schedule':schedules,'@/lib/payments/billing-policy':policy,'@/lib/email/notifications':{sendMonthlyPaymentPendingEmail:async()=>{sent++;}}},{Date:FixedDate});
 await mail.deliverBillingEmails();assert.equal(sent,0);assert.equal(cancelled,true);
});

test('billing worker starts with an app-specific database URL even when the homework worker is disabled',async()=>{
 for(const build of [false,true]){
  let started=0;
  const instrumentation=load('src/instrumentation.ts',{'@/lib/payments/billing-worker':{startBillingWorker(){started++;}}},{process:{env:{NEXT_RUNTIME:'nodejs',NODE_ENV:'production',NEXT_PHASE:build?'phase-production-build':'',APP_DATABASE_URL:'configured-test-url',HOMEWORK_NOTIFICATION_WORKER_ENABLED:'false'}}});
  await instrumentation.register();assert.equal(started,build?0:1);
 }
});
