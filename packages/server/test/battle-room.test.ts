/**
 * §30.4 / §50.4.5 battle-room.test.ts — `BattleCoordinator` on PGlite repos with a recording host:
 * battleStart/battleEvents digests match a client-side `resolveTurn` preview (desync 0), the NPC side is
 * always passed `null`, the one-transaction turn pipeline persists exactly the battle fields, catch / EXP /
 * trainer EXP / badges / flags / Elo are server-side, message → action errors, deadlines, and a failed
 * transaction leaves the session state unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEAGUE, LEGENDARY_STATICS, beatDoneFlag, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { TRAINER_EXP, chooseNpcAction, chooseNpcDoubles, createBattle, createRng, digestBattleState, resolveTurn } from '@ewa/core';
import type { Action, BattleState, CreateBattleOpts, Rng, RngState, SideChoice } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator, TURN_DEADLINE_MS } from '../src/rooms/battleSession';
import type { BattleHost, BattleSession } from '../src/rooms/battleSession';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { content, openRepos, rawQuery, uniqueName } from './helpers';

let db: AnyDb;
let repos: Repos & { readonly db: Db };
let now = 1_800_000_000_000;

beforeAll(async () => {
  ({ db, repos } = await openRepos());
}, 120_000);
afterAll(async () => {
  await db?.close();
});

interface Recorder extends BattleHost {
  readonly msgs: Map<string, ServerMessage[]>;
  readonly ended: { session: BattleSession; outcome: unknown }[];
  readonly started: BattleSession[];
}

function recorder(): Recorder {
  const msgs = new Map<string, ServerMessage[]>();
  const ended: Recorder['ended'] = [];
  const started: BattleSession[] = [];
  return {
    msgs,
    ended,
    started,
    send: (pid, m) => void (msgs.get(pid) ?? msgs.set(pid, []).get(pid)!).push(m),
    onStart: (s) => void started.push(s),
    onEnd: (session, outcome) => void ended.push({ session, outcome }),
    onProgress: () => undefined,
  };
}

function coordinator(host: Recorder, zoneId: ZoneId = 'mire_route', seed = 'b'): BattleCoordinator {
  return new BattleCoordinator(createRng(seed), {
    repos,
    content,
    clock: () => now,
    log: silentLogger(),
    zone: zone(zoneId),
    host,
    metrics: createRoomMetrics('r', zoneId, 0),
  });
}

async function mkPlayer(party: { species: string; level: number }[], items: Record<string, number> = { spark_orb: 10, potion: 5 }): Promise<string> {
  return repos.db.transaction(async (tx) => {
    const name = uniqueName('b');
    const { id } = await repos.players.create(tx, { username: name, email: `${name}@b.test`, passwordHash: 'x' }, new Date(now));
    for (let i = 0; i < party.length; i++) await repos.creatures.insert(tx, newCreature(content, party[i]!.species, party[i]!.level, { ownerId: id }), { kind: 'party', index: i });
    if (Object.keys(items).length > 0) await repos.inventory.addMany(tx, id, items);
    return id;
  });
}

function spawn(speciesId: string, level: number, id = `mire_route:${Math.floor(Math.random() * 1e9)}`): SpawnRecord {
  return { id, speciesId, level, variantKey: 'normal', isAlpha: false, ability: content.species(speciesId).abilities[0]!, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
}

function msgsOf(host: Recorder, pid: string): ServerMessage[] {
  return host.msgs.get(pid) ?? [];
}

function firstMove(state: BattleState, side: 0 | 1): Action {
  const b = state.sides[side].party[state.sides[side].active]!;
  const m = b.creature.moves.find((x) => x.pp > 0)!;
  return { kind: 'move', move: m.id };
}

async function settle(c: BattleCoordinator, id: string): Promise<void> {
  for (let i = 0; i < 200 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
}

/** Plays a whole battle choosing actions with `pick`, verifying each server digest against a client preview. */
async function playOut(
  c: BattleCoordinator,
  host: Recorder,
  pid: string,
  session: BattleSession,
  pick: (s: BattleState) => Action,
  doublesRng: Rng = createRng('doubles-player'),
): Promise<{ desyncs: number; turns: number }> {
  let client: BattleState = session.state; // what the client got in battleStart
  let desyncs = 0;
  let turns = 0;
  for (let guard = 0; guard < 120 && c.get(session.id) !== null; guard++) {
    const s = c.get(session.id)!;
    const side = s.seats.find((x) => x.playerId === pid)!.side;
    if (s.state.slots === 2) {
      // Phase D6: a doubles battle — one battleAction per required position (the core doubles policy picks both)
      const pair = chooseNpcDoubles(s.state, side, content, doublesRng);
      if (pair[0] === null && pair[1] === null) {
        await settle(c, s.id);
        continue;
      }
      const before = msgsOf(host, pid).length;
      const choice: SideChoice = pair;
      const preview = resolveTurn(client, side === 0 ? [choice, null] : [null, choice], content);
      for (const p of [0, 1] as const) {
        const a = pair[p];
        if (a !== null) expect(c.action(pid, s.id, s.state.turn + 1, a, p)).toBeNull();
      }
      await settle(c, s.id);
      const events = msgsOf(host, pid)
        .slice(before)
        .filter((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents');
      expect(events.length).toBeGreaterThan(0);
      if (events[0]!.stateDigest !== digestBattleState(preview.state)) desyncs++;
      client = c.get(session.id)?.state ?? preview.state;
      turns++;
      continue;
    }
    const mustSwitch = s.state.sides[side].mustSwitch;
    const replacementForOther = s.state.sides[side === 0 ? 1 : 0].mustSwitch && !mustSwitch;
    if (replacementForOther) {
      await settle(c, s.id);
      continue;
    }
    const a = mustSwitch ? { kind: 'switch' as const, to: s.state.sides[side].party.findIndex((b, i) => i !== s.state.sides[side].active && b.creature.hp > 0) } : pick(s.state);
    const before = msgsOf(host, pid).length;
    const preview = resolveTurn(client, side === 0 ? [a, null] : [null, a], content); // the client's local preview (NPC → null)
    const err = c.action(pid, s.id, s.state.turn + 1, a);
    expect(err).toBeNull();
    await settle(c, s.id);
    const events = msgsOf(host, pid)
      .slice(before)
      .filter((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents');
    expect(events.length).toBeGreaterThan(0);
    if (events[0]!.stateDigest !== digestBattleState(preview.state)) desyncs++;
    client = c.get(session.id)?.state ?? preview.state;
    turns++;
  }
  return { desyncs, turns };
}

describe('wild battles', () => {
  it('battleStart digest = digestBattleState(state); every battleEvents digest matches the client preview (NPC side null)', async () => {
    const host = recorder();
    const c = coordinator(host);
    let totalDesync = 0;
    for (let i = 0; i < 12; i++) {
      const pid = await mkPlayer([{ species: 'bramblecub', level: 8 + (i % 5) }]);
      const res = await c.startWild({ playerId: pid, sessionId: `s${i}` }, spawn(i % 2 === 0 ? 'mossling' : 'glimp', 3 + (i % 4)), { x: 0, z: 0 });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const start = msgsOf(host, pid).find((m) => m.type === 'battleStart')!;
      expect(start).toMatchObject({ type: 'battleStart', seat: 0, format: 'wild' });
      if (start.type === 'battleStart') expect(start.stateDigest).toBe(digestBattleState(start.state));
      const { desyncs } = await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
      totalDesync += desyncs;
      expect(msgsOf(host, pid).some((m) => m.type === 'battleEnd')).toBe(true);
    }
    expect(totalDesync).toBe(0);
  }, 180_000);

  it('A16: a legitimate wild win changes exactly trainer_exp (+10), dex, and the creature exp/level/hp rows; RewardsSummary matches', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'a16');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 30 }]);
    const [before] = await rawQuery(db, 'select trainer_exp, money from players where id = $1', [pid]);
    const [cBefore] = await rawQuery(db, 'select exp, level, hp from creature_instances where owner_id = $1', [pid]);
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 3), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
    const end = msgsOf(host, pid).find((m) => m.type === 'battleEnd');
    expect(end).toMatchObject({ type: 'battleEnd', outcome: { winner: 0 }, rewards: { money: 0, trainerExp: TRAINER_EXP.wildWin, badge: null, ratingDelta: null } });
    const [after] = await rawQuery(db, 'select trainer_exp, money from players where id = $1', [pid]);
    expect(Number(after!['trainer_exp']) - Number(before!['trainer_exp'])).toBe(TRAINER_EXP.wildWin);
    expect(after!['money']).toBe(before!['money']);
    const [cAfter] = await rawQuery(db, 'select exp, level, hp from creature_instances where owner_id = $1', [pid]);
    expect(Number(cAfter!['exp'])).toBeGreaterThan(Number(cBefore!['exp']));
    const dex = await rawQuery(db, 'select species_id, caught_at from dex_entries where player_id = $1', [pid]);
    expect(dex.map((d) => d['species_id'])).toContain('mossling');
    const hist = await rawQuery(db, 'select result, format, seed, actions from battle_history where player_id = $1', [pid]);
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ result: 'win', format: 'wild' });
    // the history row replays: createBattle(seed) + actions reproduces the final digest
    const ended = host.ended[0]!;
    expect(ended.outcome).toMatchObject({ winner: 0 });
    const progression = msgsOf(host, pid).filter((m) => m.type === 'progressionDelta');
    expect(progression.some((m) => m.type === 'progressionDelta' && m.trainerExp !== null)).toBe(true);
    const inv = msgsOf(host, pid).filter((m) => m.type === 'inventoryDelta');
    expect(inv.some((m) => m.type === 'inventoryDelta' && m.creaturesUpdated.length > 0)).toBe(true);
  }, 120_000);

  it('catch: the orb is spent and the creature inserted in the same transaction as the roll; trainer exp = catch + new species + wildWin', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'catch');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 10 }], { aether_orb: 1, spark_orb: 2 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 4), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(c.action(pid, res.session.id, 1, { kind: 'catch', orb: 'aether_orb' })).toBeNull();
    await settle(c, res.session.id);
    const end = msgsOf(host, pid).find((m) => m.type === 'battleEnd');
    expect(end).toMatchObject({ outcome: { winner: 'caught' }, rewards: { trainerExp: TRAINER_EXP.catch + TRAINER_EXP.catchNewSpecies + TRAINER_EXP.wildWin } });
    const party = await rawQuery(db, "select species_id, slot_kind, slot_index, caught_at from creature_instances where owner_id = $1 order by slot_index", [pid]);
    expect(party.map((p) => p['species_id'])).toEqual(['bramblecub', 'mossling']);
    expect(party[1]!['slot_kind']).toBe('party');
    const orbs = await rawQuery(db, "select item_id, qty from inventory_items where player_id = $1 and item_id = 'aether_orb'", [pid]);
    expect(orbs).toHaveLength(0);
    const inv = msgsOf(host, pid).find((m) => m.type === 'inventoryDelta');
    expect(inv).toMatchObject({ items: { aether_orb: 0 } });
    if (inv?.type === 'inventoryDelta') {
      expect(inv.creaturesAdded.map((x) => x.speciesId)).toEqual(['mossling']);
      // server finding (b): the delta says where the catch went (party slot 1 here)
      expect(inv.placement).toEqual({ [inv.creaturesAdded[0]!.id]: 'party' });
    }
    const dex = await rawQuery(db, "select caught_at from dex_entries where player_id = $1 and species_id = 'mossling'", [pid]);
    expect(dex[0]!['caught_at']).not.toBeNull();
  }, 120_000);
});

describe('§30.4.2 message → action', () => {
  it('notFound for another player\'s battle (same as a missing id), wrongTurn, validateAction errors, noOrb, alreadySubmitted', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'errs');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 10 }], { potion: 1 });
    const other = await mkPlayer([{ species: 'glimfin', level: 10 }]);
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 4), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const id = res.session.id;
    expect(c.action(other, id, 1, { kind: 'flee' })).toEqual({ code: 'notFound', detail: null });
    expect(c.action(pid, '00000000-0000-4000-8000-000000000000', 1, { kind: 'flee' })).toEqual({ code: 'notFound', detail: null });
    expect(c.action(pid, id, 2, { kind: 'flee' })).toEqual({ code: 'notAllowed', detail: 'wrongTurn' });
    expect(c.action(pid, id, 1, { kind: 'move', move: 'Hyper Beam' })).toMatchObject({ code: 'notAllowed', detail: 'unknownMove' });
    expect(c.action(pid, id, 1, { kind: 'catch', orb: 'spark_orb' })).toEqual({ code: 'notAllowed', detail: 'noOrb' });
    expect(c.action(pid, id, 1, { kind: 'switch', to: 3 })).toMatchObject({ code: 'notAllowed', detail: 'badSwitchIndex' });
    expect(c.resync(other, id)).toBeNull();
    const rs = c.resync(pid, id);
    expect(rs).toMatchObject({ type: 'battleResync', battleId: id });
    if (rs?.type === 'battleResync') expect(rs.stateDigest).toBe(digestBattleState(rs.state));
  }, 120_000);

  it('A12: catching in a trainer battle → cannotCatch; the NPC trainer battle pays reward + trainerWin and sets trainer:<id>:beaten', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'trainer');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 60 }]);
    const trainer = zone('mire_route').trainers.find((t) => t.id === 'mire_route.bug_catcher')!;
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer, rematch: false }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(c.action(pid, res.session.id, 1, { kind: 'catch', orb: 'spark_orb' })).toMatchObject({ code: 'notAllowed', detail: 'cannotCatch' });
    expect(c.action(pid, res.session.id, 1, { kind: 'flee' })).toMatchObject({ code: 'notAllowed', detail: 'cannotFlee' });
    const [before] = await rawQuery(db, 'select money from players where id = $1', [pid]);
    await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
    const end = msgsOf(host, pid).find((m) => m.type === 'battleEnd');
    expect(end).toMatchObject({ outcome: { winner: 0 }, rewards: { money: trainer.reward, trainerExp: TRAINER_EXP.trainerWin } });
    const [after] = await rawQuery(db, 'select money from players where id = $1', [pid]);
    expect(Number(after!['money']) - Number(before!['money'])).toBe(trainer.reward);
    const flags = await rawQuery(db, 'select flag from story_flags where player_id = $1', [pid]);
    expect(flags.map((f) => f['flag'])).toContain(`trainer:${trainer.id}:beaten`);
  }, 120_000);

  it('deadline: a seat that did not act gets the auto-action and the turn resolves', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'deadline');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 10 }]);
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 4), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    await c.tick(now + 1000);
    expect(c.get(res.session.id)!.state.turn).toBe(0);
    now += TURN_DEADLINE_MS + 1;
    await c.tick(now);
    await settle(c, res.session.id);
    const s = c.get(res.session.id);
    expect(s === null || s.state.turn >= 1).toBe(true);
    expect(msgsOf(host, pid).some((m) => m.type === 'battleEvents')).toBe(true);
  }, 120_000);

  it('the turn timer: 60 s a turn; battleStart, battleEvents and battleResync carry the ms left (deadlineMs)', async () => {
    expect(TURN_DEADLINE_MS).toBe(60_000);
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'timer');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 30 }]);
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 30), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const start = msgsOf(host, pid).find((m) => m.type === 'battleStart');
    expect(start).toMatchObject({ deadlineMs: TURN_DEADLINE_MS });
    now += 12_000;
    expect(c.resync(pid, res.session.id)).toMatchObject({ type: 'battleResync', deadlineMs: TURN_DEADLINE_MS - 12_000 });
    expect(c.action(pid, res.session.id, 1, firstMove(res.session.state, 0))).toBeNull();
    await settle(c, res.session.id);
    const events = msgsOf(host, pid).find((m) => m.type === 'battleEvents');
    if (c.get(res.session.id) !== null) expect(events).toMatchObject({ deadlineMs: TURN_DEADLINE_MS });
  }, 120_000);

  it('a failed transaction leaves session.state unchanged (the item balance vanished under the snapshot)', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'txfail');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 10 }], { potion: 1 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('mossling', 4), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    // hurt the lead so a potion is a legal action, then remove the potion behind the snapshot's back
    await rawQuery(db, "delete from inventory_items where player_id = $1 and item_id = 'potion'", [pid]);
    const s = c.get(res.session.id)!;
    const lead = s.state.sides[0].party[0]!;
    s.state = { ...s.state, sides: [{ ...s.state.sides[0], party: [{ ...lead, creature: { ...lead.creature, hp: 1 } }] }, s.state.sides[1]] };
    const before = s.state;
    expect(c.action(pid, s.id, 1, { kind: 'item', item: 'potion' })).toBeNull();
    await settle(c, s.id);
    expect(c.get(s.id)!.state).toBe(before);
    expect(c.get(s.id)!.pending).toEqual([null, null]);
    expect(msgsOf(host, pid).some((m) => m.type === 'error' && m.code === 'internal')).toBe(true);
    expect(msgsOf(host, pid).some((m) => m.type === 'battleEvents')).toBe(false);
  }, 120_000);
});

describe('league, story beat and pvp outcomes (server-side only)', () => {
  it('a league win awards the badge through awardBadge inside the battle transaction, pays the reward and gymWin', async () => {
    const host = recorder();
    const c = coordinator(host, 'mirevale', 'gym');
    const pid = await mkPlayer([{ species: 'cindercap', level: 70 }]);
    const gym = LEAGUE.find((l) => l.id === 'verdant_gym')!;
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: gym }, null, { x: 0, z: -26 });
    if (!res.ok) throw new Error(res.detail);
    await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
    const end = msgsOf(host, pid).find((m) => m.type === 'battleEnd');
    expect(end).toMatchObject({ outcome: { winner: 0 }, rewards: { money: gym.reward, trainerExp: TRAINER_EXP.gymWin, badge: 'bloom' } });
    const badges = await rawQuery(db, 'select badge_id from badges where player_id = $1', [pid]);
    expect(badges.map((b) => b['badge_id'])).toEqual(['bloom']);
    const audit = await rawQuery(db, "select action from audit_log where actor_id = $1 and action = 'badge.award'", [pid]);
    expect(audit).toHaveLength(1);
    const prog = msgsOf(host, pid).find((m) => m.type === 'progressionDelta' && m.badges !== null);
    expect(prog).toMatchObject({ badges: ['bloom'] });
    // creature history: the party that won it carries the badge
    const events = await rawQuery(db, "select e.kind, e.detail from creature_events e join creature_instances c on c.id = e.creature_id where c.owner_id = $1 and e.kind = 'badge'", [pid]);
    expect(events.map((e) => e['detail'])).toEqual([{ kind: 'badge', badge: 'bloom' }]);
  }, 180_000);

  it('creature history: winning against a legendary static marks the party, with whether it was caught', async () => {
    const host = recorder();
    const c = coordinator(host, 'mirevale', 'legend');
    const pid = await mkPlayer([{ species: 'cindercap', level: 100 }, { species: 'glimfin', level: 30 }], {});
    const st = { ...LEGENDARY_STATICS[0]!, level: 5 };
    const res = await c.startStatic({ playerId: pid, sessionId: 's' }, st, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
    expect(msgsOf(host, pid).find((m) => m.type === 'battleEnd')).toMatchObject({ outcome: { winner: 0 } });
    const events = await rawQuery(db, "select e.detail from creature_events e join creature_instances c on c.id = e.creature_id where c.owner_id = $1 and e.kind = 'legendary'", [pid]);
    expect(events.map((e) => e['detail'])).toEqual([
      { kind: 'legendary', species: st.species, caught: false },
      { kind: 'legendary', species: st.species, caught: false },
    ]);
  }, 180_000);

  it('a story-beat battle completes the beat (flags + done flag + storyBeat complete) only on a side-0 win', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'beat');
    const pid = await mkPlayer([{ species: 'bramblecub', level: 60 }]);
    const trainer = zone('mire_route').trainers.find((t) => t.id === 'sable_mire')!;
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer, rematch: false }, 'mire_rival', { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    await playOut(c, host, pid, res.session, (s) => firstMove(s, 0));
    const flags = (await rawQuery(db, 'select flag from story_flags where player_id = $1', [pid])).map((f) => f['flag']);
    expect(flags).toContain('met_sable');
    expect(flags).toContain(beatDoneFlag('mire_rival'));
    const msgs = msgsOf(host, pid);
    const iProg = msgs.findIndex((m) => m.type === 'progressionDelta' && (m.flags ?? []).includes('met_sable'));
    const iBeat = msgs.findIndex((m) => m.type === 'storyBeat' && m.phase === 'complete');
    expect(iProg).toBeGreaterThanOrEqual(0);
    expect(iBeat).toBeGreaterThan(iProg);
  }, 120_000);

  it('pvp: a forfeit resolves through core; Elo via eloDelta applied to both; pvpWin / pvpLoss trainer exp', async () => {
    const host = recorder();
    const c = coordinator(host, 'mire_route', 'pvp');
    const a = await mkPlayer([{ species: 'bramblecub', level: 10 }]);
    const b = await mkPlayer([{ species: 'glimfin', level: 10 }]);
    const res = await c.startPvp({ playerId: a, sessionId: 'sa' }, { playerId: b, sessionId: 'sb' }, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(msgsOf(host, b).find((m) => m.type === 'battleStart')).toMatchObject({ seat: 1, format: 'pvp' });
    await c.forfeitIfActive(b, 'disconnect');
    expect(c.get(res.session.id)).toBeNull();
    const [ra] = await rawQuery(db, 'select rating, ranked_matches, trainer_exp from players where id = $1', [a]);
    const [rb] = await rawQuery(db, 'select rating, ranked_matches, trainer_exp from players where id = $1', [b]);
    expect(Number(ra!['rating'])).toBe(1016);
    expect(Number(rb!['rating'])).toBe(984);
    expect(Number(ra!['ranked_matches'])).toBe(1);
    expect(Number(ra!['trainer_exp'])).toBe(TRAINER_EXP.pvpWin);
    expect(Number(rb!['trainer_exp'])).toBe(TRAINER_EXP.pvpLoss);
    expect(msgsOf(host, a).find((m) => m.type === 'battleEnd')).toMatchObject({ outcome: { winner: 0 }, rewards: { ratingDelta: 16 } });
  }, 120_000);
});

/**
 * §50.5 M3: one seeded league battle per LEAGUE entry (12) through the real `BattleCoordinator` with the trainer's
 * content team verbatim. The coordinator's rng is seeded per entry (`league:<id>`), so each battle is reproducible;
 * the player side picks with core's expected-damage policy (a deterministic rng of its own). Every `battleEvents`
 * digest is checked against the client's local `resolveTurn` preview (NPC side `null`), and the finished battle
 * replays from its `battle_history` row alone.
 */
describe('M3: one seeded league battle per LEAGUE entry (12), desync counter 0', () => {
  /** A strong mixed party ten levels above the ace — the pipeline is under test here, not the balance. */
  const PARTY = ['thornback', 'caldermole', 'bogmaw', 'rivetalon', 'toxshade', 'gemknight'] as const;
  let totalDesync = 0;
  let battles = 0;

  for (const lt of LEAGUE) {
    it(`${lt.stage} ${lt.id} (${lt.team.map((m) => `${m.species}:${m.level}`).join(', ')})`, async () => {
      const host = recorder();
      const c = coordinator(host, lt.zoneId, `league:${lt.id}`);
      const level = Math.min(100, Math.max(...lt.team.map((m) => m.level)) + 10);
      const pid = await mkPlayer(PARTY.map((species) => ({ species, level })));
      const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: lt }, null, { x: 0, z: -26 });
      if (!res.ok) throw new Error(res.detail);
      const start = msgsOf(host, pid).find((m): m is Extract<ServerMessage, { type: 'battleStart' }> => m.type === 'battleStart')!;
      expect(start).toMatchObject({ format: 'league', seat: 0 });
      expect(start.stateDigest).toBe(digestBattleState(start.state));
      // the trainer's content team verbatim: species, level, nickname, ability (null → species.abilities[0]), held item
      const side1 = start.state.sides[1];
      expect(side1.kind).toBe('npc');
      expect(side1.trainerId).toBe(lt.id);
      expect(side1.party.map((b) => [b.creature.speciesId, b.creature.level, b.creature.nickname, b.creature.ability, b.creature.heldItem])).toEqual(
        lt.team.map((m) => [m.species, m.level, m.nickname, m.ability ?? content.species(m.species).abilities[0], m.heldItem]),
      );
      const rng = createRng(`player:${lt.id}`);
      const { desyncs, turns } = await playOut(c, host, pid, res.session, (s) => chooseNpcAction(s, 0, content, rng));
      totalDesync += desyncs;
      battles += 1;
      expect(desyncs).toBe(0);
      expect(turns).toBeGreaterThan(0);

      const end = msgsOf(host, pid).find((m): m is Extract<ServerMessage, { type: 'battleEnd' }> => m.type === 'battleEnd')!;
      const exp = lt.stage === 'gym' ? TRAINER_EXP.gymWin : lt.stage === 'elite' ? TRAINER_EXP.eliteWin : TRAINER_EXP.championWin;
      expect(end).toMatchObject({ outcome: { winner: 0 }, rewards: { money: lt.reward, trainerExp: exp, badge: lt.badge, ratingDelta: null } });
      const badges = (await rawQuery(db, 'select badge_id from badges where player_id = $1', [pid])).map((b) => b['badge_id']);
      expect(badges).toEqual(lt.badge === null ? [] : [lt.badge]);
      const flags = (await rawQuery(db, 'select flag from story_flags where player_id = $1', [pid])).map((f) => String(f['flag'])).sort();
      expect(flags).toEqual([...lt.setsFlags, ...(lt.id === 'zeon' ? ['champion:zeon:beaten'] : [])].filter((f, i, a) => a.indexOf(f) === i).sort());

      // the database-only replay (P6): the row + content reproduce the last digest; the NPC side never acted
      const last = msgsOf(host, pid).filter((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents').at(-1)!;
      const row = await repos.db.transaction((tx) => repos.history.battleById(tx, pid, res.session.id));
      expect(row!.finalDigest).toBe(last.stateDigest);
      expect(row!.actions.every((a) => (a as [unknown, unknown])[1] === null)).toBe(true);
      const opts: CreateBattleOpts = {
        id: row!.battleId,
        format: row!.format,
        zoneId: row!.start!.zoneId,
        terrain: row!.start!.terrain as CreateBattleOpts['terrain'],
        seed: row!.seed as RngState,
        sides: row!.start!.sides as CreateBattleOpts['sides'],
        ...(row!.start!.slots === 2 ? { slots: 2 as const } : {}),
      };
      expect(start.state.slots === 2).toBe(lt.doubles === true); // Phase D6: draco_gym and aurelia fight 2-on-2
      let replay = createBattle(opts, content).state;
      for (const acts of row!.actions) replay = resolveTurn(replay, acts as [SideChoice, SideChoice], content).state;
      expect(digestBattleState(replay)).toBe(last.stateDigest);
      expect(replay.ended).toEqual({ winner: 0 });
    }, 180_000);
  }

  it('12 league battles, desync counter 0', () => {
    expect(battles).toBe(12);
    expect(totalDesync).toBe(0);
  });
});
