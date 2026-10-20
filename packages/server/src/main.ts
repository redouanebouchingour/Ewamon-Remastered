/**
 * §30.0 `main.ts` — the only file with side effects at import time. env parse → db (+ migrations) →
 * createRepos → boot (Colyseus WS + Fastify REST) → signal handling.
 *
 * Dev without Docker: when DATABASE_URL is unset the database is PGlite persisted at `${DATA_DIR}/pglite`
 * (refused in production by `parseEnv`). In development a missing JWT_SECRET falls back to a fixed dev
 * secret with a warning, so `pnpm dev:server` works out of the box; test/production still require it.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContentIndex } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';
import { parseEnv } from './env';
import { createLogger } from './log';
import { boot } from './server';

const DEV_JWT_SECRET = 'ewa-dev-only-secret-change-me-0123456789abcdef';

async function main(): Promise<void> {
  const raw = { ...process.env };
  const devDefault = (raw['NODE_ENV'] ?? 'development') === 'development' && raw['JWT_SECRET'] === undefined;
  if (devDefault) raw['JWT_SECRET'] = DEV_JWT_SECRET;
  const env = parseEnv(raw);
  const log = createLogger(env);
  if (devDefault) log.warn('JWT_SECRET unset — using the fixed development secret (never do this outside dev)');

  let pgliteDir: string | undefined;
  if (env.DATABASE_URL === undefined) {
    pgliteDir = resolve(env.DATA_DIR, 'pglite');
    mkdirSync(pgliteDir, { recursive: true });
  }
  const db = await createDb(env.DATABASE_URL !== undefined ? { url: env.DATABASE_URL } : { pgliteDir: pgliteDir! });
  await runMigrations(db);
  const repos = createRepos(db);
  const content = createContentIndex();
  // verified speedruns: no room holds anyone at start, so a running play clock is stale (stopped, the gap not charged)
  const stale = await db.transaction((tx) => repos.runs.stopAll(tx));
  if (stale > 0) log.info({ stale }, 'stale play clocks stopped');

  if (env.ADMIN_BOOTSTRAP_USERNAME !== undefined) {
    const name = env.ADMIN_BOOTSTRAP_USERNAME.toLowerCase();
    await db.transaction(async (tx) => {
      const row = await repos.players.byUsername(tx, name);
      if (row !== null) await repos.players.setAdmin(tx, row.id, true);
      log.info({ username: name, found: row !== null }, 'ADMIN_BOOTSTRAP_USERNAME applied');
    });
  }

  const server = await boot({ env, repos, content, log, clock: Date.now });

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, 'shutting down');
    try {
      await server.stop();
      await db.close();
    } catch (e) {
      log.error({ err: e }, 'shutdown error');
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e: unknown) => {
  console.error('ewa server failed to boot:', e);
  process.exit(1);
});
