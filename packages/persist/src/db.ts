/**
 * The one place a driver is chosen. `createDb({ url })` opens node-postgres against `url`;
 * `createDb()` opens an in-memory PGlite (dev/test). Everything above this file sees only `Db`
 * and `Tx`, so repositories run byte-identical on both.
 */
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema/index';

export type Schema = typeof schema;

/** §5.2: the one place `any` is permitted — a driver-generic transaction handle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = PgTransaction<any, any, any>;

/** A read-only query handle: a transaction, or the root database for one-off reads. */
export type Queryable = Tx | PgliteDatabase<Schema> | NodePgDatabase<Schema>;

export interface Db {
  readonly kind: 'pg' | 'pglite';
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Releases the pool / PGlite instance. Idempotent. */
  close(): Promise<void>;
}

interface PgDb extends Db {
  readonly kind: 'pg';
  readonly drizzle: NodePgDatabase<Schema>;
  readonly pool: pg.Pool;
}
interface PgliteDb extends Db {
  readonly kind: 'pglite';
  readonly drizzle: PgliteDatabase<Schema>;
  readonly client: PGlite;
}
export type AnyDb = PgDb | PgliteDb;

export interface CreateDbOptions {
  /** postgres:// URL. Omitted → in-memory PGlite. */
  url?: string;
  /** node-postgres pool size (pg only). */
  poolMax?: number;
}

export async function createDb(opts: CreateDbOptions = {}): Promise<AnyDb> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url, max: opts.poolMax ?? 10 });
    const db = drizzlePg({ client: pool, schema });
    let closed = false;
    return {
      kind: 'pg',
      drizzle: db,
      pool,
      transaction: (fn) => db.transaction((tx) => fn(tx)),
      close: async () => {
        if (closed) return;
        closed = true;
        await pool.end();
      },
    };
  }
  const client = await PGlite.create();
  const db = drizzlePglite({ client, schema });
  let closed = false;
  return {
    kind: 'pglite',
    drizzle: db,
    client,
    transaction: (fn) => db.transaction((tx) => fn(tx)),
    close: async () => {
      if (closed) return;
      closed = true;
      await client.close();
    },
  };
}

/** `packages/persist/drizzle` — resolved from this module so it works from src (tsx/vitest) and dist. */
export const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Applies every committed migration under ./drizzle that has not run yet. Idempotent. */
export async function runMigrations(db: AnyDb, migrationsFolder: string = MIGRATIONS_FOLDER): Promise<void> {
  if (db.kind === 'pg') await migratePg(db.drizzle, { migrationsFolder });
  else await migratePglite(db.drizzle, { migrationsFolder });
}
