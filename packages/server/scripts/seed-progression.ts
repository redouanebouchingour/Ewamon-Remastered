/**
 * B6 — seed a dev account with a progression-walk fixture, so a browser session can start at Act II / III in
 * minutes instead of replaying the story.
 *
 * The fixtures are the end states the headless walk writes (packages/server/test/fixtures/progression/<leg>.json,
 * `pnpm test:progression` with EWA_PROGRESSION_WRITE=1): the player's rows in the eight progression tables.
 *
 *   leg     ends at        holds
 *   act1    tide_route     3 badges (bloom ember current), Act I done
 *   act2    siege_route    7 badges, Act II done, raikitsune / galaxion / bankaiser beaten
 *   act3a   solenne        8 badges, the Wardens + Champion beaten (the title)
 *   act3b   the_rift       + zenryu, glacinid, voidraxis
 *   act3c   mire_route     everything: all 33 beats, 8 statics, every league row
 *
 * Usage (stop the dev server first when it runs on PGlite — a PGlite directory has one writer):
 *
 *   pnpm --filter @ewa/server seed:progression <leg> <username> [--password <pw>]
 *
 *   # e.g. the default dev server (PGlite at packages/server/.data/pglite):
 *   pnpm --filter @ewa/server seed:progression act2 ash
 *   # the alt dev server of .claude/launch.json (PGlite at packages/server/.data-alt/pglite):
 *   DATA_DIR=.data-alt pnpm --filter @ewa/server seed:progression act3a ash
 *   # Postgres:
 *   DATABASE_URL=postgres://… pnpm --filter @ewa/server seed:progression act1 ash
 *
 * `<username>` exists → its progression is REPLACED by the fixture's (party, box, bag, money, badges, story flags,
 * dex, quests, battle pass, position); the login, appearance, admin bit and history stay. `<username>` does not
 * exist → the account is created (email `<username>@dev.ewa`, password `--password` or the walk's default
 * `correct horse battery`). DATA_DIR is resolved from the package directory (pnpm --filter runs scripts there),
 * like the server's own default `./.data`. Creature ids are fresh uuids, so one fixture can seed several accounts.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, runMigrations } from '@ewa/persist';
import type { AnyDb } from '@ewa/persist';
import { hashPassword } from '../src/rest/auth';

const LEGS = ['act1', 'act2', 'act3a', 'act3b', 'act3c'] as const;
type Leg = (typeof LEGS)[number];
/** the per-player tables a fixture carries besides `players` (all keyed by `player_id`, creatures by `owner_id`) */
const TABLES = ['creature_instances', 'inventory_items', 'badges', 'story_flags', 'dex_entries', 'quest_progress', 'battle_pass'] as const;
/** the `players` columns that are progression (copied from the fixture); login, look, admin and history stay */
const PLAYER_PROGRESS = ['money', 'zone_id', 'x', 'z', 'angle', 'title', 'trainer_exp'] as const;
const DEFAULT_PASSWORD = 'correct horse battery';

interface Fixture {
  readonly leg: Leg;
  readonly username: string;
  readonly rows: Record<'players' | (typeof TABLES)[number], Record<string, unknown>[]>;
}

type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const HERE = dirname(fileURLToPath(import.meta.url));

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`seed-progression: ${msg}`);
  console.error(`usage: seed-progression <${LEGS.join('|')}> <username> [--password <pw>]  (env: DATA_DIR | DATABASE_URL)`);
  process.exit(2);
}

function parseArgs(argv: readonly string[]): { leg: Leg; username: string; password: string } {
  const pos: string[] = [];
  let password = DEFAULT_PASSWORD;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') continue;
    if (a === '--password') {
      const v = argv[++i];
      if (v === undefined) usage('--password needs a value');
      password = v;
    } else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else pos.push(a);
  }
  const [leg, username] = pos;
  if (leg === undefined || username === undefined || pos.length > 2) usage();
  if (!(LEGS as readonly string[]).includes(leg)) usage(`unknown leg '${leg}'`);
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) usage(`'${username}' is not a valid username (3–20 letters, digits, _)`);
  return { leg: leg as Leg, username, password };
}

/** One SQL transaction over the raw client (PGlite or a pooled pg connection). */
async function inTransaction<T>(db: AnyDb, fn: (q: Query) => Promise<T>): Promise<T> {
  if (db.kind === 'pglite') {
    return db.client.transaction(async (tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows as Record<string, unknown>[]));
  }
  const conn = await db.pool.connect();
  try {
    await conn.query('begin');
    const out = await fn(async (text, params = []) => (await conn.query(text, params)).rows as Record<string, unknown>[]);
    await conn.query('commit');
    return out;
  } catch (e) {
    await conn.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * The walk's server clock runs ahead of the wall clock (it is advanced for the rate-limit windows), so a fixture can
 * hold timestamps in the future. Every timestamp is shifted by the same amount so the latest is now (order kept:
 * GET /me lists badges by earned_at; flag times drive rematch windows).
 */
function shiftToNow(fx: Fixture, now: number): Fixture {
  let latest = 0;
  for (const rows of Object.values(fx.rows)) for (const r of rows) for (const v of Object.values(r)) if (typeof v === 'string' && ISO_TS.test(v)) latest = Math.max(latest, Date.parse(v));
  if (latest <= now) return fx;
  const d = latest - now;
  const shift = (r: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && ISO_TS.test(v) ? new Date(Date.parse(v) - d).toISOString() : v]));
  return { ...fx, rows: Object.fromEntries(Object.entries(fx.rows).map(([t, rows]) => [t, rows.map(shift)])) as Fixture['rows'] };
}

/** JSON columns (moves, status, ribbons, …) go in as JSON text; everything else verbatim. */
function sqlValue(v: unknown): unknown {
  return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}

async function columnsOf(q: Query, table: string): Promise<Set<string>> {
  const rows = await q(`select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1`, [table]);
  return new Set(rows.map((r) => String(r['column_name'])));
}

async function insertRow(q: Query, table: string, live: ReadonlySet<string>, row: Record<string, unknown>): Promise<void> {
  // columns the live schema no longer has are dropped; columns it gained take their defaults
  const cols = Object.keys(row).filter((c) => live.has(c));
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  await q(`insert into "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${ph})`, cols.map((c) => sqlValue(row[c])));
}

async function main(): Promise<void> {
  const { leg, username, password } = parseArgs(process.argv.slice(2));
  const file = join(HERE, '..', 'test', 'fixtures', 'progression', `${leg}.json`);
  let fx: Fixture;
  try {
    fx = shiftToNow(JSON.parse(readFileSync(file, 'utf8')) as Fixture, Date.now());
  } catch {
    usage(`no fixture ${file} — record it with EWA_PROGRESSION_WRITE=1 pnpm test:progression progression-${leg}`);
  }
  const src = fx.rows.players[0];
  if (src === undefined) usage(`${file} has no players row`);

  const url = process.env['DATABASE_URL'];
  let where: string;
  let db: AnyDb;
  if (url !== undefined && url !== '') {
    db = await createDb({ url });
    where = 'postgres (DATABASE_URL)';
  } else {
    const dir = resolve(process.env['DATA_DIR'] ?? './.data', 'pglite');
    mkdirSync(dir, { recursive: true });
    db = await createDb({ pgliteDir: dir });
    where = `PGlite ${dir}`;
  }
  try {
    await runMigrations(db);
    const pwHash = await hashPassword(password);
    const result = await inTransaction(db, async (q) => {
      const found = await q('select id from players where username_lower = $1', [username.toLowerCase()]);
      let id: string;
      let created = false;
      if (found.length === 0) {
        id = randomUUID();
        created = true;
        const live = await columnsOf(q, 'players');
        const now = new Date().toISOString();
        await insertRow(q, 'players', live, {
          ...src,
          id,
          username,
          username_lower: username.toLowerCase(),
          email: `${username.toLowerCase()}@dev.ewa`,
          password_hash: pwHash,
          is_admin: false,
          banned_at: null,
          ban_reason: null,
          created_at: now,
          last_seen_at: now,
        });
      } else {
        id = String(found[0]!['id']);
        const cols = PLAYER_PROGRESS.filter((c) => c in src);
        await q(`update players set ${cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ')} where id = $1`, [id, ...cols.map((c) => sqlValue(src[c]))]);
      }
      for (const t of TABLES) {
        const key = t === 'creature_instances' ? 'owner_id' : 'player_id';
        await q(`delete from "${t}" where "${key}" = $1`, [id]);
        const live = await columnsOf(q, t);
        for (const row of fx.rows[t] ?? []) {
          const r: Record<string, unknown> = { ...row, [key]: id };
          if (t === 'creature_instances') {
            r['id'] = randomUUID();
            // the walk's own catches name the walk's account as their original trainer (migration 0007): this one now
            if (r['original_trainer_id'] === src['id']) {
              r['original_trainer_id'] = id;
              r['original_trainer_name'] = username;
            }
          }
          await insertRow(q, t, live, r);
        }
      }
      return { id, created };
    });
    const badges = fx.rows.badges.map((b) => String(b['badge_id']));
    const party = fx.rows.creature_instances.filter((c) => c['slot_kind'] === 'party').sort((a, b) => Number(a['slot_index']) - Number(b['slot_index']));
    console.log(
      [
        `seeded '${username}' (${result.created ? `created, password '${password}'` : 'existing account, progression replaced'}) with fixture ${leg} in ${where}`,
        `  zone ${String(src['zone_id'])} at (${String(src['x'])}, ${String(src['z'])}), money ${String(src['money'])}`,
        `  badges (${badges.length}) ${badges.join(' ') || '—'}`,
        `  story flags ${fx.rows.story_flags.length}, creatures ${fx.rows.creature_instances.length}`,
        `  party ${party.map((c) => `${String(c['species_id'])} L${String(c['level'])}`).join(', ')}`,
      ].join('\n'),
    );
  } finally {
    await db.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
