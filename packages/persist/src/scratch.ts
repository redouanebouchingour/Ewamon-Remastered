/**
 * Databases on a Postgres server that this code creates itself: the dev database (`ensureDatabase`) and the
 * throwaway ones tests run on (`openScratchDb`). A scratch database is a copy of a template that already holds every
 * committed migration (`ewa_tpl_<hash of ./drizzle>`, built once per migration set under an advisory lock), so a test
 * file gets an isolated, migrated database in one `CREATE DATABASE … TEMPLATE` and test files keep running in
 * parallel. `close()` drops it again.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import pg from 'pg';
import { MIGRATIONS_FOLDER, createDb, runMigrations } from './db';
import type { AnyDb } from './db';

/** The dev database: the `postgres` service of docker-compose.yml, published on localhost:5432. */
export const DEV_DATABASE_URL = 'postgres://ewa:ewa@localhost:5432/ewa';

/** Where tests create their scratch databases: `EWA_TEST_DATABASE_URL`, else the dev server. */
export function testDatabaseUrl(): string {
  return process.env['EWA_TEST_DATABASE_URL'] ?? DEV_DATABASE_URL;
}

const SCRATCH_PREFIX = 'ewa_t_';
const TEMPLATE_PREFIX = 'ewa_tpl_';
/** pg_advisory_lock key for building the template (any constant; "ewa" in ASCII). */
const TEMPLATE_LOCK = 0x657761;
/** Scratch databases a crashed run left behind are dropped once they are this old. */
const STALE_MS = 6 * 60 * 60 * 1000;

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${encodeURIComponent(name)}`;
  return u.toString();
}

function ident(name: string): string {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(name)) throw new Error(`refusing database name ${JSON.stringify(name)}`);
  return `"${name}"`;
}

/** Runs `fn` on a single connection to the server's `postgres` maintenance database. */
async function onServer<T>(url: string, fn: (c: pg.Client) => Promise<T>, connectTimeoutMs?: number): Promise<T> {
  const c = new pg.Client({ connectionString: withDatabase(url, 'postgres'), ...(connectTimeoutMs !== undefined ? { connectionTimeoutMillis: connectTimeoutMs } : {}) });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** A LIKE pattern for every name starting with `prefix` (`_` is a LIKE wildcard, so it is escaped). */
function startsWith(prefix: string): string {
  return `${prefix.replaceAll('_', '\\_')}%`;
}

async function exists(c: pg.Client, name: string): Promise<boolean> {
  const r = await c.query('select 1 from pg_database where datname = $1', [name]);
  return (r.rowCount ?? 0) > 0;
}

/** Creates the database `url` names when the server does not have it yet (dev servers; needs CREATEDB). */
export async function ensureDatabase(url: string): Promise<void> {
  const name = databaseName(url);
  await onServer(url, async (c) => {
    if (await exists(c, name)) return;
    try {
      await c.query(`create database ${ident(name)}`);
    } catch (e) {
      if ((e as { code?: string }).code !== '42P04') throw e; // duplicate_database: someone else won the race
    }
  });
}

/** The template's name: a hash over every file in ./drizzle, so a new migration builds a new template. */
function templateName(): string {
  const h = createHash('sha256');
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(e.name).update(readFileSync(p));
    }
  };
  walk(MIGRATIONS_FOLDER);
  return `${TEMPLATE_PREFIX}${h.digest('hex').slice(0, 16)}`;
}

async function ensureTemplate(base: string): Promise<string> {
  const template = templateName();
  await onServer(base, async (c) => {
    await c.query('select pg_advisory_lock($1)', [TEMPLATE_LOCK]);
    try {
      if (await exists(c, template)) return;
      const old = await c.query<{ datname: string }>(`select datname from pg_database where datname like $1`, [startsWith(TEMPLATE_PREFIX)]);
      for (const r of old.rows) await c.query(`drop database if exists ${ident(r.datname)} with (force)`);
      // built under another name and renamed when complete, so a failed build never leaves a half-migrated template
      const building = `${template}_b`;
      await c.query(`create database ${ident(building)}`);
      const db = await createDb({ url: withDatabase(base, building), poolMax: 1 });
      try {
        await runMigrations(db);
      } finally {
        await db.close();
      }
      await c.query(`alter database ${ident(building)} rename to ${ident(template)}`);
    } finally {
      await c.query('select pg_advisory_unlock($1)', [TEMPLATE_LOCK]);
    }
  });
  return template;
}

/** `ewa_t_<run>_<random>`; the run id is a base-36 timestamp, set once per vitest run by `vitest.setup-db.ts`. */
function scratchName(): string {
  const run = process.env['EWA_TEST_RUN'] ?? Date.now().toString(36);
  return `${SCRATCH_PREFIX}${run}_${randomBytes(6).toString('hex')}`;
}

/**
 * A fresh, fully migrated database of its own on the test server (`testDatabaseUrl()` unless `url` is given).
 * `close()` ends the pool and drops the database.
 */
export async function openScratchDb(opts: { readonly url?: string; readonly poolMax?: number } = {}): Promise<AnyDb> {
  const base = opts.url ?? testDatabaseUrl();
  const template = await ensureTemplate(base);
  const name = scratchName();
  await onServer(base, async (c) => {
    // a copy needs the template to have no open sessions; another file's build or copy can hold it for a moment
    for (let attempt = 0; ; attempt++) {
      try {
        await c.query(`create database ${ident(name)} template ${ident(template)}`);
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== '55006' || attempt >= 20) throw e; // object_in_use
        await new Promise((res) => setTimeout(res, 50 + attempt * 50));
      }
    }
  });
  return createDb({
    url: withDatabase(base, name),
    poolMax: opts.poolMax ?? 10,
    onClose: () => onServer(base, async (c) => void (await c.query(`drop database if exists ${ident(name)} with (force)`))),
  });
}

/**
 * Drops the scratch databases of run `run` and every scratch database older than six hours (a crashed run's).
 * Quietly does nothing when the server cannot be reached: a run that touched no database needs none.
 */
export async function dropScratchDbs(run: string, url: string = testDatabaseUrl()): Promise<void> {
  try {
    await onServer(
      url,
      async (c) => {
        const r = await c.query<{ datname: string }>(`select datname from pg_database where datname like $1`, [startsWith(SCRATCH_PREFIX)]);
        for (const { datname } of r.rows) {
          const id = datname.slice(SCRATCH_PREFIX.length).split('_')[0] ?? '';
          const born = parseInt(id, 36);
          if (id === run || !Number.isFinite(born) || Date.now() - born > STALE_MS) await c.query(`drop database if exists ${ident(datname)} with (force)`);
        }
      },
      2_000,
    );
  } catch {
    // no server running: nothing to clean
  }
}
