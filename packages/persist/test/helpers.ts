/**
 * Shared test scaffolding (§5.4): one fresh in-memory PGlite per test file with the committed
 * migration applied through the pglite migrator. When DATABASE_URL is set the same helpers open
 * node-postgres instead, so every test in this folder runs byte-identical against real Postgres.
 */
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDb, runMigrations } from '../src/db';
import type { AnyDb, Tx } from '../src/db';
import { playerRepo } from '../src/repos/players';
import { creatureRepo } from '../src/repos/creatures';
import type { SlotTarget } from '../src/repos/creatures';
import type { CreatureInstance } from '../src/types';
import { isPersistError } from '../src/errors';
import type { PersistErrorCode } from '../src/errors';

export const DATABASE_URL: string | undefined = process.env['DATABASE_URL'];

/** Fixed clock so every timestamp in a test is reproducible. */
export const T0 = new Date('2026-09-18T12:00:00.000Z');
export const at = (offsetMs: number): Date => new Date(T0.getTime() + offsetMs);

const TABLES = [
  'audit_log',
  'refresh_tokens',
  'bids',
  'listings',
  'battle_history',
  'trade_history',
  'battle_pass',
  'guild_members',
  'guilds',
  'messages',
  'friendships',
  'quest_progress',
  'dex_entries',
  'story_flags',
  'badges',
  'inventory_items',
  'creature_instances',
  'players',
] as const;

/** Opens a database with the migration applied. Against a shared Postgres, `reset()` truncates everything first. */
export async function openTestDb(): Promise<AnyDb> {
  const db = await createDb(DATABASE_URL ? { url: DATABASE_URL, poolMax: 32 } : {});
  await runMigrations(db);
  if (DATABASE_URL) await truncateAll(db);
  return db;
}

export async function truncateAll(db: AnyDb): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
  });
}

let seq = 0;

/** Creates a player with a unique name/email; money defaults to the schema default (3000) unless overridden. */
export async function mkPlayer(tx: Tx, name?: string, money?: number): Promise<string> {
  seq += 1;
  const username = name ?? `p${seq}_${randomUUID().slice(0, 6)}`;
  const { id } = await playerRepo.create(tx, { username, email: `${username}@test.local`, passwordHash: 'argon2id$fake' }, T0);
  if (money !== undefined) await playerRepo.addMoney(tx, id, money - 3000);
  return id;
}

export function creatureFixture(ownerId: string, over: Partial<Omit<CreatureInstance, 'id'>> = {}): Omit<CreatureInstance, 'id'> {
  return {
    ownerId,
    speciesId: 'bramblecub',
    nickname: null,
    level: 5,
    exp: 125,
    hp: 22,
    moves: [
      { id: 'tackle', pp: 35, ppMax: 35 },
      { id: 'growl', pp: 40, ppMax: 40 },
    ],
    status: [],
    ability: 'overgrow',
    heldItem: null,
    variantKey: 'normal',
    isAlpha: false,
    caughtAt: null,
    ribbons: [],
    favorite: false,
    locked: false,
    ...over,
  };
}

export async function mkCreature(tx: Tx, ownerId: string, slot: SlotTarget, over: Partial<Omit<CreatureInstance, 'id'>> = {}): Promise<CreatureInstance> {
  return creatureRepo.insert(tx, creatureFixture(ownerId, over), slot);
}

/**
 * Asserts `fn` throws PersistError(code). Only for failures that happen BEFORE any write in the
 * current transaction (pure validation / lock-then-assert paths): a PersistError caught inside a
 * transaction does not roll anything back, so a path that writes first (placeBid refunds the previous
 * bidder before charging the new one) must be exercised through `rejectsInTx` instead.
 */
export async function expectPersistError<T>(code: PersistErrorCode, fn: () => Promise<T>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (isPersistError(e, code)) return;
    throw new Error(`expected PersistError(${code}) but got ${describe(e)}`);
  }
  throw new Error(`expected PersistError(${code}) but nothing was thrown`);
}

/** Runs `fn` in its own transaction and asserts it rejects with PersistError(code) — so every write it made is rolled back. */
export async function rejectsInTx<T>(db: AnyDb, code: PersistErrorCode, fn: (tx: Tx) => Promise<T>): Promise<void> {
  await expectPersistError(code, () => db.transaction(fn));
}

/**
 * Asserts `fn` fails with a database error whose message (or any `cause` up the chain — drizzle wraps
 * driver errors in DrizzleQueryError) matches `pattern`, e.g. a constraint name.
 */
export async function expectDbError(pattern: RegExp, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const messages: string[] = [];
    let cur: unknown = e;
    while (cur instanceof Error) {
      messages.push(cur.message);
      cur = cur.cause;
    }
    if (messages.some((m) => pattern.test(m))) return;
    throw new Error(`expected a database error matching ${pattern} but got: ${messages.join(' <- caused by: ') || String(e)}`);
  }
  throw new Error(`expected a database error matching ${pattern} but nothing was thrown`);
}

function describe(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause instanceof Error ? ` (cause: ${e.cause.message})` : '';
  return `${e.name}: ${e.message}${cause}`;
}

export async function money(tx: Tx, id: string): Promise<number> {
  const row = await playerRepo.byId(tx, id);
  if (!row) throw new Error(`no player ${id}`);
  return row.money;
}
