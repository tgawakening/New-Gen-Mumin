const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
function readModule(path, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name) => { if (name in imports) return imports[name]; throw Error(name); } });
  return exports;
}
const qabilas = readModule("src/lib/community/qabilas.ts", {});
const { planQabilaDuplicates } = readModule("src/lib/community/qabila-duplicates.ts", { "server-only": {}, "@/lib/db": { db: {} }, "@/lib/community/qabilas": qabilas });
function candidate(id, name, day, overrides = {}) {
  return { studentId: id, qabilaGroup: "Qabila Banu Hashim", role: "MEMBER", student: { displayName: name, user: { firstName: name, lastName: "" }, parents: [{ parentId: overrides.parent || "parent-1" }], registrationStudents: [{ firstName: name, lastName: "", dateOfBirth: overrides.birth ? new Date(overrides.birth) : null, registration: { parentProfileId: overrides.parent || "parent-1", parentEmail: "family@example.com", status: overrides.pending ? "PENDING_PAYMENT" : "PAID", order: { id: "order-" + id, parentId: overrides.parent || "parent-1", createdAt: new Date("2026-09-" + day + "T00:00:00Z"), status: overrides.pending ? "PENDING" : "SUCCEEDED", payments: [] } } }] } };
}
for (const names of [["Ahmad Parent", "Ahmad"], ["Khadjia", "Khadija"], ["Muntaha Parent", "Muntaha Fatima"]]) {
  const old = candidate("old", names[0], "01"); old.role = "VICE_CAPTAIN";
  const keep = candidate("keep", names[1], "05");
  const pending = candidate("pending", names[1], "10", { pending: true });
  const plans = planQabilaDuplicates([old, keep, pending]);
  assert.equal(plans.length, 1); assert.equal(plans[0].keep.studentId, "keep"); assert.equal(plans[0].remove.length, 2); assert.equal(plans[0].role, "VICE_CAPTAIN");
  old.qabilaGroup = null; old.role = "MEMBER"; pending.qabilaGroup = null;
  assert.equal(planQabilaDuplicates([old, keep, pending])[0].keep.studentId, "keep", "older records stay superseded after cleanup");
}
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01"), candidate("b", "Ahmad", "05", { parent: "other-parent" })]).length, 0);
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01"), candidate("b", "Ahmad", "01")]).length, 0, "ambiguous latest orders are left alone");
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01", { pending: true }), candidate("b", "Ahmad", "05", { pending: true })]).length, 0);
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01", { birth: "2015-01-01" }), candidate("b", "Ahmad", "05", { birth: "2017-01-01" })]).length, 0);
const differentQabila = candidate("b", "Ahmad", "05"); differentQabila.qabilaGroup = "Qabila Banu Asad";
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01"), differentQabila]).length, 0);
console.log("PASS: latest completed order, known aliases, family separation, pending orders, leadership, birth-date conflicts, tied orders, Qabila conflicts and recovery guard planning.");
