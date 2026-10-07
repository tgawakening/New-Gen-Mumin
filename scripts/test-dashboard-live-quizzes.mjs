import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('src/lib/quizzes/live.ts','utf8');const ast=ts.createSourceFile('live.ts',source,ts.ScriptTarget.Latest,true);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='listStudentActiveLiveQuizzesByStudentId').getText(ast);
function fixture(active=true,enrolled=true){let quizReads=0;const exports={};vm.runInNewContext(ts.transpileModule(fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,protocol_1:{QUIZ_LEASE_MS:900000},QUIZ_LEASE_MS:900000,ACTIVE_ENROLLMENT_STATUSES:['ACTIVE'],db:{quizLiveSeat:{findMany:async({where})=>{assert.equal(where.studentId,'child');assert.ok(where.session.status.in.includes('WAITING'));return active?[{session:{id:'session',quizId:'quiz'}}]:[];}},quiz:{findMany:async({where})=>{quizReads++;assert.equal(where.program.enrollments.some.studentId,'child');return enrolled?[{id:'quiz'}]:[];}}}});return{list:exports.listStudentActiveLiveQuizzesByStudentId,reads:()=>quizReads};}
test('no invited live quiz skips programme lookups',async()=>{const f=fixture(false);assert.equal((await f.list('child')).length,0);assert.equal(f.reads(),0);});
test('dashboard list requires invitation and active programme enrolment',async()=>{assert.equal((await fixture().list('child')).length,1);assert.equal((await fixture(true,false).list('child')).length,0);});
