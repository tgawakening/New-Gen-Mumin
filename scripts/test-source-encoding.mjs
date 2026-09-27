import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const checker = path.resolve('scripts/check-source-encoding.mjs');
test('deployment encoding check rejects Windows-only bytes and accepts UTF-8', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'genm-encoding-'));
  const dir = path.join(root, 'src');
  const file = path.join(dir, 'navigation.tsx');
  fs.mkdirSync(dir);
  try {
    fs.writeFileSync(file, Buffer.from([47,47,32,149]));
    const failed = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /navigation\.tsx/);
    fs.writeFileSync(file, '// Valid UTF-8: \u2022 \u0627\u0644\u0633\u0644\u0627\u0645\n', 'utf8');
    const passed = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout, /check passed/);
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
    fs.rmdirSync(root);
  }
});
