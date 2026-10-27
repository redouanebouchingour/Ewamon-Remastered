/**
 * The one place the driver is opened: `createDb({ url })` is node-postgres against `url`. Everything above this file
 * sees only `Db` and `Tx`.
 */
import { fileURLToPath } from 'node:url';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema/index';

export type Schema = typeof schema;

/** §5.2: the one place `any` is permitted — a driver-generic transaction handle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = PgTransaction<any, any, any>;

/** A read-only query handle: a transaction, or the root database for one-off reads. */
export type Queryable = Tx | NodePgDatabase<Schema>;

export interface Db {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Releases the pool. Idempotent. */
  close(): Promise<void>;
}

/** The opened database: the `Db` interface plus the drizzle handle and the raw pool (scripts, tests, metrics). */
export interface AnyDb extends Db {
  readonly drizzle: NodePgDatabase<Schema>;
  readonly pool: pg.Pool;
}

export interface CreateDbOptions {
  /** postgres:// URL. */
  url: string;
  /** node-postgres pool size. */
  poolMax?: number;
  /** Runs after the pool has ended (scratch databases drop themselves here). */
  onClose?: () => Promise<void>;
}

export async function createDb(opts: CreateDbOptions): Promise<AnyDb> {
  const pool = new pg.Pool({ connectionString: opts.url, max: opts.poolMax ?? 10 });
  const db = drizzle({ client: pool, schema });
  let closed = false;
  return {
    drizzle: db,
    pool,
    transaction: (fn) => db.transaction((tx) => fn(tx)),
    close: async () => {
      if (closed) return;
      closed = true;
      await pool.end();
      await opts.onClose?.();
    },
  };
}

/** `packages/persist/drizzle` — resolved from this module so it works from src (tsx/vitest) and dist. */
export const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Applies every committed migration under ./drizzle that has not run yet. Idempotent. */
export async function runMigrations(db: AnyDb, migrationsFolder: string = MIGRATIONS_FOLDER): Promise<void> {
  await migrate(db.drizzle, { migrationsFolder });
}
