const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");
function fixture(initial = null, rejectLedger = false) {
  let state = { award: initial, ledger: [] };
  const db = { $transaction: async fn => {
    const draft = structuredClone(state);
    const result = await fn({ recognitionAward: {
      findUnique: async () => draft.award,
      upsert: async ({ create, update }) => draft.award ? Object.assign(draft.award, update) : (draft.award = { id: "award-1", isPublic: true, revokedAt: null, awardedAt: new Date(), ...create }),
    }, housePointLedger: { createMany: async ({ data }) => {
      if (rejectLedger) throw Error("database failure");
      for (const row of data) if (!draft.ledger.some(x => x.sourceId === row.sourceId && x.studentId === row.studentId)) draft.ledger.push(row);
    } } });
    state = draft;
    return result;
  } };
  const filename = path.resolve("src/lib/community/weekly-recognition-save.ts");
  const mod = new Module(filename); mod.paths = module.paths;
  mod.require = id => id === "server-only" ? {} : id === "@/lib/db" ? { db } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { save: mod.exports.saveWeeklyRecognition, state: () => state };
}
const data = { studentId: "child-1", badgeKey: "MUMIN_OF_WEEK", title: "Mumin of the Week", category: "WEEKLY_CHARACTER", description: "Weekly", evidence: "Helping others", sourceType: "WEEKLY_NOMINATION", sourceId: "teacher:week" };
test("certificate and exactly 150 points commit together", async () => { const f=fixture(); await f.save(data,"house-1"); assert.equal(f.state().award.pointsBonus,150); assert.equal(f.state().ledger[0].points,150); assert.equal(f.state().ledger[0].houseId,"house-1"); });
test("point failure rolls back the certificate", async () => { const f=fixture(null,true); await assert.rejects(f.save(data,"house-1")); assert.equal(f.state().award,null); assert.equal(f.state().ledger.length,0); });
test("retries repair a partial old save without duplicating points", async () => { const f=fixture({...data,id:"old-award",pointsBonus:150,isPublic:true,revokedAt:null,awardedAt:new Date()}); assert.equal((await f.save(data,"house-1")).existing,true); await f.save(data,"house-1"); assert.equal(f.state().ledger.length,1); assert.equal(f.state().ledger[0].sourceId,"old-award"); });
test("revoked certificates do not regain points", async () => { const f=fixture({...data,id:"revoked",isPublic:true,revokedAt:new Date()}); await f.save(data,"house-1"); assert.equal(f.state().ledger.length,0); });

test("certificate name can be set and corrected without another points award", async () => {
  const f = fixture();
  await f.save({ ...data, recipientName: "Correct Student Name" }, "house-1");
  assert.equal(f.state().award.recipientName, "Correct Student Name");
  const certificateId = f.state().award.id;
  await f.save({ ...data, recipientName: "Updated Student Name" }, "house-1");
  assert.equal(f.state().award.recipientName, "Updated Student Name");
  assert.equal(f.state().award.id, certificateId);
  assert.equal(f.state().award.studentId, data.studentId);
  assert.equal(f.state().ledger.length, 1);
  assert.equal(f.state().ledger[0].points, 150);
  await f.save(data, "house-1");
  assert.equal(f.state().award.recipientName, "Updated Student Name");
});

test("private certificates save without any Qabila credit", async () => { const f = fixture(); await f.save({ ...data, isPublic: false }, "house-1"); assert.equal(f.state().award.isPublic, false); assert.equal(f.state().ledger.length, 0); });
