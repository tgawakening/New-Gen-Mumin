import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Run this inside the Gen-Mumin app environment.');
const db = new PrismaClient();
const name = '20261028120000_durable_zoom_attendance';
const sql = fs.readFileSync(new URL('../prisma/migrations/' + name + '/migration.sql', import.meta.url), 'utf8');
try {
  const applied = await db.$queryRawUnsafe('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ?', name);
  if (applied.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('An unfinished migration record exists. Resolve it before running this helper.');
  if (applied.some(row => row.finished_at && !row.rolled_back_at)) console.log('Durable Zoom attendance migration is already applied.');
  else if (!process.argv.includes('--apply')) console.log('Read-only preflight: migration pending. Run with --apply before deploying the new code.');
  else {
    const definitions = {
      parentId: 'VARCHAR(191) NULL', evidenceSource: "VARCHAR(191) NOT NULL DEFAULT 'legacy'",
      sessionStartedAt: 'DATETIME(3) NULL', sessionEndedAt: 'DATETIME(3) NULL',
    };
    const columns = await db.$queryRawUnsafe("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ZoomAttendanceInterval'");
    for (const [column, definition] of Object.entries(definitions)) if (!columns.some(row => row.COLUMN_NAME === column)) await db.$executeRawUnsafe('ALTER TABLE `ZoomAttendanceInterval` ADD COLUMN `' + column + '` ' + definition);
    await db.$executeRawUnsafe("ALTER TABLE `ZoomAttendanceInterval` ALTER COLUMN `evidenceSource` SET DEFAULT 'webhook'");
    const indexes = await db.$queryRawUnsafe("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ZoomAttendanceInterval'");
    for (const column of ['parentId', 'meetingUuid']) {
      const index = 'ZoomAttendanceInterval_' + column + '_joinedAt_idx';
      if (!indexes.some(row => row.INDEX_NAME === index)) await db.$executeRawUnsafe('CREATE INDEX `' + index + '` ON `ZoomAttendanceInterval` (`' + column + '`, `joinedAt`)');
    }
    const table = await db.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ZoomAttendanceWork'");
    if (!table.length) await db.$executeRawUnsafe(sql.slice(sql.indexOf('CREATE TABLE')).trim().replace(/;\s*$/, ''));
    await db.$queryRawUnsafe('SELECT eventKey, kind, status, meetingId, meetingUuid, payload, attempts, availableAt, lockedAt, lockToken, lastError FROM ZoomAttendanceWork LIMIT 0');
    await db.$executeRawUnsafe('INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, NOW(3), ?, NULL, NULL, NOW(3), 3)', randomUUID(), createHash('sha256').update(sql).digest('hex'), name);
    console.log('Durable Zoom attendance storage applied and migration recorded.');
  }
} finally { await db.$disconnect(); }
