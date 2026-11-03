import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { DatabaseSync } from 'node:sqlite';
function load(file,deps={},globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,console,require:id=>id==='server-only'?{}:id==='react/jsx-runtime'?jsx:deps[id],...globals});return exports;}
const calc=load('src/lib/payroll/calculation.ts');
const september=load('src/lib/payroll/september-defaults.ts');
const october=load('src/lib/payroll/october-defaults.ts',{'./september-defaults':september});
const presentation=load('src/lib/payroll/presentation.ts');
function nodes(node,result=[]) {if(Array.isArray(node)){node.forEach(n=>nodes(n,result));return result;}if(node&&typeof node==='object'){result.push(node);nodes(node.props?.children,result);}return result;}
function text(node){if(Array.isArray(node))return node.map(text).join(' ');if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return text(node.props?.children);}

test('October presets match the five independently payable spreadsheet totals, without copying broken legacy columns',()=>{
  const expected=[['abdulbadee',25,13253],['abubakar',11,5831],['afira',12,6361],['javeria',11,5831],['mehran',12,7956]];
  let total=0;
  for(const [key,hours,pence] of expected){const template=october.OCTOBER_TEMPLATES.find(item=>item.key===key);const input=october.referencePayroll('2026-10',template);const result=calc.calculatePayroll(input);assert.equal(result.paidHours,hours);assert.equal(result.totalPence,pence);assert.equal(input.paidOn,'');total+=pence;}
  assert.equal(total,39232);
  assert.equal(october.monthlyPayrollTemplate('2026-10',{firstName:'Mehran',lastName:'Raziq',email:'mehranraziq@gmail.com'}).lines[0].hourlyRate,'6.63');
});
test('Maliha has a reviewable GBP 50 fixed payment without invented teaching hours; Saba has no October preset',()=>{
  const template=october.monthlyPayrollTemplate('2026-10',{firstName:'Maliha',lastName:'',email:october.MALIHA_PAYROLL_EMAIL});
  const input=october.referencePayroll('2026-10',template), result=calc.calculatePayroll(input);
  assert.equal(result.totalPence,5000);assert.equal(result.paidHours,0);assert.equal(result.sessions,0);assert.equal(input.paidOn,'');
  assert.equal(october.monthlyPayrollTemplate('2026-10',{firstName:'Saba',lastName:'Abdissamee',email:'saba@example.test'}),undefined);
  assert.ok(october.monthlyPayrollTemplate('2026-09',{firstName:'Saba',lastName:'Abdissamee',email:'saba@example.test'}));
  assert.equal(october.payrollReference('2026-11'),null);
});
test('new slips expand for five days and a manually collapsed slip stays collapsed',()=>{
  const published='2026-11-03T10:00:00Z', at=new Date(published).getTime();
  assert.equal(presentation.payslipInitiallyOpen(published,null,at),true);
  assert.equal(presentation.payslipInitiallyOpen(published,null,at+4*86400000),true);
  assert.equal(presentation.payslipInitiallyOpen(published,null,at+5*86400000),false);
  assert.equal(presentation.payslipInitiallyOpen(published,'closed',at+86400000),false);
  assert.equal(presentation.payslipInitiallyOpen(published,'open',at+9*86400000),true);
});

test('dashboard collapse persists per recipient and published slip without treating initial expansion as a manual preference',()=>{
 const saved=new Map();
 const react={useSyncExternalStore:(_subscribe,snapshot)=>snapshot()};
 const {PayrollOverview}=load('src/components/payroll/PayrollOverview.tsx',{'react':react,'lucide-react':{ChevronDown:()=>null},'@/lib/payroll/calculation':calc,'./PayslipCard':{PayslipCard:()=>null},'./PayrollHistory':{PayrollHistory:()=>null}},{localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},window:{dispatchEvent(){}},Event:class{}});
 const props={userId:'teacher',initiallyOpen:true,slips:[{id:'october',month:'2026-10',publishedAt:'2026-11-03T10:00:00Z',snapshot:{totals:{totalPence:7956}}}]};
 let detail=nodes(PayrollOverview(props)).find(node=>node.type==='details');assert.equal(detail.props.open,true);
 detail.props.onToggle({currentTarget:{open:true}});assert.equal(saved.size,0);
 detail.props.onToggle({currentTarget:{open:false}});
 detail=nodes(PayrollOverview(props)).find(node=>node.type==='details');assert.equal(detail.props.open,false);
 assert.equal(nodes(PayrollOverview({...props,userId:'other-teacher'})).find(node=>node.type==='details').props.open,true);
 assert.equal(nodes(PayrollOverview({...props,slips:[{...props.slips[0],id:'new-month'}]})).find(node=>node.type==='details').props.open,true);
});
test('teacher slip keeps recorded time in a collapsed reference and paid hours prominent',()=>{
  const template=october.OCTOBER_TEMPLATES.find(item=>item.key==='afira'),input=october.referencePayroll('2026-10',template);
  const snapshot={...input,teacherName:'Afira',month:'2026-10',totals:calc.calculatePayroll(input),proof:{fileId:'secret-drive-file',name:'receipt.png',mimeType:'image/png',caption:'Receipt'}};
  const card=load('src/components/payroll/PayslipCard.tsx',{'@/lib/payroll/calculation':calc,'next/link':{default:()=>null}});
  const tree=card.PayslipCard({snapshot,id:'own-slip'}), teacher=text(tree);
  assert.ok(teacher.includes('Paid hours'));assert.ok(teacher.includes('£63.61'));assert.ok(!teacher.includes('Actual teaching time'));assert.ok(teacher.includes('12 hr 28 min'));assert.ok(!teacher.includes('Review all hours'));
  const reference=nodes(tree).find(node=>node.type==='details');
  assert.ok(reference);assert.ok(!reference.props.open);assert.ok(text(reference).includes('Recorded teaching time:'));assert.ok(reference.props.className.includes('text-xs'));
  assert.ok(nodes(tree).some(node=>node.props?.href==='/api/payroll/own-slip/proof'));
  assert.ok(text(card.PayslipCard({snapshot,id:'own-slip',preview:true})).includes('Actual teaching time'));
});
test('payslip history opens a popup and lets the owner choose an earlier published month',()=>{
  let state,shown=0;
  const react={useRef:()=>({current:{showModal(){shown++;}}}),useState:initial=>{if(state===undefined)state=initial;return[state,value=>state=value];}};
  const Card=()=>null;
  const {PayrollHistory}=load('src/components/payroll/PayrollHistory.tsx',{'react':react,'@/lib/payroll/calculation':calc,'./PayslipCard':{PayslipCard:Card}});
  const slips=[{id:'oct',month:'2026-10',snapshot:{totals:{totalPence:5000}}},{id:'sep',month:'2026-09',snapshot:{totals:{totalPence:4000}}}];
  let tree=PayrollHistory({slips});nodes(tree).find(node=>node.type==='button'&&node.props.children==='Payroll slip history').props.onClick();assert.equal(shown,1);
  const earlier=nodes(tree).find(node=>node.type==='button'&&text(node).includes('September 2026'));earlier.props.onClick();tree=PayrollHistory({slips});
  assert.equal(nodes(tree).find(node=>node.type===Card).props.id,'sep');
});

test('admin selects October reference automatically, preserves saved drafts, and skips teaching logs for Communications',async()=>{
  const Editor=()=>null;
  async function editorFor(user,draft=null){
    let logReads=0;
    const teacher={id:'profile',userId:'staff-user',user};
    const db={teacherProfile:{findMany:async({where})=>{assert.ok(where.OR.some(item=>item.user?.role==='COMMUNICATIONS'));return[teacher];}},teacherPayslip:{findUnique:async()=>draft?{id:'draft',version:2,draftData:draft,publishedAt:null}:null},teacherPayrollSettings:{findUnique:async()=>null}};
    const page=load('src/app/admin/payroll/page.tsx',{'next/link':{default:()=>null},'next/navigation':{redirect:()=>{throw Error('redirect');}},'@/lib/db':{db},'@/lib/payroll/service':{payrollAdmin:async()=>({id:'admin'})},'@/lib/payroll/calculation':calc,'@/lib/payroll/september-defaults':september,'@/lib/payroll/october-defaults':october,'@/lib/teacher/hours-log':{getTeacherHoursLogData:async()=>{logReads++;return{entries:Array.from({length:50},()=>({programTitle:'Arabic',durationMinutes:60})),totals:{totalMinutes:3000}};}},'@/components/payroll/PayrollEditor':{PayrollEditor:Editor}});
    const tree=await page.default({searchParams:Promise.resolve({month:'2026-10',teacherId:'profile'})});
    return{props:nodes(tree).find(node=>node.type===Editor).props,logReads};
  }
  const user={firstName:'Afira',lastName:'Tahir',email:'shoaibmufti11221122@gmail.com',role:'TEACHER'};
  const first=await editorFor(user);assert.equal(first.props.initial.lines[0].paidHours,'12');assert.equal(calc.calculatePayroll(first.props.initial).totalPence,6361);
  const edited={...first.props.initial,note:'Saved review',lines:[{...first.props.initial.lines[0],paidHours:'13'}]};
  const saved=await editorFor(user,edited);assert.equal(saved.props.initial.note,'Saved review');assert.equal(saved.props.initial.lines[0].paidHours,'13');assert.equal(saved.props.reference.lines[0].paidHours,'12');
  const staff=await editorFor({firstName:'Maliha',lastName:'',email:october.MALIHA_PAYROLL_EMAIL,role:'COMMUNICATIONS'});assert.equal(staff.logReads,0);assert.equal(calc.calculatePayroll(staff.props.initial).totalPence,5000);
});

test('Maliha payroll migration adds only an inactive finance profile and does not change her Communications role',()=>{
 const db=new DatabaseSync(':memory:');db.function('CONCAT',(...values)=>values.join(''));db.function('NOW',()=> '2026-11-03');
 try{
  db.exec(`CREATE TABLE User(id TEXT,email TEXT,role TEXT,status TEXT);CREATE TABLE TeacherProfile(id TEXT,userId TEXT UNIQUE,isActive INT,createdAt TEXT,updatedAt TEXT);
   INSERT INTO User VALUES('maliha','emancheman413@gmail.com','COMMUNICATIONS','ACTIVE'),('other','other@example.test','COMMUNICATIONS','ACTIVE');`);
  const sql=fs.readFileSync('prisma/migrations/20261103160000_maliha_payroll_recipient/migration.sql','utf8');db.exec(sql);db.exec(sql);
  const profiles=db.prepare('SELECT * FROM TeacherProfile').all();assert.equal(profiles.length,1);assert.equal(profiles[0].userId,'maliha');assert.equal(profiles[0].isActive,0);
  assert.equal(db.prepare("SELECT role FROM User WHERE id='maliha'").get().role,'COMMUNICATIONS');
 }finally{db.close();}
});
