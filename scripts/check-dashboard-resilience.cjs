const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const assert = require("node:assert/strict");
function load(path, imports, errors) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, console: { error: (...args) => errors.push(args) }, require: (name) => { if (name in imports) return imports[name]; throw Error(name); } });
  return exports;
}
(async () => {
  const errors = [];
  const { loadOptionalDashboardSection: section } = load("src/lib/dashboard/optional-section.ts", { "server-only": {} }, errors);
  const healthy = await section("awards", async () => ({ title: "Award" }), null);
  assert.equal(healthy.data.title, "Award"); assert.equal(healthy.unavailable, false);
  const empty = await section("awards", async () => null, null);
  assert.equal(empty.unavailable, false, "no awards is not a loading failure");
  const failed = await section("awards", async () => { throw Error("missing database column"); }, null);
  assert.equal(failed.data, null); assert.equal(failed.unavailable, true);
  const results = await Promise.all([section("first child quizzes", async () => { throw Error("timeout"); }, []), section("second child quizzes", async () => ["active quiz"], [])]);
  assert.equal(results[0].unavailable, true); assert.equal(results[1].data[0], "active quiz");
  const qabilas = load("src/lib/community/qabilas.ts", {}, errors);
  const { QabilaLeaderboardOverview } = load("src/components/dashboard/family/QabilaLeaderboardOverview.tsx", {
    "server-only": {}, "react/jsx-runtime": require("react/jsx-runtime"), "next/image": { default: "img" }, "lucide-react": {}, "@/lib/community/qabilas": qabilas,
    "@/lib/db": { db: { housePointLedger: { groupBy: async () => { throw Error("pool timeout"); }, findMany: async () => [] }, houseMembership: { findMany: async () => [] } } },
  }, errors);
  const fallback = await QabilaLeaderboardOverview({ audience: "parent" });
  assert.equal(fallback.props.role, "status");
  assert.ok(JSON.stringify(fallback).includes("temporarily unavailable"));
  assert.equal(errors.length, 3, "failures remain visible in runtime logs");
  console.log("PASS: optional failures stay local, healthy sections survive, empty results remain distinct from failures, leaderboard fallback and runtime logging.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
