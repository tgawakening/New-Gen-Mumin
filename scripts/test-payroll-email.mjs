import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function load(file,deps={},globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,URL,AbortSignal,console,require:id=>id in deps?deps[id]:id==='server-only'?{}:require(id),...globals});return exports;}
const calc=load('src/lib/payroll/calculation.ts');
const template=load('src/lib/payroll/email-template.ts',{'./calculation':calc,'@/lib/email/templates':load('src/lib/email/templates.ts')});
const queue=load('src/lib/payroll/email-queue.ts');
const input={teacherName:'Teacher <script>',month:'2026-09',lines:[{label:'Arabic & Tajweed',sessions:2,paidHours:'2',hourlyRate:'5.30110263',actualMinutes:110}],paidOn:'2026-09-30',showPkr:true,fxRate:'375.116',fxDate:'2026-09-14',paymentReference:'TEST-123',note:'Thank you',adjustment:'0',adjustmentReason:'',sourceNote:'',proof:{fileId:'secret-drive-file'}};
const snapshot={...input,totals:calc.calculatePayroll(input)};
function fixture({outcome={skipped:false,failed:false},claimed=true,version=2,active=true,published=true}={}) {
 const jobs=[],sent=[];let calls=0;
 const slip={id:'slip',version:9,publishedAt:published?new Date():null,publishedData:snapshot,draftData:{...snapshot,note:'PRIVATE DRAFT'},teacher:{user:{email:'teacher@example.test',status:active?'ACTIVE':'INACTIVE',role:'TEACHER'}},revisions:[{version,snapshot}]};
 const db={teacherPayslip:{findMany:async args=>{assert.equal(args.where.publishedAt.not,null);assert.equal(args.where.teacher.user.status,'ACTIVE');return published&&active?[slip]:[];},findUnique:async()=>slip},billingEmailJob:{upsert:async({where,create})=>{const old=jobs.find(j=>j.key===where.key);if(old)return old;const j={id:'job'+jobs.length,nextAttemptAt:new Date(0),attempts:0,...create};jobs.push(j);return j;},findMany:async({where})=>{assert.equal(where.kind,'TEACHER_PAYROLL');assert.equal(where.OR[0].status,'PAYROLL_PENDING');return jobs.filter(j=>j.status==='PAYROLL_PENDING'&&j.nextAttemptAt<=where.nextAttemptAt.lte);},updateMany:async({where,data})=>{if(where.OR&&!claimed)return{count:0};const job=jobs.find(j=>j.id===where.id&&(!where.lockToken||j.lockToken===where.lockToken));if(!job)return{count:0};Object.assign(job,{...data,...(data.attempts?{attempts:job.attempts+1}:{})});return{count:1};}}};
 const worker=load('src/lib/payroll/email-worker.ts',{'@/lib/db':{db},'@/lib/env':{env:{success:true,data:{APP_URL:'https://genmumin.com'}}},'@/lib/email/client':{sendTransactionalEmail:async mail=>{calls++;sent.push(mail);if(outcome instanceof Error)throw outcome;return outcome;}},'./email-queue':queue,'./email-template':template});
 return {db,jobs,sent,slip,worker,calls:()=>calls};
}
test('email includes exact published hours, sessions, rates, paid amount and private portal link',()=>{
 const {html,subject}=template.payrollEmailContent(snapshot,'https://genmumin.com');assert.match(subject,/September 2026/);for(const text of ['1 hr 50 min','2 hours','5.30110263','\u00a310.60','PKR','30 September 2026','TEST-123','View my payroll slip'])assert.ok(html.includes(text),text);assert.match(html,/https:\/\/genmumin.com\/teacher\/payroll\?month=2026-09/);assert.ok(html.includes('Teacher &lt;script&gt;'));assert.ok(!html.includes('secret-drive-file'));
});
test('existing published slips are caught up once; later drafts do not change the email version',async()=>{
 const f=fixture();await f.worker.queuePublishedPayrollEmails();await f.worker.queuePublishedPayrollEmails();assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].key,'payroll:slip:2');await f.worker.deliverPayrollEmails();assert.equal(f.calls(),1);assert.equal(f.jobs[0].status,'SENT');assert.ok(!f.sent[0].html.includes('PRIVATE DRAFT'));await f.worker.queuePublishedPayrollEmails();await f.worker.deliverPayrollEmails();assert.equal(f.calls(),1);
});
test('draft-only slips are not queued and superseded unsent revisions are cancelled',async()=>{
 const unpublished=fixture({published:false});await unpublished.worker.queuePublishedPayrollEmails();assert.equal(unpublished.jobs.length,0);const f=fixture();await queue.queuePayrollEmail(f.db,'slip',1,'teacher@example.test');await f.worker.deliverPayrollEmails();assert.equal(f.calls(),0);assert.equal(f.jobs[0].status,'CANCELLED');
});
test('inactive teachers and jobs claimed by another worker are not emailed',async()=>{
 for(const options of [{active:false},{claimed:false}]){const f=fixture(options);await queue.queuePayrollEmail(f.db,'slip',2,'teacher@example.test');await f.worker.deliverPayrollEmails();assert.equal(f.calls(),0);}
});
test('provider failures, quota deferrals and network errors remain pending for retry',async()=>{
 for(const outcome of [{skipped:true},{failed:true},new Error('Network unavailable')]){const f=fixture({outcome});await f.worker.queuePublishedPayrollEmails();const result=await f.worker.deliverPayrollEmails();assert.equal(result.sent,0);assert.equal(f.jobs[0].status,'PAYROLL_PENDING');assert.ok(f.jobs[0].nextAttemptAt>Date.now());assert.equal(f.jobs[0].sentAt,undefined);}
});
test('month-specific login returns allow payroll only, without opening arbitrary redirects',()=>{
 const {safeJoinReturn}=load('src/lib/auth/join-return.ts');assert.equal(safeJoinReturn('/teacher/payroll?month=2026-09'),'/teacher/payroll?month=2026-09');for(const path of ['//evil.test','https://evil.test','/teacher/payroll?month=2026-13','/teacher/payroll?month=2026-09&next=https://evil.test'])assert.equal(safeJoinReturn(path),null);
});
test('payroll emails reuse the configured sender and permanent delivery deduplication',async()=>{
 const logs=[];let requests=0;
 const db={emailLog:{update:async({data})=>{logs.push(data);return data;}}};
 const quota={reserveEmailSend:async input=>{assert.equal(input.durableDeduplication,true);return logs.some(l=>l.status==='SENT'&&l.payload?.deduplicationKey===input.deduplicationKey)?{kind:'already-sent'}:{kind:'reserved',id:'reservation'};}};
 const client=load('src/lib/email/client.ts',{'@/lib/email/quota':quota,'@/lib/db':{db},'@/lib/env':{env:{success:true,data:{RESEND_API_KEY:'test-key',EMAIL_FROM:'TGA Finance <finance@example.test>'}}}},{fetch:async(url,options)=>{requests++;assert.equal(JSON.parse(options.body).from,'TGA Finance <finance@example.test>');assert.equal(options.headers['Idempotency-Key'],'payroll:slip:2');return{ok:true,json:async()=>({id:'provider-id'})};}});
 const mail={toEmail:'teacher@example.test',subject:'Payroll',html:'Summary',template:'teacherPayrollPublished',deduplicationKey:'payroll:slip:2'};await client.sendTransactionalEmail(mail);await client.sendTransactionalEmail(mail);assert.equal(requests,1);
});
