import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Execute the migration's real queries. Adapt only MySQL transaction/upsert/string syntax.
const migration = fs.readFileSync('prisma/migrations/20261031160000_reconcile_saved_quiz_scores/migration.sql', 'utf8')
  .replace('START TRANSACTION;', 'BEGIN;')
  .replaceAll('ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;', 'ON CONFLICT DO NOTHING;')
  .replace("LEFT(CONCAT(q.`title`, ': saved quiz score'), 191)", "SUBSTR(CONCAT(q.`title`, ': saved quiz score'), 1, 191)");
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.function('CONCAT', (...values) => values.join(''));
  db.exec(`CREATE TABLE HousePointLedger(id TEXT PRIMARY KEY, houseId TEXT, studentId TEXT, points INTEGER, reason TEXT, sourceType TEXT, sourceId TEXT, awardedAt TEXT, UNIQUE(studentId,sourceType,sourceId));
    CREATE TABLE QuizLiveResponse(id TEXT PRIMARY KEY, studentId TEXT, earnedPoints INTEGER, housePointsAwarded INTEGER, answeredAt TEXT);
    CREATE TABLE HouseMembership(studentId TEXT, houseId TEXT);
    CREATE TABLE Quiz(id TEXT, title TEXT);
    CREATE TABLE QuizAttempt(id TEXT, quizId TEXT, studentId TEXT, submittedAt TEXT, autoScore INTEGER, manualScore INTEGER);
    INSERT INTO HouseMembership VALUES('child','house');
    INSERT INTO Quiz VALUES('quiz','Life Skills First Aid');
    INSERT INTO QuizLiveResponse VALUES('legacy','child',10,1,'2026-10-29'),('missing','child',20,1,'2026-10-29'),('manual','child',10,1,'2026-10-29'),('wrong','child',0,1,'2026-10-29'),('invalid','child',-10,1,'2026-10-29'),('unassigned','other',10,1,'2026-10-29');
    INSERT INTO HousePointLedger VALUES('old','house','child',1,'old credit','QUIZ_LIVE_ANSWER','legacy','2026-10-29'),('manual-credit','house','child',7,'teacher adjustment','QUIZ_LIVE_ANSWER','manual','2026-10-29'),('wrong-credit','house','child',1,'old credit','QUIZ_LIVE_ANSWER','wrong','2026-10-29'),('invalid-credit','house','child',1,'invalid score','QUIZ_LIVE_ANSWER','invalid','2026-10-29'),('attendance','house','child',90,'attendance','ATTENDANCE_ON_TIME','class','2026-10-29'),('bonus','house','child',10,'bonus','QUIZ_LIVE_COMPLETE','quiz','2026-10-29'),('ordinary-bonus','house','child',35,'existing score and bonus','QUIZ','existing','2026-10-29');
    INSERT INTO QuizAttempt VALUES('existing','quiz','child','2026-10-29',30,30),('ordinary','quiz','child','2026-10-29',20,20),('zero','quiz','child','2026-10-29',0,0),('unfinished','quiz','child',NULL,20,NULL),('manual-override','quiz','child','2026-10-29',20,0);`);
  return db;
}
test('historical credits become actual saved scores while missing credits are restored', () => {
  const db = fixture(); try {
    db.exec(migration);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE id='old'").get().points, 10);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE sourceId='missing'").get().points, 20);
    assert.equal(db.prepare("SELECT housePointsAwarded FROM QuizLiveResponse WHERE id='legacy'").get().housePointsAwarded, 10);
    assert.equal(db.prepare("SELECT housePointsAwarded FROM QuizLiveResponse WHERE id='missing'").get().housePointsAwarded, 20);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE sourceId='ordinary'").get().points, 20);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE sourceId='wrong'").get().points, 0);
  } finally { db.close(); }
});
test('manual overrides, bonuses, unrelated activities and unverified scores are preserved', () => {
  const db = fixture(); try {
    db.exec(migration);
    for (const [id, expected] of [['manual-credit', 7], ['attendance', 90], ['bonus', 10], ['ordinary-bonus', 35], ['invalid-credit', 1]]) assert.equal(db.prepare('SELECT points FROM HousePointLedger WHERE id=?').get(id).points, expected);
    for (const id of ['unassigned', 'unfinished', 'manual-override', 'zero']) assert.equal(db.prepare('SELECT COUNT(*) n FROM HousePointLedger WHERE sourceId=?').get(id).n, 0);
    assert.equal(db.prepare("SELECT housePointsAwarded FROM QuizLiveResponse WHERE id='manual'").get().housePointsAwarded, 1);
  } finally { db.close(); }
});
test('repair is idempotent and retains the original activity dates', () => {
  const db = fixture(); try {
    db.exec(migration);
    const before = JSON.stringify(db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all());
    db.exec(migration);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all()), before);
    assert.equal(db.prepare("SELECT awardedAt FROM HousePointLedger WHERE sourceId='missing'").get().awardedAt, '2026-10-29');
  } finally { db.close(); }
});
