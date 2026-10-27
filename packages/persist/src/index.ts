/**
 * @ewa/persist — the Postgres truth. Drizzle schema (§5.1), the Db/Tx handles (§5.2),
 * repositories with explicit transaction handles and explicit clocks, and the migration runner.
 *
 * Nothing here decides game rules: money, exp and catches are computed by the server from @ewa/core
 * and merely written here under row locks.
 */
export * as schema from './schema/index';
export * from './schema/index';

export { createDb, runMigrations, MIGRATIONS_FOLDER } from './db';
export type { AnyDb, CreateDbOptions, Db, Queryable, Schema, Tx } from './db';
export { DEV_DATABASE_URL, dropScratchDbs, ensureDatabase, openScratchDb, testDatabaseUrl, withDatabase } from './scratch';

export { PersistError, fail, isPersistError } from './errors';
export type { PersistErrorCode } from './errors';

export * from './types';
export * from './constants';
export { escapeLike, sortIds, clampInt } from './util';

export * from './repos/index';
