import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function compile(file,deps,globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id in deps?deps[id]:require(id),FormData,...globals});return exports;}
const calc=compile('src/lib/payroll/calculation.ts',{});
function harness({paidOn='',confirmed=true,hold=false}={}) {
 const input={lines:[{label:'Arabic',sessions:2,paidHours:'2',hourlyRate:'5',actualMinutes:110}],showPkr:false,fxRate:'',fxDate:'',paidOn,paymentReference:'',note:'',sourceNote:'',adjustment:'0',adjustmentReason:''};
 const states=[],refs=[],requests=[];let cursor=0,refCursor=0,focused=false,release;
 const React={useState(initial){const i=cursor++;if(!(i in states))states[i]=i===6?confirmed:initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=refCursor++;if(!(i in refs))refs[i]={current:i===1?{focus(){focused=true;}}:initial};return refs[i];}};
 const {PayrollEditor}=compile('src/components/payroll/PayrollEditor.tsx',{react:React,'@/lib/payroll/calculation':calc,'./PayslipCard':{PayslipCard:()=>null}},{fetch:async(url,options)=>{requests.push({url,form:options.body});if(hold)await new Promise(resolve=>{release=resolve;});return{ok:true,json:async()=>({id:'slip',version:1,snapshot:input,published:options.body.get('mode')==='publish'})};}});
 const render=()=>{cursor=0;refCursor=0;return PayrollEditor({teacherId:'teacher',teacherName:'Teacher',month:'2026-09',initial:input,initialVersion:0,initialFolder:'',portalMinutes:110,publishedAt:null,templates:[]});};
 function nodes(node,result=[]){if(!node||typeof node!=='object')return result;if(Array.isArray(node)){node.forEach(n=>nodes(n,result));return result;}result.push(node);nodes(node.props?.children,result);return result;}
 const button=label=>nodes(render()).find(n=>n.type==='button'&&n.props.children===label);
 return {render,nodes,button,requests,states,get focused(){return focused;},release:()=>release()};
}
test('checked confirmation with missing date explains the requirement instead of disabling publish',async()=>{
 const h=harness();const button=h.button('Publish paid payslip');assert.equal(button.props.disabled,false);await button.props.onClick();assert.equal(h.requests.length,0);assert.match(h.states[5],/actual payment date/);assert.equal(h.focused,true);
});
test('payment date and confirmation publish directly without a preliminary draft',async()=>{
 const h=harness({paidOn:'2026-09-30'});await h.button('Publish paid payslip').props.onClick();assert.equal(h.requests.length,1);assert.equal(h.requests[0].form.get('mode'),'publish');assert.equal(h.requests[0].form.get('paidConfirmed'),'yes');assert.equal(JSON.parse(h.requests[0].form.get('payload')).paidOn,'2026-09-30');assert.match(h.states[5],/now visible/);
});
test('unchecked payment confirmation gives actionable feedback and does not publish',async()=>{
 const h=harness({paidOn:'2026-09-30',confirmed:false});await h.button('Publish paid payslip').props.onClick();assert.equal(h.requests.length,0);assert.match(h.states[5],/Tick the confirmation/);
});
test('incomplete payment date still permits a private draft',async()=>{
 const h=harness({confirmed:false});await h.button('Save draft').props.onClick();assert.equal(h.requests[0].form.get('mode'),'save');assert.match(h.states[5],/Draft saved/);
});
test('rapid repeated publish clicks submit only once and disable both actions while saving',async()=>{
 const h=harness({paidOn:'2026-09-30',hold:true});const click=h.button('Publish paid payslip').props.onClick;const first=click();await click();assert.equal(h.requests.length,1);assert.equal(h.button('Please wait...').props.disabled,true);assert.equal(h.button('Saving...').props.disabled,true);h.release();await first;
});
