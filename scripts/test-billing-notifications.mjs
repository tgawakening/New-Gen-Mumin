import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, URL, Intl, Set, Map, console, process, AbortSignal, require(name) { if (name in mocks) return mocks[name]; if (name === "server-only") return {}; if (name.startsWith("node:")) return require(name); throw new Error("Unexpected dependency: " + name); } });
  return exports;
}
const policy = load("src/lib/payments/billing-policy.ts");
test("anniversary on the 31st uses actual month end, then returns to 31st", () => {
  const anchor = new Date("2026-01-31T00:00:00Z");
  const period = policy.recurringPeriod(anchor, new Date("2026-02-28T12:00:00Z"));
  assert.equal(period.start.toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-03-31T00:00:00.000Z");
  assert.equal(period.due.toISOString(), "2026-03-05T00:00:00.000Z");
});
test("reminders have a five-day deadline and limited weekly follow-ups", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  for (const [day, expected] of [[0,"initial"],[2,"initial"],[3,"day3"],[5,"overdue0"],[11,"overdue0"],[12,"overdue1"]]) assert.equal(policy.reminderStage(start, new Date(+start + day * policy.DAY)), expected);
});
test("currency allocation preserves every cent including zero", () => {
  assert.equal(policy.allocateAmount(20.01, [1, 1, 1]).reduce((a,b)=>a+Math.round(b*100),0), 2001);
  assert.deepEqual(Array.from(policy.allocateAmount(0, [1,2])), [0,0]);
  assert.deepEqual(Array.from(policy.allocateAmount(0.01, [1,1])), [0,0.01]);
});
test("Stripe invoices support current and legacy subscription fields", () => {
  assert.equal(policy.stripeSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(policy.stripeSubscriptionId({ subscription: { id: "sub_old" } }), "sub_old");
  assert.equal(policy.stripeSubscriptionId({}), null);
});
test("receipt buttons reject arbitrary and insecure destinations", () => {
  assert.equal(policy.trustedReceiptUrl("https://invoice.stripe.com/i/test"), "https://invoice.stripe.com/i/test");
  for (const url of ["javascript:alert(1)","http://invoice.stripe.com/i/test","https://invoice.stripe.com.evil.test/"]) assert.equal(policy.trustedReceiptUrl(url), null);
});
const charity = load("src/lib/payments/charity-policy.ts");
test("latest bundle is billed once without enrolment FK; older duplicates are skipped", async () => {
  const student = { id:"s",displayName:"Learner", user:{firstName:"Learner",lastName:"Test"}, enrollments:[{programId:"p1",status:"ACTIVE"},{programId:"p2",status:"ACTIVE"}] };
  const item = id => ({id,description:"Bundle",totalAmount:20,order:{id:"o",totalAmount:20,metadata:null,items:[{id,totalAmount:20,subscription:null}]},offer:{slug:"full-bundle",title:"Bundle",programs:[{programId:"p1"},{programId:"p2"}]},registrationItem:{registrationStudent:{studentProfile:student}},enrollment:null});
  const targets = load("src/lib/payments/billing-targets.ts", {"@/lib/db":{db:{orderItem:{findMany:async()=>[item("new"),item("old")]}}},"@/lib/payments/charity-policy":charity,"@/lib/payments/billing-policy":policy});
  const rows = await targets.getBillingTargets(); assert.equal(rows.length,1); assert.equal(rows[0].item.id,"new"); assert.equal(rows[0].amount,20); assert.equal(rows[0].programmeTitle,"Gen-Mumin - Full Programme");
});
function mailFixture(status = "PENDING", outcome = {skipped:false,failed:false}) {
  const job = {id:"j",key:"billing:manual:r:initial",kind:"MANUAL",recordId:"r",payload:{stage:"initial"},attempts:0};
  const record = {id:"r",method:"MANUAL",status,billingKey:"b",billingPeriodEnd:new Date(Date.now()+policy.DAY),billingPeriodStart:new Date(),dueDate:new Date(Date.now()+5*policy.DAY),amount:20,currency:"GBP",childName:"Child",programmeTitle:"Gen-Mumin",parent:{user:{email:"parent@example.test",firstName:"Parent",lastName:null}}};
  const changes=[]; let calls=0;
  const db={billingEmailJob:{findMany:async()=>[job],updateMany:async args=>{changes.push(args.data);return {count:1}}},monthlyPaymentRecord:{findUnique:async()=>record,updateMany:async()=>({count:1})}};
  const mod=load("src/lib/payments/billing-mail.ts",{"@prisma/client":{},"@/lib/db":{db},"@/lib/payments/billing-policy":policy,"@/lib/email/notifications":{sendMonthlyPaymentPendingEmail:async()=>{calls++;return outcome},sendMonthlyPaymentReceiptEmail:async()=>outcome}});
  return {mod,changes,calls:()=>calls};
}
test("paid confirmations suppress an already queued reminder",async()=>{const f=mailFixture("ADMIN_ACTIVATED");await f.mod.deliverBillingEmails();assert.equal(f.calls(),0);assert.ok(f.changes.some(c=>c.status==="CANCELLED"));});
test("failed or skipped provider delivery remains retryable, never sent",async()=>{for(const result of [{skipped:true},{skipped:false,failed:true}]){const f=mailFixture("PENDING",result);await f.mod.deliverBillingEmails();assert.ok(f.changes.some(c=>c.status==="PENDING"&&c.nextAttemptAt));assert.ok(!f.changes.some(c=>c.status==="SENT"));}});
test("successful delivery marks the job sent only after provider success",async()=>{const f=mailFixture();const result=await f.mod.deliverBillingEmails();assert.equal(result.sent,1);assert.equal(f.calls(),1);assert.ok(f.changes.some(c=>c.status==="SENT"&&c.sentAt));});
test("another worker cannot deliver a job it failed to claim",async()=>{
 const db={billingEmailJob:{findMany:async()=>[{id:"j"}],updateMany:async()=>({count:0})}};
 const mod=load("src/lib/payments/billing-mail.ts",{"@prisma/client":{},"@/lib/db":{db},"@/lib/payments/billing-policy":policy,"@/lib/email/notifications":{sendMonthlyPaymentPendingEmail:async()=>{throw new Error("Must not send")}}});
 assert.equal((await mod.deliverBillingEmails()).sent,0);
});

function cycleFixture(gateway = "BANK_TRANSFER") {
 const records=new Map(),receipts=new Map();
 const order={id:"o",parentId:"parent",paidAt:new Date("2026-08-01"),createdAt:new Date("2026-08-01"),currency:"GBP",totalAmount:20,parent:{user:{email:"parent@example.test",firstName:"Parent",lastName:null}},orderNumber:"GM-test"};
 const target={programs:["p"],subscription:null,item:{id:"item",order:{...order,gateway}},student:{id:"student"},amount:20,childName:"Child",programmeTitle:"Gen-Mumin - Full Programme"};
 const db={subscription:{findUnique:async()=>({id:"sub",orderItem:{order,description:"Gen-Mumin"}})},monthlyPaymentRecord:{findMany:async()=>[],findFirst:async({where})=>[...records.values()].find(r=>r.orderItemId===where.orderItemId&&r.monthKey===where.monthKey),findUnique:async({where})=>records.get(where.billingKey),upsert:async({where,update,create})=>{const row=records.has(where.billingKey)?{...records.get(where.billingKey),...update}:{id:"record",...create};records.set(where.billingKey,row);return row;},updateMany:async()=>({count:0})}};
 db.$transaction=async callback=>callback(db);
 const mod=load("src/lib/payments/billing-cycle.ts",{"@prisma/client":{},"@/lib/db":{db},"@/lib/payments/billing-targets":{getBillingTargets:async()=>[target]},"@/lib/payments/billing-policy":policy,"@/lib/payments/billing-mail":{money:(amount,currency)=>currency+" "+amount.toFixed(2),queueBillingReceipt:async(key,payload)=>{if(!receipts.has(key))receipts.set(key,payload)}},"@/lib/payments/charity":{recordCharitySubscriptionPayment:async()=>false}});
 return {mod,records,receipts};
}
const event={providerSubscriptionId:"sub",providerInvoiceId:"invoice",gateway:"STRIPE",amount:20.99,currency:"GBP",paidAt:new Date("2026-09-01"),initialPayment:false};
test("a real renewal without enrolment FK queues one exact receipt on replay",async()=>{const f=cycleFixture();await f.mod.recordBillingEvent(event);await f.mod.recordBillingEvent(event);assert.equal(f.records.size,1);assert.equal(f.receipts.size,1);assert.equal([...f.records.values()][0].amount,20.99);assert.equal([...f.receipts.values()][0].totalLabel,"GBP 20.99");});
test("out-of-order failed notification cannot undo a paid invoice",async()=>{const f=cycleFixture();await f.mod.recordBillingEvent(event);await f.mod.recordBillingEvent(event,true);assert.equal([...f.records.values()][0].status,"PAID");assert.equal(f.receipts.size,1);});
test("initial invoice gets a receipt without double-counting the checkout order",async()=>{const f=cycleFixture();await f.mod.recordBillingEvent({...event,initialPayment:true});assert.equal(f.records.size,0);assert.equal(f.receipts.size,1);});
test("zero-value invoices do not claim that money was deducted",async()=>{const f=cycleFixture();await f.mod.recordBillingEvent({...event,amount:0});assert.equal(f.receipts.size,0);assert.equal([...f.records.values()][0].amount,0);});

test("branded receipt includes exact date, method, programme and provider invoice button",async()=>{
 let sent;const templates=load("src/lib/email/templates.ts");
 const notifications=load("src/lib/email/notifications.ts",{"@/lib/payments/config":{getManualPaymentDetails:()=>({channels:[]})},"@/lib/env":{env:{success:true,data:{APP_URL:"https://example.test"}}},"@/lib/email/client":{sendTransactionalEmail:async input=>{sent=input;return{skipped:false,failed:false}}},"@/lib/config":{SITE:{}},"@/lib/email/templates":templates});
 await notifications.sendMonthlyPaymentReceiptEmail({toEmail:"parent@example.test",parentName:"Parent",monthLabel:"September 2026",totalLabel:"GBP 20.99",gatewayLabel:"Stripe - visa card ending 4242",paidAtLabel:"29 September 2026 PKT",reference:"in_test",orderNumber:"GM-test",receiptUrl:"https://invoice.stripe.com/i/test",rows:[{childName:"Child",programmeTitle:"Gen-Mumin - Full Programme",amountLabel:"GBP 20.99"}]});
 for(const text of ["GBP 20.99","29 September 2026 PKT","visa card ending 4242","in_test","Full Programme","https://invoice.stripe.com/i/test"])assert.ok(sent.html.includes(text),text);
});
test("manual email includes actual account fields, deadline and proof WhatsApp",async()=>{
 let sent;const templates=load("src/lib/email/templates.ts");
 const notifications=load("src/lib/email/notifications.ts",{"@/lib/payments/config":{getManualPaymentDetails:()=>({channels:[{badge:"Meezan Bank",fields:[{label:"Account Number",value:"TEST-ACCOUNT"}]}]})},"@/lib/env":{env:{success:true,data:{APP_URL:"https://example.test"}}},"@/lib/email/client":{sendTransactionalEmail:async input=>{sent=input;return{skipped:false,failed:false}}},"@/lib/config":{SITE:{}},"@/lib/email/templates":templates});
 await notifications.sendMonthlyPaymentPendingEmail({toEmail:"parent@example.test",parentName:"Parent",monthLabel:"September 2026",totalLabel:"PKR 9,000",dueDateLabel:"4 October 2026",rows:[]});
 for(const text of ["TEST-ACCOUNT","4 October 2026","03181602388","https://wa.me/923181602388"])assert.ok(sent.html.includes(text),text);
 assert.ok(!sent.html.includes("details used for initial"));
});

test("manual first month is covered; next anniversary creates one pending fee on repeated runs",async()=>{
 const f=cycleFixture(); await f.mod.createBillingCycleRecords(new Date("2026-08-20")); assert.equal(f.records.size,0);
 await f.mod.createBillingCycleRecords(new Date("2026-09-01")); await f.mod.createBillingCycleRecords(new Date("2026-09-01"));
 assert.equal(f.records.size,1); const record=[...f.records.values()][0]; assert.equal(record.status,"PENDING"); assert.equal(record.amount,20); assert.equal(record.dueDate.toISOString(),"2026-09-06T00:00:00.000Z");
 record.status="ADMIN_ACTIVATED"; await f.mod.createBillingCycleRecords(new Date("2026-09-20")); assert.equal([...f.records.values()][0].status,"ADMIN_ACTIVATED");
});

test("automatic accounts never get speculative monthly pending fees",async()=>{const f=cycleFixture("STRIPE");await f.mod.createBillingCycleRecords(new Date("2026-09-20"));assert.equal(f.records.size,0);});
