import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, console, require: id => id === 'server-only' ? {} : id in deps ? deps[id] : require(id) });
  return exports;
}
const bonuses = load('src/lib/community/recognition-points.ts').BADGE_POINT_BONUSES;
function fixture() {
  let awards = [], credits = [], failLedger = false;
  const tx = { recognitionAward: {
    findUnique: async ({ where }) => awards.find(award => Object.entries(where.studentId_badgeKey_sourceType_sourceId).every(([key, value]) => award[key] === value)) ?? null,
    upsert: async ({ where, create }) => {
      let award = await tx.recognitionAward.findUnique({ where });
      if (!award) { award = { id: `award-${awards.length}`, isPublic: true, revokedAt: null, awardedAt: new Date(), ...create }; awards.push(award); }
      return award;
    },
  }, housePointLedger: { createMany: async ({ data }) => {
    if (failLedger) throw Error('ledger unavailable');
    for (const row of data) if (!credits.some(existing => existing.studentId === row.studentId && existing.sourceId === row.sourceId && existing.sourceType === row.sourceType)) credits.push(row);
  } } };
  const db = { $transaction: async fn => {
    const beforeAwards = [...awards], beforeCredits = [...credits];
    try { return await fn(tx); } catch (error) { awards = beforeAwards; credits = beforeCredits; throw error; }
  } };
  const service = load('src/lib/community/character-recognition-save.ts', { '@/lib/db': { db } });
  return { ...service, credits: () => credits, awards: () => awards, fail: () => failLedger = true, clearCredits: () => credits = [] };
}
const badge = { studentId: 'child', badgeKey: 'HELPER', title: 'Helper', category: 'SERVICE', description: 'Helpful', evidence: 'Helped classmates', sourceType: 'TEACHER_NOMINATION', sourceId: 'source', pointsBonus: 10 };
test('automatic badges have a Qabila bonus and existing teacher/weekly values are retained', () => {
  for (const key of ['RELIABLE', 'CONSISTENT', 'SEEKER']) assert.equal(bonuses[key], 10);
  assert.equal(bonuses.LEADER, 15);
  assert.equal(bonuses.MUMIN_OF_WEEK, 150);
});
test('badge points credit the recipient and their resolved house exactly once', async () => {
  const f = fixture();
  await f.saveCharacterRecognition(badge, 'recipient-house');
  await f.saveCharacterRecognition(badge, 'recipient-house');
  assert.equal(f.awards().length, 1);
  assert.equal(f.credits().length, 1);
  assert.equal(f.credits()[0].studentId, 'child');
  assert.equal(f.credits()[0].houseId, 'recipient-house');
  assert.equal(f.credits()[0].points, 10);
});
test('a failed Qabila credit rolls back the badge instead of leaving an uncredited award', async () => {
  const f = fixture(); f.fail();
  await assert.rejects(() => f.saveCharacterRecognition(badge, 'house'), /ledger unavailable/);
  assert.equal(f.awards().length, 0);
  assert.equal(f.credits().length, 0);
});
test('replaying an older positive award repairs its missing credit and preserves its original amount', async () => {
  const f = fixture();
  await f.saveCharacterRecognition({ ...badge, pointsBonus: 15 }, 'house');
  f.clearCredits();
  await f.saveCharacterRecognition(badge, 'house');
  assert.equal(f.credits().length, 1);
  assert.equal(f.credits()[0].points, 15);
});
test('revoked badges cannot regain credits on retry', async () => {
  const f = fixture();
  await f.saveCharacterRecognition({ ...badge, revokedAt: new Date() }, 'house');
  assert.equal(f.credits().length, 0);
});
test('homework uses a 10-point submission rule, separate from teacher performance credits', () => {
  const rules = load('src/lib/community/point-rules.ts', { '@/lib/live-classes/attendance-policy': { ATTENDANCE_POINTS: 10 } }).HOUSE_POINT_RULES;
  assert.equal(rules.HOMEWORK_SUBMITTED.points, 10);
  const action = fs.readFileSync('src/lib/homework/student-action.ts', 'utf8');
  assert.match(action, /points: HOUSE_POINT_RULES\.HOMEWORK_SUBMITTED\.points/);
  assert.match(action, /sourceType: "HOMEWORK_SUBMITTED",\s*sourceId: assignment\.id/);
  assert.match(fs.readFileSync('src/lib/teacher/homework-review.ts', 'utf8'), /sourceType: "HOMEWORK_PERFORMANCE"/);
});
