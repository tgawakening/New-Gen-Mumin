import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
function fixture(allowed=true){
 let query,weeklyLoads=0;const Review=()=>null;
 const deps={'react/jsx-runtime':jsxRuntime,'next/navigation':{redirect:href=>{throw Error('redirect:'+href);}},'@/lib/auth/session':{getCurrentSession:async()=>({user:{id:'ordinary-teacher',role:'TEACHER'}}),getDashboardHome:()=>'/teacher'},'@/lib/feedback/monthly':{canReviewMonthlyFeedback:async()=>allowed},'@/lib/feedback/monthly-questions':{feedbackMonth:()=> '2026-10',validMonth:m=>/^2026-(09|10)$/.test(m)},'@/lib/db':{db:{monthlyParentFeedback:{findMany:async input=>{query=input;return [{id:'response',month:input.where.month,submittedAt:new Date('2026-10-20'),submittedBy:{email:'parent@example.test'},details:{childName:'Learner'},answers:{}}];}}}},'@/lib/teacher/dashboard':{getTeacherDashboardData:async()=>{weeklyLoads++;throw Error('unnecessary weekly dashboard');}},'@/lib/teacher/nav':{getTeacherNavItems:()=>[]},'@/lib/community/feedback':{getTeacherFeedbackSummary:async()=>{weeklyLoads++;throw Error('unnecessary weekly data');}},'@/components/dashboard/feedback/MonthlyFeedbackReview':{MonthlyFeedbackReview:Review}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/teacher/feedback/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>deps[id]??{}});
 return {render:params=>exports.default({searchParams:Promise.resolve(params)}),query:()=>query,weeklyLoads:()=>weeklyLoads,Review};
}
function find(node,type){if(Array.isArray(node)){for(const child of node){const result=find(child,type);if(result)return result;}return null;}if(!node||typeof node!=='object')return null;if(node.type===type)return node;return find(node.props?.children,type);}
test('monthly feedback is default and shows all family responses without loading weekly roster data',async()=>{const f=fixture(),tree=await f.render({});assert.equal(tree.props.title,'Monthly Parent Feedback');assert.equal(f.query().where.month,'2026-10');assert.equal(Object.keys(f.query().where).length,1);assert.equal(f.weeklyLoads(),0);assert.equal(find(tree,f.Review).props.responses[0].details.childName,'Learner');});
test('teachers can choose an earlier month',async()=>{const f=fixture();await f.render({month:'2026-09'});assert.equal(f.query().where.month,'2026-09');});
test('inactive teachers cannot query monthly family responses',async()=>{const f=fixture(false);await assert.rejects(f.render({}),/redirect/);assert.equal(f.query(),undefined);});
