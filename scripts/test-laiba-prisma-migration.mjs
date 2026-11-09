import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { fixture, migration } from './test-laiba-qabila-assignment.mjs';

const raw = process.env.LAIBA_MIGRATION_TEST_URL;
test('Prisma applies the collation-safe Laiba migration and recovers its prior failed state', { skip: !raw && 'Requires an empty local genmumin_laiba_test_ database via LAIBA_MIGRATION_TEST_URL.' }, async () => {
  const url = new URL(raw);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Only a local test database is allowed');
  assert.match(url.pathname, /^\/genmumin_laiba_test_[a-z0-9_]+$/i);
  const db = new PrismaClient({ datasources: { db: { url: raw } } });
  const f = fixture();
  fs.mkdirSync('work', { recursive: true });
  const scratch = fs.mkdtempSync(path.resolve('work/laiba-migration-recovery-'));
  try {
    assert.equal((await db.$queryRawUnsafe('SHOW TABLES')).length, 0, 'Refusing to use a non-empty database');
    f.add('laiba'); f.girls(3,1);
    for (const statement of f.schema.split('INSERT INTO House')[0].split(';').map(s=>s.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement + ' DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
    }
    for (const table of ['User','StudentProfile','ParentProfile','ParentStudent','Registration','RegistrationStudent','Enrollment','House','HouseMembership','CommunityRoom','CommunityMembership','HousePointLedger','Notification']) {
      for (const row of f.db.prepare('SELECT * FROM '+table).all()) await db.$executeRawUnsafe(`INSERT INTO \`${table}\` (${Object.keys(row).map(c=>'`'+c+'`').join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')})`, ...Object.values(row));
    }
    const name = '20261109160000_assign_laiba_girls_qabila';
    const schema = path.join(scratch,'schema.prisma');
    fs.writeFileSync(schema,'datasource db {\n provider = "mysql"\n url = env("DATABASE_URL")\n}\n');
    for (const folder of ['00000000000000_fixture_baseline',name]) fs.mkdirSync(path.join(scratch,'migrations',folder),{recursive:true});
    fs.writeFileSync(path.join(scratch,'migrations/migration_lock.toml'),'provider = "mysql"\n');
    fs.writeFileSync(path.join(scratch,'migrations/00000000000000_fixture_baseline/migration.sql'),'-- Synthetic fixture tables already exist.\n');
    const file = path.join(scratch,'migrations',name,'migration.sql');
    const run = args => spawnSync(process.execPath,[path.resolve('node_modules/prisma/build/index.js'),'migrate',...args,'--schema',schema],{env:{...process.env,DATABASE_URL:raw},encoding:'utf8'});
    assert.equal(run(['resolve','--applied','00000000000000_fixture_baseline']).status,0);
    fs.writeFileSync(file,migration.replaceAll(' COLLATE utf8mb4_unicode_ci',''));
    const failed = run(['deploy']);
    assert.notEqual(failed.status,0);
    assert.match(failed.stderr,/P3018/); assert.match(failed.stderr,/1267/);
    assert.equal(Number((await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM HouseMembership WHERE studentId='laiba'"))[0].n),0,'Failed transaction must not assign Laiba');
    fs.writeFileSync(file,migration);
    const recovered = spawnSync(process.execPath,[path.resolve('scripts/startup-migrations.mjs'),'--schema',schema],{env:{...process.env,DATABASE_URL:raw},encoding:'utf8'});
    assert.equal(recovered.status,0,recovered.stderr);
    assert.equal((await db.$queryRawUnsafe("SELECT qabilaGroup FROM HouseMembership WHERE studentId='laiba'"))[0].qabilaGroup,'Qabila Banu Zuhra');
    const records = await db.$queryRawUnsafe('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?',name);
    assert.equal(records.filter(row=>row.finished_at).length,1); assert.equal(records.filter(row=>row.rolled_back_at).length,1);
  } finally {
    f.db.close(); await db.$disconnect(); fs.rmSync(scratch,{recursive:true,force:true});
  }
});
