import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { canRecoverLaibaMigration, LAIBA_MIGRATION } from './lib/laiba-migration-recovery.mjs';

const require = createRequire(import.meta.url);
const cli = require.resolve('prisma/build/index.js');
const args = process.argv.slice(2);
const run = command => {
  const result = spawnSync(process.execPath, [cli, 'migrate', ...command, ...args], { env: process.env, encoding: 'utf8' });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  return result;
};
const first = run(['deploy']);
if (first.status === 0) process.exit(0);
if (!/P3009/.test((first.stderr ?? '') + (first.stdout ?? ''))) process.exit(first.status ?? 1);
const db = new PrismaClient();
try {
  const failed = await db.$queryRawUnsafe('SELECT migration_name, checksum, logs, finished_at, rolled_back_at FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL');
  if (!canRecoverLaibaMigration(failed)) {
    console.error('Migration requires manual review; it is not the known Laiba collation failure.');
    process.exitCode = first.status ?? 1;
  } else {
    console.log('Recovering the known interrupted Laiba collation migration, then retrying the corrected script.');
    run(['resolve', '--rolled-back', LAIBA_MIGRATION]);
    // Another instance may have resolved it concurrently. Deploy still verifies
    // migration state and fails normally if recovery did not succeed.
    process.exitCode = run(['deploy']).status ?? 1;
  }
} catch {
  console.error('Could not inspect the failed migration. Check database connectivity and runtime logs.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
