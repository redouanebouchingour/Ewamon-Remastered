/**
 * Browser sandbox for @ewa/render (not part of the package build).
 * `pnpm --filter @ewa/render sandbox` → http://localhost:5180
 * `packages/client/public` is the public dir so `/basis/` (KTX2 transcoder) and `/materials/` (baked sets,
 * when present) resolve exactly as they will in the client.
 *
 * Dev-only helper: `POST /__shot?name=<id>` with a JPEG body writes `sandbox/.shots/<id>.jpg`, so frames can be
 * captured for review even when the browser window is hidden (`window.__ewaSandbox.shot(name)`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const SHOTS = here('./sandbox/.shots');

function shotEndpoint(): Plugin {
  return {
    name: 'ewa-sandbox-shot',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const raw = new URL(req.url ?? '', 'http://sandbox').searchParams.get('name') ?? 'shot';
          const name = raw.replace(/[^a-z0-9_-]/gi, '').slice(0, 64) || 'shot';
          mkdirSync(SHOTS, { recursive: true });
          const file = join(SHOTS, `${name}.jpg`);
          writeFileSync(file, Buffer.concat(chunks));
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ file }));
        });
      });
    },
  };
}

export default defineConfig({
  root: here('./sandbox'),
  publicDir: here('../client/public'),
  plugins: [shotEndpoint()],
  server: { port: 5180, strictPort: true, fs: { allow: [here('..'), here('../..')] } },
  preview: { port: 5180, strictPort: true },
  build: { outDir: here('./.sandbox-dist'), emptyOutDir: true, target: 'es2022' },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
});
