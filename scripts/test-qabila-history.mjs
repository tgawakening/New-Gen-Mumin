import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const { Prisma } = require("@prisma/client");
function load(path, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, URL, console, require: name => name === "server-only" ? {} : deps[name] });
  return exports;
}
const qabilas = load("src/lib/community/qabilas.ts", {});
const qabila = "Qabila Banu Hashim";
const asOf = new Date("2026-10-29T12:00:00Z");
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.function("CONCAT", (...values) => values.join(""));
  sql.function("JSON_UNQUOTE", value => value);
  sql.exec(`CREATE TABLE HousePointLedger(id TEXT, studentId TEXT, points INTEGER, reason TEXT, sourceType TEXT, sourceId TEXT, awardedAt TEXT);
    CREATE TABLE QuizLiveSession(id TEXT, quizId TEXT, status TEXT, endedAt TEXT);
    CREATE TABLE QuizLiveSeat(sessionId TEXT, studentId TEXT, joinedAt TEXT);
    CREATE TABLE QuizAttempt(id TEXT, quizId TEXT, studentId TEXT, submittedAt TEXT, autoScore INTEGER, manualScore INTEGER);
    CREATE TABLE QuizAnswer(id TEXT, attemptId TEXT, isCorrect INTEGER, answer TEXT);
    CREATE TABLE Quiz(id TEXT, title TEXT);
    CREATE TABLE QuizQuestion(id TEXT, quizId TEXT);
    CREATE TABLE QuizLiveResponse(id TEXT, sessionId TEXT, studentId TEXT, isCorrect INTEGER, earnedPoints INTEGER, answer TEXT, answeredAt TEXT);
    INSERT INTO Quiz VALUES('quiz','Seerah quiz');
    INSERT INTO QuizLiveSession VALUES('session','quiz','ENDED','2026-10-28T10:05:00.000Z');
    INSERT INTO QuizQuestion VALUES('q1','quiz'),('q2','quiz'),('q3','quiz'),('q4-added-later','quiz');`);
  const at = "2026-10-28T10:00:00.000Z";
  const insertResponse = sql.prepare("INSERT INTO QuizLiveResponse VALUES(?,?,?,?,?,?,?)");
  for (const [id, student, correct, points] of [["r1", "a", 1, 5], ["r2", "a", 0, 0], ["r3", "a", 1, 10], ["r4", "b", 0, 0]]) insertResponse.run(id, "session", student, correct, points, JSON.stringify({ value: "answer", questionCount: 3 }), at);
  const ledger = sql.prepare("INSERT INTO HousePointLedger VALUES(?,?,?,?,?,?,?)");
  const add = (id, points, source, sourceId = id, student = "a", date = at) => ledger.run(id, student, points, "Recorded activity", source, sourceId, date);
  add("l1", 5, "QUIZ_LIVE_ANSWER", "r1"); add("l3", 10, "QUIZ_LIVE_ANSWER", "r3");
  add("prayer1", 25, "FARDH_PRAYER", "2026-10-28:fajr"); add("prayer2", 15, "FARDH_PRAYER", "2026-10-28:dhuhr");
  add("attendance", 20, "ATTENDANCE_ON_TIME"); add("bonus", 10, "QUIZ_LIVE_COMPLETE", "quiz"); add("adjustment", -5, "TEACHER_MANUAL_REVERSAL");
  let membershipQuery;
  const names = [{ studentId: "a", student: { displayName: "Learner A", user: { firstName: "A", lastName: "" } } }, { studentId: "b", student: { displayName: "Learner B", user: { firstName: "B", lastName: "" } } }];
  const db = {
    houseMembership: { findMany: async query => { membershipQuery = query; return names; } },
    housePointLedger: { groupBy: async query => sql.prepare(`SELECT studentId, SUM(points) total FROM HousePointLedger WHERE studentId IN (${query.where.studentId.in.map(() => "?").join(",")}) AND awardedAt <= ? GROUP BY studentId`).all(...query.where.studentId.in, query.where.awardedAt.lte.toISOString()).map(row => ({ studentId: row.studentId, _sum: { points: row.total } })) },
    $queryRaw: async query => {
      // Exercise the real grouped query with SQLite fixtures. Adapt only MySQL's LEFT function.
      const text = query.sql.replace(/LEFT\(([^,]+),\s*(\d+)\)/g, "SUBSTR($1, 1, $2)");
      return sql.prepare(text).all(...query.values.map(value => value instanceof Date ? value.toISOString() : value));
    },
  };
  const service = load("src/lib/community/qabila-history.ts", { "@prisma/client": { Prisma }, "@/lib/db": { db }, "./qabilas": qabilas });
  return { service, sql, add, membershipQuery: () => membershipQuery, close: () => sql.close() };
}
test("history totals reconcile with full quiz scores, prayers, attendance, bonuses and negative adjustments", async () => {
  const f = fixture(); try {
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    assert.equal(history.totalPoints, 80);
    assert.equal(history.events.reduce((sum, event) => sum + event.points, 0), 80);
    assert.equal(history.members.find(m => m.id === "b").points, 0);
    assert.equal(history.totalEvents, 6);
    assert.ok(f.membershipQuery().where.qabilaGroup.in.includes("Boys Qabila A"));
  } finally { f.close(); }
});
test("one quiz row shows earned points, 2/3 correct and the original denominator after a question is added", async () => {
  const f = fixture(); try {
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    const quiz = history.events.find(event => event.id === "quiz:session:a");
    assert.equal(quiz.points, 15); assert.equal(quiz.quizEarnedPoints, 15);
    assert.equal(quiz.score.correct, 2); assert.equal(quiz.score.total, 3);
    assert.equal(quiz.score.historicalTotal, false);
    assert.equal(history.events.find(event => event.id === "quiz:session:b").score.correct, 0);
  } finally { f.close(); }
});
test("pagination has no duplicate events and excludes activity newer than its snapshot", async () => {
  const f = fixture(); try {
    for (let i = 0; i < 25; i++) f.add(`task-${i}`, 1, "HOMEWORK_SUBMITTED");
    const first = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    f.add("newer", 99, "SUNNAH_DAILY", "newer", "a", "2026-10-30T10:00:00.000Z");
    const second = await f.service.getQabilaHistory({ qabila, page: 2, asOf });
    assert.equal(first.totalEvents, 31); assert.equal(second.totalEvents, 31);
    assert.equal(first.events.length, 10); assert.equal(second.events.length, 10);
    assert.equal(new Set([...first.events, ...second.events].map(event => event.id)).size, 20);
    assert.equal(second.totalPoints, 105);
  } finally { f.close(); }
});
test("learner filtering returns only that member and rejects unrelated IDs", async () => {
  const f = fixture(); try {
    const history = await f.service.getQabilaHistory({ qabila, page: 1, studentId: "b", asOf });
    assert.equal(history.events.length, 1); assert.equal(history.events[0].studentId, "b");
    await assert.rejects(f.service.getQabilaHistory({ qabila, page: 1, studentId: "outsider", asOf }), /not in this Qabila/);
  } finally { f.close(); }
});
test("history keeps orphaned old ledger credit rather than silently dropping points", async () => {
  const f = fixture(); try {
    f.add("orphan", 7, "QUIZ_LIVE_ANSWER", "removed-response");
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    assert.equal(history.totalPoints, 87);
    assert.equal(history.events.reduce((sum, event) => sum + event.points, 0), 87);
  } finally { f.close(); }
});

test("ordinary quiz marks are shown once, including students with zero-score submissions", async () => {
  const f = fixture(); try {
    f.sql.exec(`INSERT INTO QuizAttempt VALUES('normal','quiz','b','2026-10-28T11:00:00.000Z',20,20),('zero','quiz','a','2026-10-28T11:05:00.000Z',0,0);
      INSERT INTO QuizAnswer VALUES('a1','normal',1,'{"questionCount":5}'),('a2','normal',1,'{"questionCount":5}'),('a3','normal',0,'{"questionCount":5}'),('a4','normal',0,'{"questionCount":5}'),('a5','normal',0,'{"questionCount":5}'),('zero1','zero',0,'{"questionCount":5}');`);
    f.add('normal-credit', 20, 'QUIZ', 'normal', 'b');
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    const normal = history.events.find(event => event.id === 'quiz-attempt:normal');
    assert.equal(normal.points, 20); assert.equal(normal.quizEarnedPoints, 20); assert.equal(normal.score.correct, 2); assert.equal(normal.score.total, 5); assert.equal(normal.score.historicalTotal, false);
    assert.equal(history.events.filter(event => event.id === 'normal-credit').length, 0);
    const zero = history.events.find(event => event.id === 'quiz-attempt:zero');
    assert.equal(zero.points, 0); assert.equal(zero.score.correct, 0);
    assert.equal(history.totalPoints, 100); assert.equal(history.events.reduce((sum, event) => sum + event.points, 0), 100);
  } finally { f.close(); }
});

test("joined learners without saved answers are visible without inventing quiz marks", async () => {
  const f = fixture(); try {
    f.sql.exec(`INSERT INTO QuizLiveSession VALUES('no-answers','quiz','ENDED','2026-10-28T11:00:00.000Z'),('ongoing','quiz','LIVE',NULL);
      INSERT INTO QuizLiveSeat VALUES('no-answers','b','2026-10-28T10:15:00.000Z'),('no-answers','a',NULL),('ongoing','a','2026-10-28T11:15:00.000Z'),('session','a','2026-10-28T09:00:00.000Z');`);
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    const joined = history.events.find(event => event.id === 'quiz-joined:no-answers:b');
    assert.match(joined.label, /joined, but no answers recorded/); assert.equal(joined.score, null); assert.equal(joined.quizEarnedPoints, null); assert.equal(joined.points, 0);
    assert.equal(history.events.filter(event => event.id.startsWith('quiz-joined:')).length, 1);
    assert.equal(history.totalPoints, 80);
  } finally { f.close(); }
});

test("manually graded answers retain their score without a fabricated zero-correct fraction", async () => {
  const f = fixture(); try {
    f.sql.exec(`INSERT INTO QuizAttempt VALUES('manual','quiz','b','2026-10-28T11:00:00.000Z',0,30);
      INSERT INTO QuizAnswer VALUES('reflection','manual',NULL,'{"questionCount":5}');`);
    f.add('manual-result', 30, 'QUIZ', 'manual', 'b');
    const history = await f.service.getQabilaHistory({ qabila, page: 1, asOf });
    const result = history.events.find(event => event.id === 'quiz-attempt:manual');
    assert.equal(result.quizEarnedPoints, 30); assert.equal(result.points, 30); assert.equal(result.score, null);
  } finally { f.close(); }
});
function endpoint(user) {
  let received;
  const route = load("src/app/api/community/qabila-contributions/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "@/lib/auth/session": { getCurrentSession: async () => user ? { user } : null },
    "@/lib/community/qabilas": qabilas,
    "@/lib/community/qabila-history": { getQabilaHistory: async query => { received = query; return { events: [] }; } },
  });
  return { run: query => route.GET({ url: `https://genmumin.com/api/community/qabila-contributions?${query}` }), received: () => received };
}
test("contribution endpoint requires a parent, teacher or admin session", async () => {
  assert.equal((await endpoint(null).run("qabila=Boys%20Qabila%20A")).status, 401);
  assert.equal((await endpoint({ role: "STUDENT" }).run("qabila=Boys%20Qabila%20A")).status, 403);
  const parent = endpoint({ role: "PARENT" });
  assert.ok((await parent.run("qabila=Girls%20Qabila%20B")).body.events);
  assert.equal(parent.received().qabila, "Qabila Banu Zuhra");
});
test("endpoint rejects invalid Qabila names, pages and future snapshots", async () => {
  const parent = endpoint({ role: "PARENT" });
  for (const query of ["qabila=unknown", "qabila=Boys%20Qabila%20A&page=-1", "qabila=Boys%20Qabila%20A&page=1.5", "qabila=Boys%20Qabila%20A&asOf=2999-01-01"]) assert.equal((await parent.run(query)).status, 400);
});
