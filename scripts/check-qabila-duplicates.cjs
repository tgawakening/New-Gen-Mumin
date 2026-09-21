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
  return { studentId: id, qabilaGroup: "Qabila Banu Hashim", role: "MEMBER", student: { displayName: name, createdAt: new Date("2026-09-" + day + "T00:00:00Z"), enrollments: [], user: { firstName: name, lastName: "" }, parents: [{ parentId: overrides.parent || "parent-1", parent: { user: { email: (overrides.parent || "parent-1") + "@example.com", firstName: "Areej", lastName: "Irshad" } } }], registrationStudents: [{ firstName: name, lastName: "", dateOfBirth: overrides.birth ? new Date(overrides.birth) : null, registration: { parentProfileId: overrides.parent || "parent-1", parentEmail: (overrides.parent || "parent-1") + "@example.com", status: overrides.pending ? "PENDING_PAYMENT" : "PAID", order: { parent: { user: { email: (overrides.parent || "parent-1") + "@example.com", firstName: "Areej", lastName: "Irshad" } }, id: "order-" + id, parentId: overrides.parent || "parent-1", createdAt: new Date("2026-09-" + day + "T00:00:00Z"), status: overrides.pending ? "PENDING" : "SUCCEEDED", payments: [] } } }] } };
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
assert.equal(planQabilaDuplicates([candidate("a", "Muntaha", "01"), candidate("b", "Muntaha", "01")]).length, 0, "ambiguous latest orders are left alone");
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01", { pending: true }), candidate("b", "Ahmad", "05", { pending: true })]).length, 0);
assert.equal(planQabilaDuplicates([candidate("a", "Muntaha", "01", { birth: "2015-01-01" }), candidate("b", "Muntaha", "05", { birth: "2017-01-01" })]).length, 0);
const differentQabila = candidate("b", "Ahmad", "05"); differentQabila.qabilaGroup = "Qabila Banu Asad";
assert.equal(planQabilaDuplicates([candidate("a", "Ahmad", "01"), differentQabila]).length, 0);
console.log("PASS: latest completed order, known aliases, family separation, pending orders, leadership, birth-date conflicts, tied orders, Qabila conflicts and recovery guard planning.");

const legacy = candidate("legacy", "Ahmad", "01");
const current = candidate("current", "Ahmad", "10");
const currentOrder = current.student.registrationStudents[0].registration.order;
current.student.enrollments = [{ orderItems: [{ order: { ...currentOrder, registration: null } }] }];
current.student.registrationStudents = [];
assert.equal(planQabilaDuplicates([legacy, current])[0].keep.studentId, "current", "enrollment-linked completed orders count");
const emailOnly = candidate("email-only", "Khadija", "01");
emailOnly.student.parents = [];
emailOnly.student.registrationStudents[0].registration.parentProfileId = null;
emailOnly.student.registrationStudents[0].registration.order = null;
assert.equal(planQabilaDuplicates([emailOnly, candidate("current", "Khadija", "10")])[0].keep.studentId, "current", "email and parent ID identify same family");
const testA = candidate("a", "Khadija", "01", { birth: "2010-01-01" });
const testB = candidate("b", "Khadija", "10", { birth: "2018-01-01" });
assert.equal(planQabilaDuplicates([testA, testB])[0].keep.studentId, "b", "confirmed test records can have inconsistent birth dates");
const differentLearner = candidate("ibrahim", "Ahmad", "01");
differentLearner.student.displayName = "Ibrahim Hassan";
assert.equal(planQabilaDuplicates([differentLearner, candidate("ahmad", "Ahmad", "10")]).length, 0, "conflicting learner names never collapse siblings");
console.log("PASS: legacy order links, email-only families, confirmed test data inconsistencies and conflicting learner identities.");

const realA = candidate("real-a", "Ahmad", "01", { birth: "2010-01-01" });
const realB = candidate("real-b", "Ahmad", "10", { birth: "2018-01-01" });
for (const entry of [realA, realB]) entry.student.parents[0].parent.user.firstName = "Another";
assert.equal(planQabilaDuplicates([realA, realB]).length, 0, "test-account exception is restricted to the identified parent");
