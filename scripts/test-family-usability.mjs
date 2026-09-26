import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:id=>id in deps?deps[id]:require(id),console,...globals});return exports;}
const Link=({href,prefetch,...props})=>React.createElement('a',{href,...props});
const nav=load('src/lib/dashboard/family-nav.ts');
test('family navigation keeps child context and every section accessible under More',()=>{
 for(const expanded of [false,true]){
  const {MobileFamilyNavRailClient}=load('src/components/dashboard/family/MobileFamilyNavRailClient.tsx',{'react':{...React,useState:()=>[expanded,()=>{}]},'next/link':Link,'next/navigation':{usePathname:()=>'/parent/schedule'},'@/components/dashboard/family/FamilyNavLinkClient':{FamilyNavLinkClient:({href,label})=>React.createElement('a',{href},label)}});
  const items=nav.getParentNavItems('child-a');
  const html=renderToStaticMarkup(React.createElement(MobileFamilyNavRailClient,{navItems:items}));
  assert.match(html,/aria-label="Quick access"/);assert.match(html,/\/parent\/schedule\?child=child-a/);assert.match(html,/\/parent\/sunnah-tracker\?child=child-a/);
  if(expanded)for(const item of items)assert.ok(html.includes(item.href.replaceAll('&','&amp;')),item.label+' remains accessible');
 }
});
test('family frame does not await activity or notifications before rendering main content',async()=>{
 let queries=0;const empty=()=>null;
 const {FamilyDashboardFrame}=load('src/components/dashboard/family/FamilyDashboardFrame.tsx',{'next/link':Link,'@/components/dashboard/family/FamilyLogoutButton':{FamilyLogoutButton:empty},'@/components/dashboard/family/MobileFamilyNavRailClient':{MobileFamilyNavRailClient:empty},'@/components/dashboard/NotificationBell':{NotificationBell:empty},'@/lib/auth/session':{getCurrentSession:async()=>{queries++;throw Error('should stream');}},'@/lib/notifications/navigation':{getNavigationActivity:async()=>{queries++;}},'@/components/pwa/PwaInstallPrompt':{PwaInstallPrompt:empty}});
 const tree=await FamilyDashboardFrame({roleLabel:'Parent',title:'Classes',subtitle:'Join',navItems:nav.getParentNavItems(),children:'Class content'});
 assert.equal(queries,0);assert.ok(tree);
});
test('tracker mode skips leaderboard and team queries while preserving missions and points',async()=>{
 const file=fs.readFileSync('src/lib/community/quest.ts','utf8');const ast=ts.createSourceFile('quest.ts',file,ts.ScriptTarget.Latest,true);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getStudentQuestData').getText(ast);
 const exports={};let community=0;
 vm.runInNewContext(ts.transpileModule(fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,MissionStatus:{PUBLISHED:'PUBLISHED'},ensureStudentHouse:async()=>({houseId:'house'}),db:{mission:{findMany:async()=>[{id:'tracker'}]},housePointLedger:{findMany:async()=>[],groupBy:async()=>[],aggregate:async()=>({_sum:{points:15}})}},getCanonicalHouseIdsForHouseId:async()=>['house'],getHouseLeaderboard:async()=>{community++;return[];},getHouseTeamMembers:async()=>{community++;return[];},pointActivityReason:()=>''});
 const result=await exports.getStudentQuestData('student',['program'],{includeCommunity:false});assert.equal(community,0);assert.equal(result.missions[0].id,'tracker');assert.equal(result.studentTotal,15);
 await exports.getStudentQuestData('student',['program']);assert.equal(community,2);
});
test('service worker uses an offline page and never caches private navigation',async()=>{
 const handlers={};let puts=0;const matches=[];
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://genmumin.com'},addEventListener:(name,fn)=>{handlers[name]=fn;}},URL,Response,fetch:async()=>{throw Error('offline');},caches:{match:async key=>{matches.push(key);return 'offline-screen';},open:async()=>({put:()=>{puts++;}})}});
 let response;handlers.fetch({request:{url:'https://genmumin.com/parent',method:'GET',mode:'navigate'},respondWith:value=>{response=value;}});assert.equal(await response,'offline-screen');assert.deepEqual(matches,['/offline.html']);assert.equal(puts,0);
 handlers.fetch({request:{url:'https://genmumin.com/api/private',method:'GET'},respondWith:()=>{throw Error('API must stay network-only');}});
});
test('app updates offer a reload without interrupting existing work',()=>{
 const handlers={};let reloads=0,notices=0;
 const {PwaRegister}=load('src/components/pwa/PwaRegister.tsx',{'react':{...React,useState:()=>[false,value=>{if(value)notices++;}],useEffect:fn=>fn()}},{process:{env:{NODE_ENV:'production'}},window:{location:{reload:()=>{reloads++;}}},navigator:{serviceWorker:{controller:{},addEventListener:(event,fn)=>{handlers[event]=fn;},register:async()=>({update:async()=>{}})}}});
 PwaRegister();handlers.controllerchange();assert.equal(reloads,0);assert.equal(notices,1);
});

test('slow live-class refreshes do not overlap while a transition is pending',()=>{
 let tick,refreshes=0;
 const {LiveClassUpdates}=load('src/components/dashboard/family/LiveClassCountdown.tsx',{'react':{...React,useEffect:fn=>fn(),useRef:()=>({current:false}),useTransition:()=>[false,fn=>fn()],useCallback:fn=>fn},'next/link':Link,'next/navigation':{useRouter:()=>({refresh:()=>{refreshes++;}})}},{window:{setInterval:fn=>{tick=fn;return 1;},clearInterval(){}},document:{hidden:false},navigator:{onLine:true}});
 LiveClassUpdates({enabled:true});tick();tick();assert.equal(refreshes,1);
});

test('daily class, tracker and quiz shortcuts stay visible without notifications',async()=>{
 const {FamilyJourneyLinks}=load('src/components/dashboard/family/FamilyJourneyLinks.tsx',{'@/lib/auth/session':{getCurrentSession:async()=>({user:{id:'parent',role:'PARENT'}})},'@/lib/db':{db:{notification:{findMany:async()=>[]}}},'@/components/dashboard/family/ActivityShortcutLink':{ActivityShortcutLink:({href,children})=>React.createElement('a',{href},children)}});
 const html=renderToStaticMarkup(await FamilyJourneyLinks({role:'parent',childId:'child-a'}));
 for(const path of ['schedule','sunnah-tracker','quizzes'])assert.ok(html.includes('/parent/'+path+'?child=child-a'));
});
