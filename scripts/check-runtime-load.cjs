const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;

// A second server bundle must reuse the process's existing Prisma pool.
let pools = 0;
const sharedGlobal = {};
for (let i = 0; i < 2; i++) {
  vm.runInNewContext(compile(fs.readFileSync('src/lib/db.ts', 'utf8')), {
    exports: {}, global: sharedGlobal, process: { env: { NODE_ENV: 'production' } },
    require: () => ({ PrismaClient: class { constructor() { pools++; } } }),
  });
}
assert.equal(pools, 1);

// Multiple countdown cards share one timer; hidden/offline tabs do no work.
let timer;
let timerCount = 0;
let refreshes = 0;
const document = { hidden: false };
const navigator = { onLine: true };
const countdown = fs.readFileSync('src/components/dashboard/family/LiveClassCountdown.tsx', 'utf8');
const context = vm.createContext({ document, navigator, Math, Set, window: {
  setInterval(fn) { timer = fn; timerCount++; return 1; },
  clearInterval() { timerCount--; },
} });
vm.runInContext(compile(countdown.slice(countdown.indexOf('const pageRefreshers'), countdown.indexOf('function formatCountdown'))), context);
const stop1 = context.subscribeToPageRefresh(() => refreshes++);
const stop2 = context.subscribeToPageRefresh(() => refreshes++);
assert.equal(timerCount, 1);
timer(); assert.equal(refreshes, 1);
document.hidden = true; timer(); assert.equal(refreshes, 1);
document.hidden = false; navigator.onLine = false; timer(); assert.equal(refreshes, 1);
navigator.onLine = true;
stop1(); timer(); assert.equal(refreshes, 2);
stop2(); assert.equal(timerCount, 0);

// A slow quiz refresh cannot overlap another poll, even after several ticks.
let pending = false;
let effects = [];
let priorDeps = [];
let effectIndex = 0;
const ref = { current: false };
let polls = 0;
let quizTimer;
const quizExports = {};
const router = { refresh() { polls++; } };
const react = {
  useRef: () => ref,
  useCallback: fn => fn,
  useTransition: () => [pending, fn => { pending = true; fn(); }],
  useEffect(fn, deps) {
    const i = effectIndex++;
    if (!priorDeps[i] || deps.some((d, j) => d !== priorDeps[i][j])) effects.push(fn);
    priorDeps[i] = deps;
  },
};
vm.runInNewContext(compile(fs.readFileSync('src/components/quizzes/LiveQuizAutoRefresh.tsx', 'utf8')), {
  exports: quizExports, Math, document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  navigator: { onLine: true },
  window: { setInterval(fn) { quizTimer = fn; return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
  require: name => name === 'react' ? react : { useRouter: () => router },
});
function render() { effectIndex = 0; effects = []; quizExports.LiveQuizAutoRefresh({}); effects.forEach(fn => fn()); }
render(); quizTimer(); assert.equal(polls, 1);
render(); quizTimer(); quizTimer(); assert.equal(polls, 1);
pending = false; render(); quizTimer(); assert.equal(polls, 2);
const teacherHome = fs.readFileSync('src/app/teacher/page.tsx', 'utf8');
const teacherCommunity = fs.readFileSync('src/app/teacher/community/page.tsx', 'utf8');
assert.doesNotMatch(teacherHome, /syncAllQabilaRoomMemberships|syncQabilaSupervisors/);
assert.doesNotMatch(teacherCommunity, /syncAllQabilaRoomMemberships|syncQabilaSupervisors/);
const rosterService = fs.readFileSync('src/lib/live-classes/service.ts', 'utf8');
for (const functionName of ['getTeacherProgramRosterEntries', 'getTeacherProgramRosterStudentIds']) {
  const start = rosterService.indexOf(`export async function ${functionName}`);
  const end = rosterService.indexOf('\nexport ', start + 1);
  const source = rosterService.slice(start, end < 0 ? undefined : end);
  assert.doesNotMatch(source, /deleteMany|createMany|\.upsert|\$transaction/, `${functionName} must remain read-only`);
}

console.log('PASS: pool reuse, refresh backpressure, and read-only teacher dashboard/roster paths.');
