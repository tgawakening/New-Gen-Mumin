import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, URLSearchParams, require: name => {
    if (!(name in dependencies)) throw Error(`Unmocked dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const policy = load("src/lib/teacher/programme-scope.ts");
const mehran = { firstName: "Mehran", lastName: "Raziq", email: "mehranraziq@gmail.com" };
const other = { firstName: "Arabic", lastName: "Teacher", email: "arabic@example.test" };
test("Mehran sees only Seerah and parental programmes despite obsolete assignments", () => {
  const assignments = ["arabic", "tajweed", "seerah", "parental-sessions", "life-lessons"].map(slug => ({ program: { slug } }));
  assert.deepEqual(Array.from(policy.scopeTeacherAssignments(mehran, assignments), row => row.program.slug), ["seerah", "parental-sessions"]);
});
test("known email remains scoped when display name changes", () => {
  assert.equal(policy.canSeeTeacherProgramme({ ...mehran, firstName: "Ustadh", lastName: "Raziq" }, { slug: "arabic" }), false);
});
test("Mehran name remains scoped with an alternate account email", () => {
  assert.equal(policy.canSeeTeacherProgramme({ ...mehran, email: "alternate@example.test" }, { slug: "tajweed" }), false);
});
test("another teacher retains their existing Arabic and Tajweed programmes", () => {
  for (const slug of ["arabic", "tajweed", "seerah"]) assert.equal(policy.canSeeTeacherProgramme(other, { slug }), true);
});
test("an unrelated surname does not trigger Mehran's restriction", () => {
  assert.equal(policy.isSeerahParentalTeacher({ ...other, lastName: "Mehrani" }), false);
});
function startRoute(slug, user = mehran) {
  let zoomCalls = 0;
  const route = load("src/app/teacher/live-sessions/[scheduleId]/start/route.ts", {
    "@/lib/live-classes/schedule-lifecycle": { hasScheduleEnded: () => false },
    "next/server": { NextResponse: { redirect: url => ({ location: String(url) }) } },
    "@/lib/auth/session": { getCurrentSession: async () => ({ user: { id: "teacher-user", role: "TEACHER" } }) },
    "@/lib/db": { db: { teacherProfile: { findUnique: async () => ({ id: "teacher", user }) }, classSchedule: { findFirst: async () => ({ meetingId: "meeting", meetingUrl: "https://zoom.us/join", program: { slug } }) } } },
    "@/lib/env": { env: { success: true, data: { APP_URL: "https://genmumin.com" } } },
    "@/lib/zoom/client": { getZoomMeetingStartUrl: async () => { zoomCalls++; return "https://zoom.us/host"; } },
    "@/lib/teacher/programme-scope": policy,
  });
  return { run: mode => route.GET({ url: `https://genmumin.com/teacher/live-sessions/old/start${mode ? "?mode=" + mode : ""}` }, { params: Promise.resolve({ scheduleId: "old" }) }), zoomCalls: () => zoomCalls };
}
for (const slug of ["arabic", "tajweed"]) for (const mode of ["", "member"]) test(`old ${slug} link is blocked for Mehran (${mode || "host"})`, async () => {
  const route = startRoute(slug);
  assert.match((await route.run(mode)).location, /\/teacher\/live-sessions\?notice=/);
  assert.equal(route.zoomCalls(), 0);
});
test("Seerah host launch remains available for Mehran", async () => {
  assert.equal((await startRoute("seerah").run()).location, "https://zoom.us/host");
});
test("parental host launch remains available for Mehran", async () => {
  assert.equal((await startRoute("parental-sessions").run()).location, "https://zoom.us/host");
});
test("Arabic host launch remains available for its teacher", async () => {
  assert.equal((await startRoute("arabic", other).run()).location, "https://zoom.us/host");
});
