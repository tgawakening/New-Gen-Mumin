import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
function load(path, dependencies = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(name==='server-only')return {};if(!(name in dependencies))throw Error(name);return dependencies[name];},console}); return exports; }
const helper=load('src/lib/community/qabila-contributions.ts');
const qabilas=load('src/lib/community/qabilas.ts');
const prayers=(studentId,day)=>[['fajr',25],['dhuhr',15],['asr',15],['maghrib',15],['isha',25]].map(([key,points])=>({studentId,points,sourceId:day+':'+key,sourceType:'FARDH_PRAYER',reason:key,awardedAt:new Date()}));
test('a single recent 15-point prayer displays all five prayers for its student and date',()=>{
 const entries=[...prayers('a','2026-10-20'),...prayers('a','2026-10-19'),...prayers('b','2026-10-20')];
 const summary=helper.summarizePrayerContributions([entries[1]],entries)[0];
 assert.equal(summary.points,95);assert.match(summary.reason,/5\/5.*2026-10-20/);
 const corrected=helper.summarizePrayerContributions([entries[1]],entries.filter(p=>p.sourceId!=='2026-10-20:fajr'))[0];
 assert.equal(corrected.points,70);assert.match(corrected.reason,/4\/5/);
});
test('leaderboard totals include every student entry and weekly aggregate beyond recent preview limit',async()=>{
 const name=qabilas.QABILA_NAMES[0],other=qabilas.QABILA_NAMES[1];
 const memberships=[{studentId:'a',qabilaGroup:name},{studentId:'b',qabilaGroup:name},{studentId:'c',qabilaGroup:other}];
 const entries=prayers('a','2026-10-20');
 const recent=[{...entries[1],student:{displayName:'Learner A',user:{firstName:'A'},houseMembership:{qabilaGroup:name}}}];
 let aggregateQueries=0;
 const db={houseMembership:{findMany:async()=>memberships},housePointLedger:{groupBy:async input=>{aggregateQueries++;if(input.where){assert.ok(input.where.awardedAt.gte);return [{studentId:'a',_sum:{points:395}},{studentId:'b',_sum:{points:95}},{studentId:'c',_sum:{points:25}}];}return [{studentId:'a',_sum:{points:1000}},{studentId:'b',_sum:{points:200}},{studentId:'c',_sum:{points:25}}];},findMany:async input=>{if(input.where.sourceType){assert.equal(input.where.OR[0].studentId,'a');assert.equal(input.where.OR[0].sourceId.startsWith,'2026-10-20:');return entries;}return recent;}}};
 const component=load('src/components/dashboard/family/QabilaLeaderboardOverview.tsx',{'react/jsx-runtime':jsxRuntime,'next/image':{default:()=>null},'lucide-react':{Sparkles:()=>null,TrendingUp:()=>null,Trophy:()=>null,Users:()=>null},'@/lib/community/qabilas':qabilas,'@/lib/community/qabila-contributions':helper,'@/lib/db':{db}});
 const tree=await component.QabilaLeaderboardOverview({audience:'parent'});
 const elements=[];function walk(node){if(Array.isArray(node)){node.forEach(walk);return;}if(!node||typeof node!=='object')return;elements.push(node);const children=node.props?.children;for(const child of Array.isArray(children)?children:[children])walk(child);}walk(tree);
 const articles=elements.filter(e=>e.type==='article');assert.equal(articles.length,4);
 function texts(node){if(Array.isArray(node))return node.map(texts).join(' ');if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);const children=node.props?.children;return (Array.isArray(children)?children:[children]).map(texts).join(' ');}
 const first=texts(articles[0]);assert.match(first,/1200/);assert.match(first,/490/);assert.match(first,/Daily Salah: 5\/5 prayers/);assert.match(first,/\+ 95/);assert.equal(aggregateQueries,2);
});
