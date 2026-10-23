/**
 * @ewa/client Vite config (SPEC §20.1, §20.2.2, §20.10.2).
 *
 * Dev proxies: `/api` → REST on :4000 (mounted at the root, so the prefix is stripped) and `/colyseus` → the
 * Colyseus WebSocket on :2567 (the client connects straight to VITE_WS_URL, default ws://<page host>:2567; the
 * proxy exists for same-origin setups). `publicDir` stays the default `public/` (pipeline outputs live there).
 */
import { existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { HtmlTagDescriptor, Plugin } from 'vite';

const API_TARGET = process.env['EWA_API_TARGET'] ?? 'http://localhost:4000';
const WS_TARGET = process.env['EWA_WS_TARGET'] ?? 'ws://localhost:2567';
// NPC talk (src/talk): Llama.cpp's OpenAI-compatible API
const LLM_TARGET = process.env['EWA_LLM_TARGET'] ?? 'http://localhost:1234';
const llmProxy = {
  '/npc/llm': { target: LLM_TARGET, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/npc\/llm/, '') },
};
const fontsDir = fileURLToPath(new URL('./public/fonts', import.meta.url));

/** §20.2.2: `<link rel="preload" as="font" crossorigin>` for each latin woff2 present in public/fonts/ (latin-ext loads on demand). */
function fontPreloads(): Plugin {
  return {
    name: 'ewa:font-preloads',
    transformIndexHtml(): HtmlTagDescriptor[] {
      if (!existsSync(fontsDir)) return [];
      return readdirSync(fontsDir)
        .filter((f) => f.endsWith('.woff2') && !f.includes('-latin-ext'))
        .sort()
        .map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/fonts/${encodeURIComponent(f)}`, crossorigin: '' },
          injectTo: 'head',
        }));
    },
  };
}

/**
 * §20.10.2 rule 7 bundle budget, gzipped: the entry (shell) chunk ≤ 180 KB, every other chunk ≤ 900 KB. Reported
 * after every build; `EWA_BUNDLE_STRICT=1` turns an overrun into a build failure (see IMPLEMENTATION-NOTES D8).
 */
function bundleBudget(): Plugin {
  const SHELL = 180 * 1024;
  const CHUNK = 900 * 1024;
  return {
    name: 'ewa:bundle-budget',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const over: string[] = [];
      for (const [name, out] of Object.entries(bundle)) {
        if (out.type !== 'chunk') continue;
        const gz = gzipSync(out.code).length;
        const limit = out.isEntry ? SHELL : CHUNK;
        this.info(`${name}: ${(gz / 1024).toFixed(1)} KB gzip (budget ${(limit / 1024).toFixed(0)} KB)`);
        if (gz > limit) over.push(`${name} ${(gz / 1024).toFixed(1)} KB > ${(limit / 1024).toFixed(0)} KB`);
      }
      if (over.length === 0) return;
      const msg = `bundle budget exceeded: ${over.join('; ')}`;
      if (process.env['EWA_BUNDLE_STRICT'] === '1') this.error(msg);
      else this.warn(msg);
    },
  };
}

export default defineConfig({
  plugins: [react(), fontPreloads(), bundleBudget()],
  server: {
    port: 5173,
    strictPort: true,
    // listen on every interface: the game can be opened from another machine by the host's LAN IP
    host: true,
    // EWA_NO_HMR=1 (the second isolated dev pair, scripts/dev-alt.mjs `client 2`): no file watching and no HMR, so a
    // live check is not reloaded by edits other sessions make in the same checkout (restart it to pick up changes)
    ...(process.env['EWA_NO_HMR'] === '1' ? { hmr: false, watch: null } : {}),
    // EWA_WATCH_POLL=1 (docker-compose.yml): poll the bind-mounted sources, file events may not cross the mount
    ...(process.env['EWA_WATCH_POLL'] === '1' ? { watch: { usePolling: true, interval: 300 } } : {}),
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/colyseus': { target: WS_TARGET, ws: true, changeOrigin: true, rewrite: (p) => p.replace(/^\/colyseus/, '') },
      ...llmProxy,
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      ...llmProxy,
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
