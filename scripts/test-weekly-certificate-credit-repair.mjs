import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('published weekly certificates recover 150 points once, retaining dates and the Mum beneficiary', () => {
  const db = new DatabaseSync(':memory:');
  db.function('CONCAT', (...values) => values.join(''));
  try {
    db.exec(`CREATE TABLE HousePointLedger(id TEXT PRIMARY KEY, houseId TEXT, studentId TEXT, points INT, reason TEXT, sourceType TEXT, sourceId TEXT, awardedAt TEXT, UNIQUE(studentId,sourceType,sourceId));
      CREATE TABLE HouseMembership(studentId TEXT, houseId TEXT, qabilaGroup TEXT);
      CREATE TABLE ParentStudent(parentId TEXT, studentId TEXT);
      CREATE TABLE RecognitionAward(id TEXT, studentId TEXT, badgeKey TEXT, isPublic INT, revokedAt TEXT, awardedAt TEXT);
      CREATE TABLE ParentRecognitionAward(id TEXT, parentId TEXT, pointsStudentId TEXT, badgeKey TEXT, isPublic INT, revokedAt TEXT, awardedAt TEXT);
      INSERT INTO HouseMembership VALUES('child','house','Qabila Banu Asad'),('sibling','other-house','Qabila Banu Hashim');
      INSERT INTO ParentStudent VALUES('mum','child'),('mum','sibling');
      INSERT INTO RecognitionAward VALUES('mumin','child','MUMIN_OF_WEEK',1,NULL,'2026-10-29'),('private','child','MUMIN_OF_WEEK',0,NULL,'2026-10-29'),('revoked','child','MUMIN_OF_WEEK',1,'2026-10-30','2026-10-29'),('badge','child','HELPER',1,NULL,'2026-10-29'),('unassigned','missing','MUMIN_OF_WEEK',1,NULL,'2026-10-29');
      INSERT INTO ParentRecognitionAward VALUES('mum-award','mum',NULL,'MUM_OF_WEEK',1,NULL,'2026-10-29'),('chosen','mum','sibling','MUM_OF_WEEK',1,NULL,'2026-10-29'),('mum-private','mum',NULL,'MUM_OF_WEEK',0,NULL,'2026-10-29'),('mum-badge','mum',NULL,'NURTURING_MUM',1,NULL,'2026-10-29');`);
    const sql = fs.readFileSync('prisma/migrations/20261102100000_restore_weekly_certificate_credits/migration.sql','utf8')
      .replace('START TRANSACTION;', 'BEGIN;').replaceAll('ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;', 'ON CONFLICT DO NOTHING;');
    db.exec(sql);
    const credits = db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all();
    assert.equal(credits.length, 3);
    assert.equal(credits.reduce((sum,row) => sum + row.points,0),450);
    assert.ok(credits.every(row => row.awardedAt === '2026-10-29'));
    assert.equal(db.prepare("SELECT studentId FROM HousePointLedger WHERE sourceId='chosen'").get().studentId,'sibling');
    assert.equal(db.prepare("SELECT pointsStudentId FROM ParentRecognitionAward WHERE id='mum-award'").get().pointsStudentId,'child');
    db.exec(sql);
    assert.deepEqual(db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all(),credits);
  } finally { db.close(); }
});
