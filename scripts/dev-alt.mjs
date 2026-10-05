// usage: node scripts/dev-alt.mjs server|client — an isolated dev server (REST 4100 / WS 2667, PGlite in packages/server/.data-alt) or client (5174), for when another session holds the default ports
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const which = process.argv[2];
const env = { ...process.env };
let cwd, args;
if (which === 'server') {
  Object.assign(env, { PORT_REST: '4100', PORT_WS: '2667', DATA_DIR: './.data-alt', CORS_ORIGINS: 'http://localhost:5174', JWT_SECRET: 'dev-alt-secret-dev-alt-secret-0123456789ab' });
  cwd = `${root}/packages/server`; args = ['tsx', '--tsconfig', 'tsconfig.dev.json', 'src/main.ts'];
} else {
  Object.assign(env, { EWA_API_TARGET: 'http://localhost:4100', VITE_WS_URL: 'ws://localhost:2667' });
  cwd = `${root}/packages/client`; args = ['vite', '--port', '5174', '--strictPort'];
}
const p = spawn('npx', args, { cwd, env, stdio: 'inherit', shell: true });
p.on('exit', (c) => process.exit(c ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => p.kill());
