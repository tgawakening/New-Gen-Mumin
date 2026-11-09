import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { canRecoverLaibaMigration, LAIBA_MIGRATION } from './lib/laiba-migration-recovery.mjs';
const row = {
  migration_name: LAIBA_MIGRATION,
  checksum: 'c0772498f7e9fa1ac63dbd1d5bed30b5e163041f0cfe83f9945a93335d9b4c0e',
  logs: "Database error code: 1267\nIllegal mix of collations\nPlease check the query number 13 from the migration file.", finished_at: null, rolled_back_at: null,
};
test('recovery recognizes only the exact shipped script and known pre-commit collation failure',()=>{
 assert.equal(canRecoverLaibaMigration([row]),true);
 assert.equal(canRecoverLaibaMigration([{...row,logs:null}]),true);
 assert.equal(canRecoverLaibaMigration([{...row,logs:null,checksum:'unknown'}]),false);
 const original=fs.readFileSync('prisma/migrations/'+LAIBA_MIGRATION+'/migration.sql','utf8').replaceAll(' COLLATE utf8mb4_unicode_ci','');
 assert.equal(createHash('sha256').update(original).digest('hex'),row.checksum);
 for(const patch of [{migration_name:'other'},{checksum:'different-script'},{logs:'Database connection failed'},{logs:'1267 Illegal mix of collations; query number 99'},{finished_at:new Date()},{rolled_back_at:new Date()}])assert.equal(canRecoverLaibaMigration([{...row,...patch}]),false);
 assert.equal(canRecoverLaibaMigration([]),false);assert.equal(canRecoverLaibaMigration([row,row]),false);
});
