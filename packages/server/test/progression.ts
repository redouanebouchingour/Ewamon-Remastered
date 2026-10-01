/**
 * The M3 progression walk (SPEC §50.5 M3: "an account walks mirevale → the_rift following gates, clears all 12
 * league trainers; GET /me shows 8 badges and flags containing the champion flag set by zeon"), as five legs so
 * vitest runs them in parallel (the walk is real-time bound: the movement budget refills per server tick):
 *
 *   act1   mirevale → tide_route     b1–b9, Mira, Karn, Maren                     fresh account
 *   act2   tide_route → siege_route  b10–b23, Zia, Petra, Nyx, Rell; 3 statics    fixture act1
 *   act3a  siege_route → solenne     b24–b26, b28–b32, Sylvane, 3 Wardens, Zeon   fixture act2
 *   act3b  solenne → the_rift        b33; zenryu, glacinid, voidraxis             fixture act3a
 *   act3c  the_rift → mire_route     b27; voltaura, sunjaw; the final GET /me     fixture act3b
 *
 * Each leg starts from the snapshot the previous leg's own run wrote (`fixtures/progression/<leg>.json`: the
 * player's rows in the eight progression tables, loaded verbatim), walks with the real server, and ends by
 * comparing its end state (zone, badges, story flags) with the committed snapshot of its own end — so a committed
 * fixture is always what the previous leg produces. `EWA_PROGRESSION_WRITE=1` rewrites the leg's end snapshot
 * (run the legs one after another when regenerating).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { LEAGUE, STORY, beatDoneFlag, league, playableBounds, storyBeat } from '@ewa/content';
import type { LeagueTrainer, LinkDir, ZoneId } from '@ewa/content';
import { TRAINER_EXP } from '@ewa/core';
import { api, rawQuery, register, startServer, storyOnly } from './helpers';
import type { TestServer } from './helpers';
import { Walker, ofTypeIn } from './walker';
import type { FightResult, Msg } from './walker';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixtures', 'progression');
const PASSWORD = 'correct horse battery';
const TABLES = ['players', 'creature_instances', 'inventory_items', 'badges', 'story_flags', 'dex_entries', 'quest_progress', 'battle_pass'] as const;

export type Leg = 'act1' | 'act2' | 'act3a' | 'act3b' | 'act3c';

export interface Snapshot {
  readonly leg: Leg;
  readonly username: string;
  readonly rows: Record<(typeof TABLES)[number], Record<string, unknown>[]>;
}

export async function walkServer(): Promise<TestServer> {
  // one leg runs for several minutes of wall time; a one-hour access token keeps every handover's onAuth valid
  return startServer({ JWT_ACCESS_TTL_S: 3600 });
}

// ─── snapshots ────────────────────────────────────────────────────────────────

export async function snapshotOf(s: TestServer, playerId: string, leg: Leg, username: string): Promise<Snapshot> {
  const rows = {} as Snapshot['rows'];
  for (const t of TABLES) {
    const col = t === 'players' ? 'id' : t === 'creature_instances' ? 'owner_id' : 'player_id';
    rows[t] = JSON.parse(JSON.stringify(await rawQuery(s.db, `select * from "${t}" where "${col}" = $1 order by 1, 2`, [playerId]))) as Record<string, unknown>[];
  }
  return { leg, username, rows };
}

/** Inserts a snapshot's rows verbatim into a fresh database (the leg boundary; nothing else writes rows). */
export async function loadSnapshot(s: TestServer, snap: Snapshot): Promise<void> {
  for (const t of TABLES) {
    for (const row of snap.rows[t]) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const v = row[c];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
      });
      await rawQuery(s.db, `insert into "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
    }
  }
}

export function readFixture(leg: Leg): Snapshot {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${leg}.json`), 'utf8')) as Snapshot;
}

interface Signature {
  readonly zone: string;
  readonly badges: readonly string[];
  readonly flags: readonly string[];
}

function signatureOf(snap: Snapshot): Signature {
  return {
    zone: String(snap.rows.players[0]!['zone_id']),
    badges: snap.rows.badges.map((b) => String(b['badge_id'])).sort(),
    flags: storyOnly(snap.rows.story_flags.map((f) => f['flag'])).sort(),
  };
}

/** The leg's end: its snapshot must match the committed one (or replace it with EWA_PROGRESSION_WRITE=1). */
export async function finishLeg(w: Walker, leg: Leg): Promise<void> {
  await w.leave();
  const snap = await snapshotOf(w.s, w.playerId, leg, w.name);
  const file = join(FIXTURE_DIR, `${leg}.json`);
  if (process.env['EWA_PROGRESSION_WRITE'] === '1' || !existsSync(file)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(file, `${JSON.stringify(snap, null, 1)}\n`);
    w.note(`wrote ${leg}.json`);
    return;
  }
  expect(signatureOf(snap)).toEqual(signatureOf(readFixture(leg)));
}

/** A fresh account (register = the client's sign-up) or the previous leg's snapshot, logged in and entered. */
export async function startLeg(s: TestServer, from: Leg | null): Promise<Walker> {
  let w: Walker;
  if (from === null) {
    const acc = await register(s, 'cindercap');
    w = new Walker(s, acc.id, acc.access, acc.refresh, acc.username);
  } else {
    const snap = readFixture(from);
    await loadSnapshot(s, snap);
    const r = await s.booted.rest.inject({ method: 'POST', url: '/auth/login', payload: { username: snap.username, password: PASSWORD } });
    if (r.statusCode !== 200) throw new Error(`login ${r.statusCode}: ${r.body}`);
    const body = r.json() as { access: string; refresh: string; player: { id: string; username: string } };
    w = new Walker(s, body.player.id, body.access, body.refresh, body.player.username);
  }
  await w.enter();
  return w;
}

// ─── assertions over the room's answers ──────────────────────────────────────

async function storyFlags(w: Walker): Promise<string[]> {
  return storyOnly((await rawQuery(w.s.db, 'select flag from story_flags where player_id = $1', [w.playerId])).map((r) => r['flag']));
}

async function badgeRows(w: Walker): Promise<string[]> {
  return (await rawQuery(w.s.db, 'select badge_id from badges where player_id = $1 order by earned_at', [w.playerId])).map((r) => String(r['badge_id']));
}

/** Heals first: in a healer zone at once, otherwise over the `via` edge and back. */
async function fresh(w: Walker, via: LinkDir | 'here'): Promise<void> {
  if (via === 'here' || w.zone.healer) await w.heal();
  else await w.healTrip(via);
}

/**
 * Plays beat `beatId` by facing its speaker (or, rule 6, its story trainer): `storyBeat start`, its battle (won)
 * when it has one, `storyBeat complete`, and the beat's `set` flags + done flag in `story_flags`.
 */
export async function playBeat(w: Walker, beatId: string, opts: { readonly target?: string; readonly heal?: LinkDir | 'here' } = {}): Promise<FightResult | null> {
  const beat = storyBeat(beatId);
  expect(beat.zoneId, `${beatId} is played in its zone`).toBe(w.zoneId);
  const isLeague = LEAGUE.some((l) => l.id === beat.speaker);
  const target = opts.target ?? beat.speaker;
  if (beat.battle !== null) {
    await fresh(w, opts.heal ?? 'here');
    const trainer = w.zone.trainers.find((t) => t.id === beat.battle!.trainerId)!;
    await w.leadFor(trainer.team);
  }
  await w.goTo(isLeague ? 'gym' : 'npc', target);
  const out = await w.interact(isLeague ? 'gym' : 'npc', target);
  expect(ofTypeIn(out, 'storyBeat')[0], `${beatId} starts at ${target}`).toMatchObject({ beatId, phase: 'start' });
  let fight: FightResult | null = null;
  if (beat.battle !== null) {
    fight = await w.fight();
    expect(fight.start.format).toBe('trainer');
    expect(fight.start.state.sides[1].trainerId).toBe(beat.battle.trainerId);
    const trainer = w.zone.trainers.find((t) => t.id === beat.battle!.trainerId)!;
    expect(fight.start.state.sides[1].party.map((b) => `${b.creature.speciesId}:${b.creature.level}`)).toEqual(trainer.team.map((m) => `${m.species}:${m.level}`));
    expect(fight.end.outcome, `${beatId}: the story battle is won`).toEqual({ winner: 0 });
    expect(fight.end.rewards).toMatchObject({ money: trainer.reward, trainerExp: TRAINER_EXP.trainerWin });
  }
  const done = [...(fight?.after ?? []), ...out];
  const completed = done.some((m) => m.type === 'storyBeat' && m.beatId === beatId && m.phase === 'complete') || w.msgs.some((m) => m.type === 'storyBeat' && m.beatId === beatId && m.phase === 'complete');
  expect(completed, `${beatId} completes`).toBe(true);
  const flags = await storyFlags(w);
  for (const f of [...beat.set, beatDoneFlag(beatId)]) expect(flags, `${beatId} sets ${f}`).toContain(f);
  w.note(`beat ${beatId} ✓`);
  return fight;
}

/** A league interaction the story gate refuses: the toast, `leagueLocked`, nothing written. */
export async function expectLocked(w: Walker, leagueId: string): Promise<void> {
  const lt = league(leagueId);
  await w.goTo('gym', leagueId);
  const before = await storyFlags(w);
  const out = await w.interact('gym', leagueId);
  expect(ofTypeIn(out, 'toast').map((t) => t.text)).toEqual([`${lt.name} is not taking challengers yet.`]);
  expect(ofTypeIn(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'leagueLocked' }]);
  expect(ofTypeIn(out, 'battleStart')).toEqual([]);
  expect(await storyFlags(w)).toEqual(before);
  w.note(`${leagueId} refused before its story gate ✓`);
}

/** The league battle at the marker: format league, the team verbatim, won; badge / flags / rewards from the room. */
export async function winLeague(w: Walker, leagueId: string): Promise<FightResult> {
  const lt: LeagueTrainer = league(leagueId);
  await w.heal();
  await w.leadFor(lt.team);
  await w.goTo('gym', leagueId);
  const moneyBefore = await w.money();
  const out = await w.interact('gym', leagueId);
  expect(ofTypeIn(out, 'storyBeat'), `${leagueId}: no beat left before the fight`).toEqual([]);
  const r = await w.fight();
  expect(r.start.format).toBe('league');
  expect(r.start.state.sides[1].trainerId).toBe(leagueId);
  expect(r.start.state.sides[1].party.map((b) => [b.creature.speciesId, b.creature.level, b.creature.nickname])).toEqual(lt.team.map((m) => [m.species, m.level, m.nickname]));
  expect(r.end.outcome, `${leagueId} is beaten`).toEqual({ winner: 0 });
  const exp = lt.stage === 'gym' ? TRAINER_EXP.gymWin : lt.stage === 'elite' ? TRAINER_EXP.eliteWin : TRAINER_EXP.championWin;
  expect(r.end.rewards).toMatchObject({ money: lt.reward, trainerExp: exp, badge: lt.badge });
  expect(await w.money()).toBeGreaterThanOrEqual(moneyBefore + lt.reward);
  if (lt.badge !== null) {
    expect(await badgeRows(w)).toContain(lt.badge);
    const prog = [...r.after, ...w.msgs].find((m): m is Extract<Msg, { type: 'progressionDelta' }> => m.type === 'progressionDelta' && m.badges !== null && m.badges.includes(lt.badge!));
    expect(prog, `${leagueId}: progressionDelta.badges`).toBeDefined();
  }
  const flags = await storyFlags(w);
  for (const f of [...lt.setsFlags, ...(lt.id === 'zeon' ? ['champion:zeon:beaten'] : [])]) expect(flags).toContain(f);
  w.note(`league ${leagueId} ✓ (turns so far ${w.stats.turns})`);
  return r;
}

/** A legendary static: refused unless its gate holds (checked by the room), a `wild` battle that cannot be fled, won. */
export async function winStatic(w: Walker, species: string, via: LinkDir | 'here'): Promise<void> {
  await fresh(w, via);
  await w.goTo('static', species);
  const out = await w.interact('static', species);
  expect(ofTypeIn(out, 'error'), `${species}: its gate holds`).toEqual([]);
  const r = await w.fight();
  expect(r.start.format).toBe('wild');
  expect(r.start.state.sides[0].canFlee).toBe(false);
  expect(r.start.state.sides[1].party[0]!.creature.speciesId).toBe(species);
  expect(r.end.outcome, `${species} is beaten`).toEqual({ winner: 0 });
  const flags = await storyFlags(w);
  expect(flags).toContain(`leg_${species}`);
  // the static is gone for this player once its flag is held
  const again = await w.interact('static', species);
  expect(ofTypeIn(again, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'staticLocked' });
  w.note(`static ${species} ✓`);
}

/** Walks to a spot a few metres inside the `dir` edge (training beside a healer town keeps heal trips short). */
export async function nearEdge(w: Walker, dir: LinkDir): Promise<void> {
  const b = playableBounds(w.h);
  const me = w.me();
  const inset = 9;
  const x = dir === 'e' ? b.maxX - inset : dir === 'w' ? b.minX + inset : me.x;
  const z = dir === 's' ? b.maxZ - inset : dir === 'n' ? b.minZ + inset : me.z;
  await w.walk({ kind: 'point', x, z, radius: 4 });
}

export async function assertMe(w: Walker, want: { readonly badges: number; readonly champion: boolean }): Promise<void> {
  const me = await api(w.s, 'GET', '/me', w.access);
  expect(me.status).toBe(200);
  expect((me.body.badges as string[]).length).toBe(want.badges);
  expect((me.body.flags as string[]).includes('champion:zeon:beaten')).toBe(want.champion);
}

export function allBeatsDone(flags: readonly string[]): string[] {
  return STORY.filter((b) => !flags.includes(beatDoneFlag(b.id))).map((b) => b.id);
}

export function report(w: Walker, leg: Leg, t0: number): string {
  const st = w.stats;
  return [
    `[progression ${leg}] ${((Date.now() - t0) / 1000).toFixed(0)} s wall: walked ${st.metres.toFixed(0)} m in ${(st.walkMs / 1000).toFixed(0)} s, ${st.handovers} handovers, ${st.battles} battles / ${st.turns} turns in ${(st.battleMs / 1000).toFixed(0)} s, desyncs ${st.desyncs}`,
    ...w.log.map((l) => `  ${l}`),
  ].join('\n');
}

export type { ZoneId };
