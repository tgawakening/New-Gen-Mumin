import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, console, require: name => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (!(name in dependencies)) throw Error(`Unmocked dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const permission = load("src/lib/teacher/recognition-permissions.ts");
const policy = load("src/lib/teacher/programme-scope.ts");
for (const email of ["mehranraziq@gmail.com", "umm.abdissamee@gmail.com", " UMM.ABDISSAMEE@GMAIL.COM "]) test(`weekly certificates allowed for verified account ${email}`, () => {
  assert.equal(permission.canAwardWeeklyCertificates({ role: "TEACHER", email }), true);
});
test("display names and other account roles cannot grant certificate permission", () => {
  assert.equal(permission.canAwardWeeklyCertificates({ role: "TEACHER", email: "saba-imposter@example.test", firstName: "Sister Saba" }), false);
  assert.equal(permission.canAwardWeeklyCertificates({ role: "PARENT", email: "umm.abdissamee@gmail.com" }), false);
});
const { getTeacherNavItems } = load("src/lib/teacher/nav.ts");
test("Live Sessions follows Dashboard in teacher navigation", () => {
  assert.equal(getTeacherNavItems()[0].href, "/teacher");
  assert.equal(getTeacherNavItems()[1].href, "/teacher/live-sessions");
});
test("parent mobile navigation keeps both trackers and Curriculum outside More", () => {
  const { getParentNavItems } = load("src/lib/dashboard/family-nav.ts");
  const link = ({ children, href }) => React.createElement("a", { href }, children);
  const icon = () => null;
  const { MobileFamilyNavRailClient } = load("src/components/dashboard/family/MobileFamilyNavRailClient.tsx", {
    "./FamilyNavigation": { FamilyPortalLink: link },
    "next/navigation": { usePathname: () => "/parent" },
    "lucide-react": { Home: icon, CalendarDays: icon, CheckCircle2: icon, Sun: icon, Menu: icon, X: icon, BookOpen: icon },
    "@/components/dashboard/family/FamilyNavLinkClient": { FamilyNavLinkClient: ({ href, label }) => React.createElement("a", { href }, label) },
  });
  const html = renderToStaticMarkup(React.createElement(MobileFamilyNavRailClient, { navItems: getParentNavItems("child") }));
  const quick = html.match(/<nav aria-label="Quick access"[\s\S]*?<\/nav>/)?.[0] || "";
  for (const route of ["sunnah-tracker", "fardh-tracker", "curriculum"]) assert.ok(quick.includes(`/parent/${route}?child=child`));
});
const { MobileTeacherNavRailClient } = load("src/components/dashboard/teacher/MobileTeacherNavRailClient.tsx", {
  "lucide-react": { ChevronDown: () => null, ChevronUp: () => null, LayoutGrid: () => null },
  "@/components/dashboard/teacher/TeacherNavLinkClient": { TeacherNavLinkClient: ({ href, label }) => React.createElement("a", { href }, label) },
});
test("rewards, curriculum and homework are visible without expanding navigation", () => {
  const html = renderToStaticMarkup(React.createElement(MobileTeacherNavRailClient, { navItems: getTeacherNavItems() }));
  for (const href of ["/teacher/recognition", "/teacher/course-builder", "/teacher/homework"]) assert.ok(html.includes(`href="${href}"`));
});
function liveFixture(user = { id: "own-teacher", role: "TEACHER", firstName: "Teacher", email: "teacher@example.test" }) {
  let rows = [], query;
  const { GET } = load("src/app/api/teacher/live-rewards/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => ({ data, ...options }) } },
    "@/lib/auth/session": { getCurrentSession: async () => user ? { user } : null },
    "@/lib/db": { db: { liveClassSessionOccurrence: { findMany: async input => { query = input; return rows; } } } },
    "@/lib/teacher/programme-scope": policy,
  });
  return { GET, setRows: value => { rows = value; }, query: () => query };
}
const liveRow = (slug = "seerah", endedAt = null) => ({ endedAt, schedule: { program: { slug } } });
test("live reminder requires a teacher session", async () => {
  assert.equal((await liveFixture(null).GET()).status, 401);
  assert.equal((await liveFixture({ role: "STUDENT" }).GET()).status, 403);
});
test("reminder query uses only the signed-in teacher's confirmed Zoom events", async () => {
  const f = liveFixture(); f.setRows([liveRow()]);
  assert.equal((await f.GET()).data.live, true);
  assert.equal(f.query().where.teacherUserId, "own-teacher");
  assert.equal(f.query().where.source, "zoom-webhook");
  assert.equal(Array.from(f.query().distinct).join(), "scheduleId");
});
test("reminder ends with class and returns on each new class", async () => {
  const f = liveFixture();
  f.setRows([liveRow()]); assert.equal((await f.GET()).data.live, true);
  f.setRows([liveRow("seerah", new Date())]); assert.equal((await f.GET()).data.live, false);
  f.setRows([liveRow()]); assert.equal((await f.GET()).data.live, true);
  f.setRows([]); assert.equal((await f.GET()).data.live, false);
});
test("Mehran's obsolete Arabic classes cannot trigger his reminder", async () => {
  const f = liveFixture({ id: "mehran", role: "TEACHER", firstName: "Mehran", email: "mehranraziq@gmail.com" });
  f.setRows([liveRow("arabic")]); assert.equal((await f.GET()).data.live, false);
  f.setRows([liveRow("seerah")]); assert.equal((await f.GET()).data.live, true);
});

function mumFixture(email) {
  let actor = { id: "teacher", role: "TEACHER", email };
  let dashboardReads = 0;
  const empty = () => null;
  const { default: Page } = load("src/app/teacher/parent-recognition/page.tsx", {
    "@/components/dashboard/teacher/CertificatePublication": { CertificatePublicField: empty, CertificatePublicationControl: empty, HideWeeklyCertificates: empty },
    "@/lib/community/certificate-publication": { setCertificatePublication: async () => {} },
    "@/app/teacher/certificate-actions": { refreshCertificatePortals: async () => {} },
    "@/lib/teacher/recognition-permissions": permission,
    "@/components/dashboard/teacher/RecognitionWeekSelector": { RecognitionWeekSelector: empty },
    "@/lib/community/recognition-week": { currentRecognitionWeek: () => "2026-10-26", validRecognitionWeek: () => true, recognitionWeekLabel: value => value },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: url => { throw Error(url); } },
    "lucide-react": { Download: empty, HeartHandshake: empty, Trash2: empty },
    "@/components/dashboard/ActionToast": { ActionToast: empty },
    "@/components/dashboard/FormSubmitButton": { FormSubmitButton: empty },
    "@/components/dashboard/teacher/TeacherDashboardFrame": { TeacherDashboardFrame: empty, TeacherMetricGrid: empty, TeacherSection: empty },
    "@/components/dashboard/teacher/TeacherRewardWorkspaceTabs": { TeacherRewardWorkspaceTabs: empty },
    "@/lib/auth/session": { getCurrentSession: async () => ({ user: actor }), getDashboardHome: () => "/" },
    "@/lib/community/parent-recognition": { MUM_CHARACTER_BADGES: [], awardParentRecognition: () => { throw Error("Unexpected write"); } },
    "@/lib/community/point-awards": { pointDayKey: () => "2026-10-29" },
    "@/lib/db": { db: { parentStudent: { findMany: async () => [] }, parentRecognitionAward: { findMany: async () => [] } } },
    "@/lib/teacher/dashboard": { getTeacherDashboardData: async () => { dashboardReads++; return { rosters: [] }; } },
    "@/lib/teacher/nav": { getTeacherNavItems: () => [] },
  });
  return { Page: () => Page({}), dashboardReads: () => dashboardReads, setActor: value => { actor = value; } };
}
function findForm(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "form") return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = findForm(child); if (result) return result; }
  return null;
}
test("Mum certificate page rejects other teachers before loading private roster data", async () => {
  const fixture = mumFixture("other@example.test");
  await assert.rejects(fixture.Page(), /\/teacher\/recognition/);
  assert.equal(fixture.dashboardReads(), 0);
});
test("Mum award action rechecks identity when an old form is submitted", async () => {
  const fixture = mumFixture("umm.abdissamee@gmail.com");
  const tree = await fixture.Page();
  fixture.setActor({ id: "other", role: "TEACHER", email: "other@example.test" });
  const reads = fixture.dashboardReads();
  await assert.rejects(findForm(tree).props.action(new FormData()), /\/teacher\/recognition/);
  assert.equal(fixture.dashboardReads(), reads);
});
