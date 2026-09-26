import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function client(fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/live-classes/attendance-preview-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,URLSearchParams,AbortSignal});return exports.requestAttendancePreview;}
test('preview retries a temporary outage and returns successful data',async()=>{let calls=0;const request=client(async()=>++calls===1?{status:502}:{status:200,ok:true,json:async()=>({data:{sessions:[],fingerprint:'abc'}})});assert.equal((await request('student','2026-08-01','2026-09-26')).data.fingerprint,'abc');assert.equal(calls,2);});
test('expired admin session is explained without repeated requests',async()=>{let calls=0;const request=client(async()=>{calls++;return {status:401,ok:false,json:async()=>({error:'Sign in again'})};});assert.equal((await request('student','a','b')).error,'Sign in again');assert.equal(calls,1);});
test('network failures stop after two attempts and leave attendance unchanged',async()=>{let calls=0;const request=client(async()=>{calls++;throw Error('network');});const result=await request('student','a','b');assert.equal(result.data,null);assert.match(result.error,/attendance has not changed/);assert.equal(calls,2);});
