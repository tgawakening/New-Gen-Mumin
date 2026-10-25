import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react/jsx-runtime") return jsx;
    if (name === "react") return React;
    if (!(name in dependencies)) throw Error(`Unmocked dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const icon = () => null;
const { TeacherRewardWorkspaceTabs } = load("src/components/dashboard/teacher/TeacherRewardWorkspaceTabs.tsx", {
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "lucide-react": { Award: icon, HeartHandshake: icon, Sparkles: icon },
});
test("badges are first and weekly certificates have their own active tab", () => {
  const html = renderToStaticMarkup(React.createElement(TeacherRewardWorkspaceTabs, { active: "certificate" }));
  assert.ok(html.indexOf("Award badges") < html.indexOf("Mumin of the Week"));
  assert.match(html, /href="\/teacher\/recognition\?tab=certificate" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
});
const { AwardBadgeForm } = load("src/components/dashboard/teacher/AwardBadgeForm.tsx", {
  "@/components/dashboard/FormSubmitButton": { FormSubmitButton: ({ children }) => React.createElement("button", { type: "submit" }, children) },
});
const students = [{ id: "one", name: "Learner One" }, { id: "two", name: "Learner Two" }];
const badges = [{ key: "HELPER", title: "The Helper", description: "Helps classmates patiently." }, { key: "HOUSE_BUILDER", title: "Qabila Builder", description: "Supports another Qabila." }];
function form(initialBadge, roster = students) {
  return renderToStaticMarkup(React.createElement(AwardBadgeForm, { action: "/test-award", students: roster, badges, bonuses: { HELPER: 10 }, initialBadge }));
}
test("badge links preselect the badge and explain it without unrelated fields", () => {
  const html = form("HELPER");
  assert.match(html, /value="HELPER" selected=""/);
  assert.match(html, /Helps classmates patiently/);
  assert.doesNotMatch(html, /name="beneficiaryStudentId"/);
  assert.match(html, /minLength="12" maxLength="500"/);
});
test("cross-Qabila badge asks for a required beneficiary", () => {
  assert.match(form("HOUSE_BUILDER"), /name="beneficiaryStudentId" required=""/);
});
test("unassigned teachers see an explanation instead of an unusable form", () => {
  const html = form("HELPER", []);
  assert.match(html, /No students are assigned/);
  assert.doesNotMatch(html, /<form/);
});

async function workspace(params = {}) {
  const AwardForm = () => null;
  let writes = 0;
  const definition = [{ key: "MUMIN_OF_WEEK", title: "Mumin of the Week" }, ...badges];
  const { default: Page } = load("src/app/teacher/recognition/page.tsx", {
    "@/components/dashboard/teacher/AwardBadgeForm": { AwardBadgeForm: AwardForm },
    "@/components/dashboard/teacher/TeacherBadgeOverview": { TeacherBadgeOverview: icon },
    "@/components/dashboard/teacher/RecognitionWeekSelector": { RecognitionWeekSelector: icon },
    "@/lib/community/recognition-week": { currentRecognitionWeek: () => "2026-10-19", validRecognitionWeek: () => true, recognitionWeekLabel: value => value },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: url => { throw Error(url); } },
    "lucide-react": { Award: icon, CalendarDays: icon, FileText: icon, Trash2: icon },
    "@/components/dashboard/ActionToast": { ActionToast: icon },
    "@/components/dashboard/FormSubmitButton": { FormSubmitButton: icon },
    "@/components/dashboard/teacher/TeacherDashboardFrame": { TeacherDashboardFrame: icon, TeacherMetricGrid: icon, TeacherSection: icon },
    "@/components/dashboard/teacher/TeacherRewardWorkspaceTabs": { TeacherRewardWorkspaceTabs: icon },
    "@/lib/auth/session": { getCurrentSession: async () => ({ user: { id: "teacher", role: "TEACHER" } }), getDashboardHome: () => "/" },
    "@/lib/community/recognition": { CHARACTER_BADGES: definition, awardRecognition: async () => { writes++; return { certificateCode: "code" }; } },
    "@/lib/community/point-awards": { pointDayKey: () => "2026-10-25" },
    "@/lib/teacher/dashboard": { getTeacherDashboardData: async () => ({ rosters: [{ students }] }) },
    "@/lib/teacher/nav": { getTeacherNavItems: () => [] },
    "@/lib/db": { db: { recognitionAward: { findMany: async () => [] } } },
  });
  const tree = await Page({ searchParams: Promise.resolve(params) });
  function find(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === AwardForm) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child); if (result) return result; }
    return null;
  }
  return { form: find(tree), writes: () => writes };
}
function payload(patch) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ studentId: "one", badgeKey: "HELPER", evidence: "Helped a classmate patiently.", ...patch })) data.set(key, value);
  return data;
}
test("badge form is the default and certificate tab hides it", async () => {
  assert.ok((await workspace()).form);
  assert.equal((await workspace({ tab: "certificate" })).form, null);
});
test("award action rejects students outside the teacher roster before writing", async () => {
  const page = await workspace();
  await assert.rejects(page.form.props.action(payload({ studentId: "outsider" })), /error=/);
  assert.equal(page.writes(), 0);
});
test("weekly badge cannot be forged through the ordinary badge form", async () => {
  const page = await workspace();
  await assert.rejects(page.form.props.action(payload({ badgeKey: "MUMIN_OF_WEEK" })), /error=/);
  assert.equal(page.writes(), 0);
});
test("cross-Qabila awards reject missing beneficiaries before writing", async () => {
  const page = await workspace();
  await assert.rejects(page.form.props.action(payload({ badgeKey: "HOUSE_BUILDER" })), /different/);
  assert.equal(page.writes(), 0);
});
