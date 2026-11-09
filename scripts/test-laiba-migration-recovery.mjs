import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { canRecoverLaibaMigration, LAIBA_MIGRATION } from './lib/laiba-migration-recovery.mjs';
const hashes=['c0772498f7e9fa1ac63dbd1d5bed30b5e163041f0cfe83f9945a93335d9b4c0e','39ac78b3209a7e59062c4a596215397b9cf6bc5e21f7965a6e62102ee3ae3400'];
const row={migration_name:LAIBA_MIGRATION,checksum:hashes[0],logs:null,finished_at:null,rolled_back_at:null};
test('both exact retired data-repair revisions can be resolved without rerunning their SQL',()=>{
 for(const checksum of hashes)for(const logs of [null,'1267 Illegal mix of collations','Other operational repair failure'])assert.equal(canRecoverLaibaMigration([{...row,checksum,logs}]),true);
 const repair=fs.readFileSync('scripts/sql/assign-laiba-girls-qabila.sql','utf8');
 assert.equal(createHash('sha256').update(repair).digest('hex'),hashes[1]);
 assert.equal(createHash('sha256').update(repair.replaceAll(' COLLATE utf8mb4_unicode_ci','')).digest('hex'),hashes[0]);
 for(const patch of [{migration_name:'other'},{checksum:'unknown'},{finished_at:new Date()},{rolled_back_at:new Date()}])assert.equal(canRecoverLaibaMigration([{...row,...patch}]),false);
 assert.equal(canRecoverLaibaMigration([]),false);assert.equal(canRecoverLaibaMigration([row,row]),false);
});
test('the replacement migration has no data or schema mutations',()=>{
 const sql=fs.readFileSync('prisma/migrations/'+LAIBA_MIGRATION+'/migration.sql','utf8').replace(/^--.*$/gm,'').trim();
 assert.equal(sql,'SELECT 1;');
});
