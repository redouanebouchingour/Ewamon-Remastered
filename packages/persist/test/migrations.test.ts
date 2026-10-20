import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { runMigrations } from '../src/db';
import { openTestDb } from './helpers';

const EXPECTED_TABLES = [
  'audit_log',
  'badges',
  'battle_history',
  'battle_pass',
  'battle_shares',
  'bids',
  'creature_events',
  'creature_instances',
  'daily_results',
  'dex_entries',
  'email_tokens',
  'friendships',
  'guild_members',
  'guilds',
  'inventory_items',
  'listings',
  'messages',
  'player_streaks',
  'players',
  'quest_progress',
  'refresh_tokens',
  'run_splits',
  'season_results',
  'seasons',
  'story_flags',
  'trade_history',
  'world_honor',
];

const EXPECTED_ENUMS = ['battle_format', 'friendship_status', 'guild_role', 'listing_status', 'slot_kind'];

let db: AnyDb;

beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('migrations (§5.4)', () => {
  it('creates the 18 tables of §5.1 plus email_tokens (0002), player_streaks (0004), battle_shares (0006), creature_events (0007), daily_results (0008), run_splits (0009), seasons and season_results (0011), world_honor (0012)', async () => {
    const rows = await db.transaction(async (tx) => {
      const r = await tx.execute<{ table_name: string }>(
        sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
      );
      return [...r.rows].map((x) => x.table_name).filter((n) => n !== '__drizzle_migrations');
    });
    expect(rows).toEqual(EXPECTED_TABLES);
  });

  it('creates the 5 enums', async () => {
    const rows = await db.transaction(async (tx) => {
      const r = await tx.execute<{ typname: string }>(sql`select typname from pg_type where typtype = 'e' order by typname`);
      return [...r.rows].map((x) => x.typname);
    });
    expect(rows).toEqual(EXPECTED_ENUMS);
  });

  it('carries the slot unique index, the party-slot / hp / level checks and the canonical friendship pair index', async () => {
    const names = await db.transaction(async (tx) => {
      const idx = await tx.execute<{ indexname: string }>(sql`select indexname from pg_indexes where schemaname = 'public'`);
      const ck = await tx.execute<{ conname: string }>(sql`select conname from pg_constraint where contype = 'c'`);
      return { idx: [...idx.rows].map((r) => r.indexname), ck: [...ck.rows].map((r) => r.conname) };
    });
    expect(names.idx).toEqual(expect.arrayContaining(['creature_owner_slot_uq', 'friendships_pair_uq', 'listings_creature_active_uq', 'guild_members_player_uq', 'players_username_lower_uq', 'players_email_uq']));
    expect(names.ck).toEqual(expect.arrayContaining(['creature_level_ck', 'creature_hp_ck', 'creature_party_slot_ck', 'inventory_qty_ck', 'friendship_not_self_ck', 'players_money_ck']));
  });

  it('0002_email_tokens: players.email_verified_at is a nullable timestamptz; email_tokens carries the hash unique index and the kind check', async () => {
    const r = await db.transaction(async (tx) => {
      const col = await tx.execute<{ data_type: string; is_nullable: string }>(
        sql`select data_type, is_nullable from information_schema.columns where table_name = 'players' and column_name = 'email_verified_at'`,
      );
      const cols = await tx.execute<{ column_name: string }>(sql`select column_name from information_schema.columns where table_name = 'email_tokens' order by ordinal_position`);
      const idx = await tx.execute<{ indexname: string }>(sql`select indexname from pg_indexes where tablename = 'email_tokens'`);
      const ck = await tx.execute<{ conname: string }>(sql`select conname from pg_constraint where contype = 'c' and conname = 'email_tokens_kind_ck'`);
      return { col: [...col.rows], cols: [...cols.rows].map((x) => x.column_name), idx: [...idx.rows].map((x) => x.indexname), ck: [...ck.rows].length };
    });
    expect(r.col).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
    expect(r.cols).toEqual(['id', 'player_id', 'kind', 'token_hash', 'expires_at', 'used_at', 'created_at']);
    expect(r.idx).toEqual(expect.arrayContaining(['email_tokens_hash_uq', 'email_tokens_player_kind_idx']));
    expect(r.ck).toBe(1);
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`insert into players (username, username_lower, email, password_hash) values ('kind_probe', 'kind_probe', 'kind@probe.test', 'x')`);
        await tx.execute(sql`insert into email_tokens (player_id, kind, token_hash, expires_at) select id, 'login', 'h', now() from players where username_lower = 'kind_probe'`);
      }),
    ).rejects.toThrow();
  });

  it('is idempotent: running the migrator again is a no-op', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined();
    const n = await db.transaction(async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
      return Number([...r.rows][0]?.n);
    });
    // one row per committed migration (0000_init, 0001_battle_replay, 0002_email_tokens, …), none added by the second run
    const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: unknown[] };
    expect(n).toBe(journal.entries.length);
  });
});

describe('createDb({ pgliteDir }) — dev persistence without Docker', () => {
  it('a PGlite database written to a directory survives close + reopen', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { createDb } = await import('../src/db');
    const dir = mkdtempSync(join(tmpdir(), 'ewa-pglite-'));
    try {
      const a = await createDb({ pgliteDir: dir });
      await runMigrations(a);
      await a.transaction(async (tx) => {
        await tx.execute(sql`insert into players (username, username_lower, email, password_hash) values ('dir_probe', 'dir_probe', 'dir@probe.test', 'x')`);
      });
      await a.close();
      const b = await createDb({ pgliteDir: dir });
      await runMigrations(b);
      const n = await b.transaction(async (tx) => tx.execute(sql`select count(*)::int as n from players where username_lower = 'dir_probe'`));
      expect(Number((n as unknown as { rows: { n: number }[] }).rows[0]!.n)).toBe(1);
      await b.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000); // an on-disk PGlite + migration is slow on Windows (~30 s alone, more under load)
});
