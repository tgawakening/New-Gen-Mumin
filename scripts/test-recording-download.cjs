/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route test loader. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function setup(role = 'ADMIN') {
  const state = { mime: 'video/mp4', calls: 0, query: null, range: null, fail: false, recording: { driveFileId: 'private-file', storageProvider: 'google-drive', topic: 'Arabic', recordingStart: new Date('2026-10-14'), schedule: { title: 'Arabic / class' } } };
  const mod = new Module(__filename);
  mod.require = id => {
    if (id === '@/lib/auth/session') return { getCurrentSession: async () => role ? { user: { role } } : null };
    if (id === '@/lib/db') return { db: { liveClassRecording: { findFirst: async q => { state.query = q; return state.recording; } } } };
    if (id === '@/lib/google-drive/client') return { driveMediaRequest: async (_id, range) => { state.calls++; state.range = range; if (state.fail) throw Error('secret'); return new Response('video', { status: range ? 206 : 200, headers: { 'content-type': state.mime, 'content-length': '5', ...(range ? { 'content-range': 'bytes 0-4/10' } : {}) } }); } };
    throw Error(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync('src/app/api/recordings/[recordingId]/download/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, __filename);
  return { state, get: range => mod.exports.GET(new Request('https://example.com/download', { headers: range ? { range } : {} }), { params: Promise.resolve({ recordingId: 'recording123' }) }) };
}
test('downloads require admin before any database or storage access', async () => { for (const role of [null, 'PARENT', 'STUDENT', 'TEACHER']) { const f = setup(role); assert.equal((await f.get()).status, role ? 403 : 401); assert.equal(f.state.query, null); assert.equal(f.state.calls, 0); } });
test('missing/deleted and unprepared recordings cannot download', async () => { const f = setup(); f.state.recording = null; assert.equal((await f.get()).status, 404); assert.equal(f.state.query.where.deletedAt, null); f.state.recording = { storageProvider: 'processing' }; assert.equal((await f.get()).status, 409); assert.equal(f.state.calls, 0); });
test('streams attachment with date/title and supports range resume', async () => { const f = setup(); const r = await f.get('bytes=0-4'); assert.equal(r.status, 206); assert.equal(f.state.range, 'bytes=0-4'); assert.equal(r.headers.get('content-range'), 'bytes 0-4/10'); assert.match(r.headers.get('content-disposition'), /attachment; filename="2026-10-14-Arabic-class-recording123.mp4"/); assert.equal(r.headers.get('cache-control'), 'private, no-store'); assert.equal(await r.text(), 'video'); });
test('storage failures return a safe retry message', async () => { const f = setup(); f.state.fail = true; const r = await f.get(); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /secret/); });

test('generic storage content type retains the original recording extension', async () => { const f = setup(); f.state.mime = 'application/octet-stream'; f.state.recording.fileType = 'MP4'; assert.match((await f.get()).headers.get('content-disposition'), /\.mp4/); });