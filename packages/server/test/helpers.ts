/**
 * Server test scaffolding (§50.4.5): PGlite-backed repos with the committed migration, a controllable clock,
 * a real booted server on ephemeral ports (Colyseus WS + Fastify REST), `@colyseus/sdk` clients.
 */
import { Client as SdkClient } from '@colyseus/sdk';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { createContentIndex } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import { ZoneState } from '@ewa/protocol';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { canonicalJson } from '@ewa/core';
import { testEnv } from '../src/env';
import type { Env } from '../src/env';
import { silentLogger } from '../src/log';
import { boot } from '../src/server';
import type { Booted } from '../src/server';

/**
 * @colyseus/core's Stats module dynamically imports `@pm2/io`, whose IPC transport calls `process.send`
 * whenever it exists. Inside vitest's forks pool that channel is vitest's own RPC, which cannot decode the
 * `axm:*` messages and fails the run. Drop exactly those messages; everything else passes through.
 */
const originalSend = process.send?.bind(process);
if (originalSend !== undefined) {
  process.send = ((msg: unknown, ...rest: unknown[]) => {
    const type = (msg as { type?: unknown } | null)?.type;
    if (typeof type === 'string' && type.startsWith('axm:')) return true;
    return (originalSend as (...a: unknown[]) => boolean)(msg, ...rest);
  }) as typeof process.send;
}

export const content = createContentIndex();

export async function openRepos(): Promise<{ db: AnyDb; repos: Repos & { readonly db: Db } }> {
  const db = await createDb();
  await runMigrations(db);
  return { db, repos: createRepos(db) };
}

/** Wall clock + a test-controlled offset (deadlines/timeouts are driven by advancing it). */
export function offsetClock(): { clock: () => number; advance(ms: number): void } {
  let offset = 0;
  return { clock: () => Date.now() + offset, advance: (ms) => void (offset += ms) };
}

export interface TestServer {
  readonly booted: Booted;
  readonly db: AnyDb;
  readonly repos: Repos & { readonly db: Db };
  readonly time: { clock: () => number; advance(ms: number): void };
  readonly wsUrl: string;
  stop(): Promise<void>;
}

export async function startServer(envOverrides: Partial<Env> = {}): Promise<TestServer> {
  const { db, repos } = await openRepos();
  const time = offsetClock();
  const env = testEnv({ PORT_WS: 0, PORT_REST: 0, ...envOverrides });
  const booted = await boot({ env, repos, content, log: silentLogger(), clock: time.clock });
  return {
    booted,
    db,
    repos,
    time,
    wsUrl: `ws://127.0.0.1:${booted.ports.ws}`,
    async stop() {
      await booted.stop();
      await db.close();
    },
  };
}

export interface Account {
  readonly id: string;
  readonly username: string;
  access: string;
  refresh: string;
}

let seq = 0;
export function uniqueName(prefix = 'p'): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36).slice(-5)}${seq}`.toLowerCase().slice(0, 20);
}

export async function register(s: TestServer, starter: 'bramblecub' | 'glimfin' | 'cindercap' = 'bramblecub', name = uniqueName()): Promise<Account> {
  const res = await s.booted.rest.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { username: name, email: `${name}@test.ewa`, password: 'correct horse battery', starter },
    remoteAddress: `10.0.${seq % 250}.${(seq * 7) % 250}`,
  });
  if (res.statusCode !== 200) throw new Error(`register failed ${res.statusCode}: ${res.body}`);
  const body = res.json() as { access: string; refresh: string; player: { id: string; username: string } };
  return { id: body.player.id, username: body.player.username, access: body.access, refresh: body.refresh };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON response bodies are asserted field by field
export async function api(s: TestServer, method: 'GET' | 'POST', url: string, token: string | null, payload?: unknown): Promise<{ status: number; body: any }> {
  const res = await s.booted.rest.inject({
    method,
    url,
    ...(payload !== undefined ? { payload: payload as object } : {}),
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });
  return { status: res.statusCode, body: res.body.length > 0 ? res.json() : null };
}

/** Moves the player's persisted position (setup only — tests never do this through the wire). */
export async function placePlayer(s: TestServer, id: string, zoneId: ZoneId, x: number, z: number): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.players.setPosition(tx, id, zoneId, x, z, 0));
}

export interface Joined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's room-type parameter (server room class) is irrelevant here
  readonly room: SdkRoom<any, ZoneState>;
  readonly msgs: ServerMessage[];
  readonly left: { code: number | null };
  readonly sdk: SdkClient;
}

export async function joinSeat(s: TestServer, token: string, seat: SeatReservation): Promise<Joined> {
  const sdk = new SdkClient(s.wsUrl);
  sdk.auth.token = token;
  const room = (await sdk.consumeSeatReservation(seat as never, ZoneState)) as Joined['room'];
  const msgs: ServerMessage[] = [];
  const left = { code: null as number | null };
  room.onMessage('*', (_type: string | number, payload: unknown) => void msgs.push(payload as ServerMessage));
  room.onLeave((code: number) => void (left.code = code));
  return { room, msgs, left, sdk };
}

export async function enter(s: TestServer, acc: Account, zoneId: ZoneId): Promise<Joined> {
  const r = await api(s, 'POST', '/zone/enter', acc.access, { zoneId });
  if (r.status !== 200) throw new Error(`zone/enter ${r.status}: ${JSON.stringify(r.body)}`);
  const j = await joinSeat(s, acc.access, r.body.seat as SeatReservation);
  await waitFor(() => j.room.state.players?.get(acc.id) !== undefined, 5000);
  return j;
}

export async function waitFor(pred: () => boolean, timeoutMs = 5000, stepMs = 10): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Messages of one type received so far. */
export function ofType<T extends ServerMessage['type']>(msgs: readonly ServerMessage[], type: T): Extract<ServerMessage, { type: T }>[] {
  return msgs.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
}

const SNAPSHOT_TABLES = ['players', 'creature_instances', 'inventory_items', 'badges', 'story_flags', 'dex_entries', 'quest_progress', 'battle_pass'] as const;

/**
 * §50.4.5 authority snapshot: canonicalJson of the attacker's rows in every progression table.
 * `last_seen_at` is excluded (the spec allows it to change).
 */
export async function snapshot(s: TestServer, playerId: string): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const t of SNAPSHOT_TABLES) {
    const col = t === 'players' ? 'id' : t === 'creature_instances' ? 'owner_id' : 'player_id';
    const res = await rawQuery(s.db, `select * from "${t}" where "${col}" = $1 order by 1, 2`, [playerId]);
    out[t] = JSON.parse(
      JSON.stringify(
        res.map((r) => {
          const { last_seen_at: _l, ...rest } = r;
          return rest;
        }),
      ),
    );
  }
  return canonicalJson(out);
}

/** Raw SQL for assertions (PGlite client or pg pool) — tests only. */
export async function rawQuery(db: AnyDb, text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const res = db.kind === 'pglite' ? await db.client.query(text, params) : await db.pool.query(text, params);
  return res.rows as Record<string, unknown>[];
}
