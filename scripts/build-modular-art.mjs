import { spawn } from 'node:child_process';
import { once } from 'node:events';
const run = async (args) => {
  const p = spawn(process.execPath, args, { stdio: 'inherit' });
  const [code] = await once(p, 'exit');
  if (code !== 0) throw new Error(`Art command failed: ${code}`);
};
await run([process.env.npm_execpath, 'run', 'content:build']);
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'apps/web',
    '--host',
    '127.0.0.1',
    '--port',
    '5199',
    '--strictPort',
  ],
  { stdio: 'ignore', env: { ...process.env, VITE_ACCOUNT_MODE: 'demo' } },
);
try {
  let ready = false;
  for (let n = 0; n < 80; n++) {
    if (server.exitCode !== null) throw new Error('Art preview server failed');
    try {
      ready = (await fetch('http://127.0.0.1:5199')).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Art preview startup timed out');
  await run(['scripts/export-avatar-tech.mjs', 'http://127.0.0.1:5199']);
  await run(['scripts/pack-artist-kit.mjs']);
} finally {
  server.kill('SIGTERM');
}
