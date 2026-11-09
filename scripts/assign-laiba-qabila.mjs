import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Reads only by default. This repair never runs as part of web startup.
if (!process.argv.includes('--apply')) {
  await import('./audit-laiba-qabila.mjs');
} else {
  const require = createRequire(import.meta.url);
  const cli = require.resolve('prisma/build/index.js');
  const schemaIndex = process.argv.indexOf('--schema');
  const schema = schemaIndex >= 0 ? process.argv[schemaIndex + 1] : 'prisma/schema.prisma';
  if (!schema) throw new Error('A schema path is required after --schema.');
  console.log('Applying the owner-requested Laiba Qabila repair separately from app startup.');
  const result = spawnSync(process.execPath, [cli, 'db', 'execute', '--file', fileURLToPath(new URL('./sql/assign-laiba-girls-qabila.sql', import.meta.url)), '--schema', schema], { env: process.env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
  if (result.status === 0 && schemaIndex < 0) await import('./audit-laiba-qabila.mjs');
}
