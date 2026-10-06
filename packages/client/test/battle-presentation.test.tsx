// @vitest-environment jsdom
/**
 * Phase B7 battle presentation:
 * - the foe actor: a director actor (route / hall trainer, leader) is restaged at the far slot and stood back where it
 *   stood; a trainer with no actor in the zone gets a temporary `battle:foe` actor with the content look, despawned on
 *   exit; a pvp foe is restaged only while it has a rig; the winner cheers, the loser bows;
 * - the VS intro card: written for a fresh trainer / league battle, never for wild, under reduced motion or on a
 *   resync restore; the card renders it and clears itself;
 * - the result card: the won badge's glyph + name, the league trainer's concession line;
 * - the mid-battle lines: `halfHp` once when the foe team's total displayed HP first drops to ≤ 50 %, `lastStand`
 *   once when the foe's last standing creature enters; the banner shows each for 3 s, queued.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BADGES, LEAGUE, createContentIndex, zone } from '@ewa/content';
import { createBattle, digestBattleState, projectBattler } from '@ewa/core';
import type { BattleEvent, BattleFormat, BattleState, CreatureInstance, Ref } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { BATTLE_BANNER_MS, BattleBanner } from '../src/battle/BattleBanner';
import { BattleIntroCard, INTRO_MS } from '../src/battle/BattleIntroCard';
import { BattleResultCard } from '../src/battle/BattleResultCard';
import { STEP_MS } from '../src/battle/constants';
import { concessionLine, foeIdentity } from '../src/battle/foe';
import { EMOTE_CHEER, EMOTE_SAD, FoeActor, TEMP_FOE_ID, foeSpecOf } from '../src/scene/foeActor';
import type { FoeActorPool } from '../src/scene/foeActor';
import { useUiStore } from '../src/state/ui';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-0000000000b7';
const mira = LEAGUE.find((l) => l.id === 'verdant_gym')!;
const veil = LEAGUE.find((l) => l.id === 'veil')!;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  useUiStore.getState().reset();
});

// ---- the foe actor --------------------------------------------------------------------------------------------

function fakePool() {
  const log: string[] = [];
  const pose = new Map<string, { x: number; z: number; a: number }>();
  const pool: FoeActorPool = {
    spawn: (id, d) => log.push(`spawn ${id} ${d.look} ${d.name}`),
    setTransform: (id, x, z, a) => {
      pose.set(id, { x, z, a });
    },
    setEmote: (id, n) => log.push(`emote ${id} ${n}`),
    despawn: (id) => log.push(`despawn ${id}`),
  };
  return { pool, log, pose };
}

describe('FoeActor (Phase B7)', () => {
  it('restages a director actor at the far slot facing the player, then stands it back where it stood', () => {
    const { pool, log, pose } = fakePool();
    const statics = new Map([['mirevale_gym.trainer_a', { x: 4, z: -7, angle: 1.25 }]]);
    const foe = new FoeActor({ actors: pool, isStatic: (id) => statics.has(id), isRemote: () => false, restPose: (id) => statics.get(id) ?? null });
    foe.begin(foeSpecOf(null, 'mirevale_gym.trainer_a', 'me', (id) => foeIdentity(id)));
    expect(foe.kind).toBe('static');
    expect(log.filter((l) => l.startsWith('spawn'))).toEqual([]);
    // arena at (10, 20), forward (0, −1): the foe stands `back` m ahead, facing back down the axis toward the player
    foe.stage(10, 20, 0, -1, 3);
    expect(pose.get('mirevale_gym.trainer_a')).toMatchObject({ x: 10, z: 17 });
    expect(pose.get('mirevale_gym.trainer_a')!.a).toBeCloseTo(0); // faces +z, back toward the player
    foe.react(false);
    expect(log).toContain(`emote mirevale_gym.trainer_a ${EMOTE_SAD}`);
    foe.end();
    expect(pose.get('mirevale_gym.trainer_a')).toEqual({ x: 4, z: -7, a: 1.25 });
    expect(foe.id).toBeNull();
    expect(log.filter((l) => l.startsWith('despawn'))).toEqual([]);
    foe.end(); // idempotent
  });

  it('spawns a temporary battle:foe actor with the content look when none stands in the zone, despawns it on exit', () => {
    const { pool, log, pose } = fakePool();
    const foe = new FoeActor({ actors: pool, isStatic: () => false, isRemote: () => false });
    const sable = zone('mire_route').trainers.find((t) => t.id === 'sable_mire')!;
    foe.begin(foeSpecOf(null, 'sable_mire', 'me', (id) => foeIdentity(id)));
    expect(foe.kind).toBe('temporary');
    expect(foe.id).toBe(TEMP_FOE_ID);
    expect(log).toEqual([`spawn ${TEMP_FOE_ID} ${sable.look} Sable`]);
    foe.stage(0, 0, 1, 0, 2);
    expect(pose.get(TEMP_FOE_ID)).toMatchObject({ x: 2, z: 0 });
    foe.react(true);
    expect(log).toContain(`emote ${TEMP_FOE_ID} ${EMOTE_CHEER}`);
    foe.end();
    expect(log.at(-1)).toBe(`despawn ${TEMP_FOE_ID}`);
    expect(foe.kind).toBe('none');
    // a new battle replaces the previous temporary (one despawn, one spawn) — and a league leader resolves its look
    foe.begin(foeSpecOf(null, 'sable_mire', 'me', (id) => foeIdentity(id)));
    foe.begin(foeSpecOf(null, 'zeon', 'me', (id) => foeIdentity(id)));
    expect(log.slice(-3)).toEqual([`spawn ${TEMP_FOE_ID} ${sable.look} Sable`, `despawn ${TEMP_FOE_ID}`, `spawn ${TEMP_FOE_ID} knight_golden_male Champion Zeon`]);
  });

  it('a pvp foe is restaged only while it has a rig; wild battles have no foe actor', () => {
    const { pool, pose } = fakePool();
    let rig = false;
    const foe = new FoeActor({ actors: pool, isStatic: () => false, isRemote: () => rig });
    foe.begin(foeSpecOf('p2', null, 'me', (id) => foeIdentity(id)));
    expect(foe.kind).toBe('remote');
    foe.stage(0, 0, 0, 1, 2);
    expect(pose.has('p2')).toBe(false);
    rig = true;
    foe.stage(0, 0, 0, 1, 2);
    expect(pose.get('p2')).toMatchObject({ x: 0, z: 2 });
    expect(foeSpecOf('me', null, 'me', (id) => foeIdentity(id))).toBeNull();
    expect(foeSpecOf(null, null, 'me', (id) => foeIdentity(id))).toBeNull();
    foe.begin(null);
    expect(foe.kind).toBe('none');
  });

  it('foeIdentity: league trainers carry title, type and look; zone trainers their look; concession lines', () => {
    expect(foeIdentity('verdant_gym')).toMatchObject({ name: 'Mira Thornwell', title: mira.title, type: 'Grass', look: mira.look });
    expect(foeIdentity('sable_mire', 'coalette')).toMatchObject({ name: 'Sable', title: null, look: 'casual2_male', type: content.species('coalette').types[0] });
    expect(foeIdentity('nobody.some_one')).toMatchObject({ name: 'Some one', look: null });
    expect(concessionLine(mira)).toBe(mira.post[1]);
    expect(concessionLine(veil)).toBe(veil.post[0]);
    expect(concessionLine(null)).toBeNull();
  });
});

// ---- the controller: intro + mid lines ------------------------------------------------------------------------

function view(calls: string[]): BattleView {
  return {
    enterBattle: (s) => calls.push(`enter ${s.foeNpc ?? '-'}`), exitBattle: () => calls.push('exit'), setBattler: () => undefined,
    setPose: () => undefined, hurt: () => undefined, vfx: () => undefined, prewarm: () => undefined, syncFrom: () => undefined,
    setWeather: () => undefined, cue: () => undefined, shake: () => undefined, setTimeScale: () => undefined, hitstopEnabled: () => false,
    slowmoEnabled: () => false, playSfx: () => undefined, setBattleHud: () => undefined, setThreat: () => undefined,
    ended: (foeWon) => calls.push(`ended ${String(foeWon)}`),
  };
}

function controller(opts: { reduced?: boolean } = {}) {
  const calls: string[] = [];
  const c = createBattleController({
    content, send: () => undefined, reduced: () => opts.reduced ?? false, instantText: () => true, selfPosition: () => ({ x: 0, z: 0 }),
    summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view: view(calls), defer: (fn) => fn(),
  });
  const playOut = (): void => {
    for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  return { c, calls, playOut };
}

function battle(format: BattleFormat, trainerId: string | null, foeTeam: readonly CreatureInstance[]): { state: BattleState; events: readonly BattleEvent[] } {
  const me = makeCreature(content, content.species('bramblecub'), 30, 'mine-1', 'p0');
  const kind = format === 'wild' ? 'wild' : 'npc';
  const r = createBattle(
    {
      id: BID, format, zoneId: 'mirevale', terrain: 'grove', seed: 7,
      sides: [
        { kind: 'player', party: [projectBattler(me, content)], active: 0, trainerId: 'p0', canFlee: format === 'wild', canCatch: format === 'wild' },
        { kind, party: foeTeam.map((f) => projectBattler(f, content)), active: 0, trainerId, canFlee: false, canCatch: false },
      ],
    },
    content,
  );
  return { state: r.state, events: r.events };
}

function start(format: BattleFormat, state: BattleState, events: readonly BattleEvent[]): ServerMessageOf<'battleStart'> {
  return { type: 'battleStart', battleId: BID, format, seat: 0, state, events, stateDigest: digestBattleState(state) };
}

const miraTeam = (): CreatureInstance[] => mira.team.map((m, i) => makeCreature(content, content.species(m.species), m.level, `mira-${i}`, null));

describe('VS intro card (Phase B7)', () => {
  it('a league battle writes the intro (name, title, type, look); the card shows it and clears itself', () => {
    vi.useFakeTimers();
    const { c } = controller();
    const { state, events } = battle('league', 'verdant_gym', miraTeam());
    c.onBattleStart(start('league', state, events));
    expect(useUiStore.getState().battleIntro).toEqual({ battleId: BID, name: 'Mira Thornwell', title: mira.title, type: 'Grass', look: mira.look, league: true });
    render(<BattleIntroCard />);
    const card = screen.getByTestId('battleintro');
    expect(card.textContent).toContain('Mira Thornwell');
    expect(card.textContent).toContain(mira.title);
    expect(card.getAttribute('data-type')).toBe('Grass');
    act(() => {
      vi.advanceTimersByTime(INTRO_MS + 10);
    });
    expect(useUiStore.getState().battleIntro).toBeNull();
    expect(screen.queryByTestId('battleintro')).toBeNull();
  });

  it('a trainer battle writes it too (no title, the lead type); wild, reduced motion and a resync restore do not', () => {
    const t = controller();
    const sable = battle('trainer', 'sable_mire', [makeCreature(content, content.species('coalette'), 5, 's-0', null)]);
    t.c.onBattleStart(start('trainer', sable.state, sable.events));
    expect(useUiStore.getState().battleIntro).toMatchObject({ name: 'Sable', title: null, type: content.species('coalette').types[0], league: false });
    t.c.reset();
    expect(useUiStore.getState().battleIntro).toBeNull();

    const w = controller();
    const wild = battle('wild', null, [makeCreature(content, content.species('mossling'), 5, 'w-0', null)]);
    w.c.onBattleStart(start('wild', wild.state, wild.events));
    expect(useUiStore.getState().battle).not.toBeNull();
    expect(useUiStore.getState().battleIntro).toBeNull();
    w.c.reset();

    const r = controller({ reduced: true });
    const lg = battle('league', 'verdant_gym', miraTeam());
    r.c.onBattleStart(start('league', lg.state, lg.events));
    expect(useUiStore.getState().battleIntro).toBeNull();
    r.c.reset();

    const z = controller();
    z.c.onBattleResync({ type: 'battleResync', battleId: BID, state: lg.state });
    expect(useUiStore.getState().battle).not.toBeNull();
    expect(useUiStore.getState().battleIntro).toBeNull();
  });
});

describe('mid-battle leader lines (Phase B7)', () => {
  const foeRef = (slot: number): Ref => ({ side: 1, slot });
  const dmg = (st: BattleState, slot: number, hpAfter: number): BattleEvent => {
    const b = st.sides[1].party[slot]!;
    return {
      t: 'damage', target: foeRef(slot), amount: Math.max(1, b.creature.hp - hpAfter), hpAfter, maxHp: b.maxHp, effectiveness: 1, crit: false, stab: false,
      cause: 'poison', source: null, move: null,
    };
  };

  it('halfHp fires once when the total first drops to ≤ 50 %; lastStand once when the last creature enters; banners queue for 3 s', () => {
    vi.useFakeTimers();
    const { c, playOut, calls } = controller();
    const { state, events } = battle('league', 'verdant_gym', miraTeam());
    const party = state.sides[1].party;
    const max = party.reduce((n, b) => n + b.maxHp, 0);
    c.onBattleStart(start('league', state, events));
    playOut();
    expect(useUiStore.getState().battleBanner).toBeNull();
    const send = (turn: number, evs: BattleEvent[]): void => {
      const before = useUiStore.getState().battle!.authoritative;
      c.onBattleEvents({ type: 'battleEvents', battleId: BID, turn, events: [{ t: 'turnStart', turn }, ...evs, { t: 'turnEnd', turn }], stateDigest: '0', rng: before.rng });
      playOut();
    };
    const at = (): BattleState => useUiStore.getState().battle!.authoritative;
    // turn 1: the lead faints, the second enters — still above half the team total (the lead is the smallest)
    expect(party[1]!.maxHp + party[2]!.maxHp).toBeGreaterThan(max / 2);
    send(1, [dmg(at(), 0, 0), { t: 'faint', who: foeRef(0) }, { t: 'switchIn', who: foeRef(1) }]);
    expect(useUiStore.getState().battleBanner).toBeNull();
    // turn 2: the second down to one point above the half-total line → nothing
    const above = Math.floor(max / 2) + 1 - party[2]!.maxHp;
    expect(above).toBeGreaterThan(1);
    send(2, [dmg(at(), 1, above)]);
    expect(useUiStore.getState().battleBanner).toBeNull();
    // turn 3: one more point → ≤ 50 % → the halfHp line, once
    send(3, [dmg(at(), 1, above - 1)]);
    expect(useUiStore.getState().battleBanner).toMatchObject({ speaker: 'Mira Thornwell', text: mira.mid!.halfHp });
    send(4, [dmg(at(), 1, 1)]);
    expect(useUiStore.getState().battleBannerQueue).toEqual([]);
    // turn 5: the second faints, the last enters → lastStand, queued behind the halfHp banner
    send(5, [dmg(at(), 1, 0), { t: 'faint', who: foeRef(1) }, { t: 'switchIn', who: foeRef(2) }]);
    expect(useUiStore.getState().battleBannerQueue.map((b) => b.text)).toEqual([mira.mid!.lastStand]);
    // the banner component: 3 s each, then the queued one
    render(<BattleBanner />);
    expect(screen.getByTestId('battlebanner').textContent).toContain(mira.mid!.halfHp);
    act(() => {
      vi.advanceTimersByTime(BATTLE_BANNER_MS + 1);
    });
    expect(screen.getByTestId('battlebanner').textContent).toContain(mira.mid!.lastStand);
    expect(screen.getByTestId('battlebanner').textContent).toContain('Mira Thornwell');
    act(() => {
      vi.advanceTimersByTime(BATTLE_BANNER_MS + 1);
    });
    expect(screen.queryByTestId('battlebanner')).toBeNull();
    // a later switch-in of the same last creature, more damage: nothing again
    send(6, [dmg(at(), 2, 1), { t: 'switchIn', who: foeRef(2) }]);
    expect(useUiStore.getState().battleBanner).toBeNull();
    // the result: the world hears who won (the foe lost → its actor bows)
    c.onBattleEnd({ type: 'battleEnd', battleId: BID, outcome: { winner: 0 }, rewards: { money: 800, items: {}, trainerExp: 10, ratingDelta: null, badge: null } });
    expect(calls).toContain('ended false');
  });

  it('a trainer without mid lines (a route trainer) never pushes a banner', () => {
    const { c, playOut } = controller();
    const { state, events } = battle('trainer', 'sable_mire', [makeCreature(content, content.species('coalette'), 5, 's-0', null), makeCreature(content, content.species('glimp'), 4, 's-1', null)]);
    c.onBattleStart(start('trainer', state, events));
    playOut();
    const b = state.sides[1].party[0]!;
    c.onBattleEvents({
      type: 'battleEvents', battleId: BID, turn: 1, stateDigest: '0', rng: state.rng,
      events: [{ t: 'damage', target: { side: 1, slot: 0 }, amount: b.creature.hp, hpAfter: 0, maxHp: b.maxHp, effectiveness: 1, crit: false, stab: false, cause: 'poison', source: null, move: null }, { t: 'faint', who: { side: 1, slot: 0 } }, { t: 'switchIn', who: { side: 1, slot: 1 } }],
    });
    playOut();
    expect(useUiStore.getState().battleBanner).toBeNull();
  });
});

// ---- the result card ------------------------------------------------------------------------------------------

describe('BattleResultCard (Phase B7)', () => {
  it('a won gym battle: the badge glyph + name and the leader’s concession line', () => {
    const { state } = battle('league', 'verdant_gym', miraTeam());
    const badge = BADGES.find((b) => b.gym === 'verdant_gym')!;
    useUiStore.getState().setBattle({
      battleId: BID, format: 'league', seat: 0, authoritative: state, phase: 'ended', menu: 'root', turnLabel: 'Turn 9', log: [], desyncs: 0, expectedMs: 0,
      result: { outcome: { winner: 0 }, rewards: { money: 800, items: {}, trainerExp: 50, ratingDelta: null, badge: badge.id as never }, prompts: 0 },
    });
    render(<BattleResultCard />);
    const row = screen.getByTestId('battleresult-badge');
    expect(row.textContent).toContain(badge.name);
    expect(row.textContent).toContain('❀');
    expect(row.getAttribute('data-type')).toBe(badge.type);
    expect(screen.getByTestId('battleresult-concession').textContent).toContain(mira.post[1]);
    expect(screen.getByTestId('battleresult-concession').textContent).toContain('Mira Thornwell');
  });

  it('a lost league battle and a won trainer battle show no concession; no badge row without a badge', () => {
    const { state } = battle('league', 'veil', miraTeam());
    useUiStore.getState().setBattle({
      battleId: BID, format: 'league', seat: 0, authoritative: state, phase: 'ended', menu: 'root', turnLabel: 'Turn 9', log: [], desyncs: 0, expectedMs: 0,
      result: { outcome: { winner: 1 }, rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null }, prompts: 0 },
    });
    const { unmount } = render(<BattleResultCard />);
    expect(screen.queryByTestId('battleresult-concession')).toBeNull();
    expect(screen.queryByTestId('battleresult-badge')).toBeNull();
    unmount();
    // a won Warden battle concedes in post[0]
    useUiStore.getState().setBattle({ ...useUiStore.getState().battle!, result: { outcome: { winner: 0 }, rewards: { money: 6000, items: {}, trainerExp: 0, ratingDelta: null, badge: null }, prompts: 0 } });
    render(<BattleResultCard />);
    expect(screen.getByTestId('battleresult-concession').textContent).toContain(veil.post[0]);
  });
});
