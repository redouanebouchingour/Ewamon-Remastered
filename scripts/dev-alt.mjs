// usage: node scripts/dev-alt.mjs server|client — an isolated dev server (REST 4100 / WS 2667, PGlite in packages/server/.data-alt) or client (5174), for when another session holds the default ports
// `node scripts/dev-alt.mjs server|client 2` is a second isolated pair (REST 4200 / WS 2767, packages/server/.data-alt2, client 5175) for when the first is taken too;
// its client runs without HMR or file watching (EWA_NO_HMR), so other sessions' edits never reload a live check
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const which = process.argv[2];
const slot = process.argv[3] === '2' ? 2 : 1;
const rest = slot === 2 ? '4200' : '4100';
const wsPort = slot === 2 ? '2767' : '2667';
const clientPort = slot === 2 ? '5175' : '5174';
const env = { ...process.env };
let cwd, args;
if (which === 'server') {
  Object.assign(env, { PORT_REST: rest, PORT_WS: wsPort, DATA_DIR: slot === 2 ? './.data-alt2' : './.data-alt', CORS_ORIGINS: `http://localhost:${clientPort}`, JWT_SECRET: 'dev-alt-secret-dev-alt-secret-0123456789ab' });
  cwd = `${root}/packages/server`; args = ['tsx', '--tsconfig', 'tsconfig.dev.json', 'src/main.ts'];
} else {
  Object.assign(env, { EWA_API_TARGET: `http://localhost:${rest}`, VITE_WS_URL: `ws://localhost:${wsPort}`, ...(slot === 2 ? { EWA_NO_HMR: '1' } : {}) });
  cwd = `${root}/packages/client`; args = ['vite', '--port', clientPort, '--strictPort'];
}
const p = spawn('npx', args, { cwd, env, stdio: 'inherit', shell: true });
p.on('exit', (c) => process.exit(c ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => p.kill());
