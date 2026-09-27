import fs from 'node:fs';
import path from 'node:path';
const decoder = new TextDecoder('utf-8', { fatal: true });
const extensions = /\.(?:[cm]?[jt]sx?|json|css|html|webmanifest)$/i;
let count = 0;
const invalid = [];
function check(file) {
  count++;
  try { decoder.decode(fs.readFileSync(file)); }
  catch (error) {
    if (error.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') throw error;
    invalid.push(file);
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && extensions.test(entry.name)) check(file);
  }
}
for (const dir of ['src', 'public']) walk(dir);
for (const file of ['next.config.ts', 'next.config.js', 'next.config.mjs', 'package.json', 'tsconfig.json']) {
  if (fs.existsSync(file)) check(file);
}
if (invalid.length) {
  console.error('Invalid UTF-8 source files. Re-save these files as UTF-8 before deploying:\n' + invalid.map(file => '  ' + file).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Source encoding check passed (${count} files).`);
}
