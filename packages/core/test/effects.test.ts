/**
 * §2.4 — one test per effect, all 23. resolveTurn draws from state.rng, so chance-gated outcomes are reached by
 * choosing the seed (findSeed), never by patching core. The attacker (bramblecub, spd 108) outspeeds the
 * defender (mufflo, spd 105) so "attacker moved first" holds unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import { calcStat, validateAction } from '../src/index';
import type { BattleEvent, BattleState, MoveDef, MoveEffect, TurnResult } from '../src/index';
import { EFFECT_HANDLERS, effectAlwaysApplies, weatherForType } from '../src/effects';
import { effectiveSpeed } from '../src/speed';
import { defaultEffectChance } from './fixtures/legacyContent';
import { FLEE, activeOf, content, customMove, eventsOf, findSeed, move, startBattle, sw, turn } from './helpers';
import type { CreatureSpec } from './helpers';

const ATT: CreatureSpec = { species: 'bramblecub', level: 50, ability: 'Chlorophyll' };
const DEF: CreatureSpec = { species: 'mufflo', level: 50, ability: 'Natural Cure' };

// Guaranteed (chance 100) variants so the effect itself is under test, not the roll.
const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef =>
  customMove(base, id, { effectChance: 100, accuracy: null, ...patch });

const LOWER_ATK = sure('Growl', 'E:lower_atk');
const LOWER_ATK_DMG = sure('Tackle', 'E:lower_atk_dmg', { effect: 'lower_atk' });
const LOWER_DEF = sure('Sand Attack', 'E:lower_def');
const LOWER_SPD = sure('String Shot', 'E:lower_spd');
const LOWER_SPATK = sure('Growl', 'E:lower_spAtk', { effect: 'lower_spAtk' });
const RAISE_ATK = sure('Howl', 'E:raise_atk');
const RAISE_DEF = sure('Iron Defense', 'E:raise_def');
const RAISE_SPD = sure('Autotomize', 'E:raise_spd');
const RAISE_ALL = sure('Ancient Power', 'E:raise_all', { power: 0, target: 'self' });
const FLINCH = sure('Tackle', 'E:flinch', { effect: 'flinch' });
const BURN = sure('Will-O-Wisp', 'E:burn');
const POISON = sure('Poison Fog', 'E:poison');
const PARALYZE = sure('Growl', 'E:paralyze', { effect: 'paralyze', type: 'Normal' });
const FREEZE = sure('Growl', 'E:freeze', { effect: 'freeze', type: 'Normal' });
const SLEEP = sure('Hypno Fog', 'E:sleep');
const CONFUSE = sure('Growl', 'E:confuse', { effect: 'confuse' });
const TRAP = sure('Fairy Lock', 'E:trap', { type: 'Normal' });
const RECOIL = sure('Flare Blitz', 'E:recoil', { type: 'Normal' });
const DRAIN = sure('Nature Drain', 'E:drain', { type: 'Normal' });
const HEAL = sure('Synthesis', 'E:heal');
const SAND = sure('Sandstorm', 'E:sand');
const HAIL = sure('Hail', 'E:hail');
const RAIN = sure('Sandstorm', 'E:rain', { type: 'Water' });
const SUNW = sure('Sandstorm', 'E:sunw', { type: 'Fire' });
const OTHERW = sure('Sandstorm', 'E:otherw', { type: 'Normal' });
const SUN = sure('Sunny Day', 'E:sun');
const TACKLE = sure('Tackle', 'E:tackle');
const FIRE40 = sure('Tackle', 'E:fire40', { type: 'Fire' });
const NOOP = sure('Growl', 'E:noop', { effect: null }); // a status move that does nothing (a "pass")

function start(a: CreatureSpec = ATT, b: CreatureSpec = DEF, seed: number | string = 'fx', format: 'trainer' | 'wild' = 'trainer'): BattleState {
  return startBattle({ a, b, seed, format }).state;
}

function stages(r: TurnResult, side: 0 | 1) {
  return activeOf(r.state, side).stages;
}

function stageEvents(events: readonly BattleEvent[]) {
  return eventsOf(events, 'statStage').map((e) => ({ side: e.target.side, stat: e.stat, delta: e.delta, after: e.after, cause: e.cause, src: e.source?.side ?? null }));
}

const ALL_EFFECTS: readonly MoveEffect[] = [
  'lower_atk', 'first', 'paralyze', 'flinch', 'crit', 'confuse', 'poison', 'raise_def', 'burn', 'recoil', 'lower_def', 'drain',
  'heal', 'sun', 'lower_spd', 'freeze', 'raise_all', 'trap', 'weather', 'sleep', 'lower_spAtk', 'raise_atk', 'raise_spd',
];

describe('§2.4 the effect table is complete', () => {
  it('has a handler for every one of the 23 effects and no others', () => {
    expect(Object.keys(EFFECT_HANDLERS).sort()).toEqual([...ALL_EFFECTS].sort());
    expect(ALL_EFFECTS.length).toBe(23);
  });

  it('default chances follow the table: 100 for power 0, 30 (10 for freeze) for damaging, 100 for always-effects', () => {
    expect(defaultEffectChance('lower_atk', 0)).toBe(100);
    expect(defaultEffectChance('lower_atk', 40)).toBe(30);
    expect(defaultEffectChance('freeze', 90)).toBe(10);
    expect(defaultEffectChance('sleep', 0)).toBe(100);
    expect(defaultEffectChance('confuse', 60)).toBe(30);
    expect(defaultEffectChance('flinch', 130)).toBe(30);
    for (const e of ['crit', 'first', 'recoil', 'drain', 'heal', 'weather', 'sun'] as const) {
      expect(effectAlwaysApplies(e)).toBe(true);
      expect(defaultEffectChance(e, 100)).toBe(100);
    }
    expect(effectAlwaysApplies('burn')).toBe(false);
    expect(content.move('Ember').effectChance).toBe(30);
    expect(content.move('Growl').effectChance).toBe(100);
  });
});

describe('§2.4 effects — one test each', () => {
  it('lower_atk lowers the DEFENDER by one stage (repair: legacy PvP lowered the attacker)', () => {
    const r = turn(start(), move(LOWER_ATK.id), move(NOOP.id));
    expect(stages(r, 1).atk).toBe(-1);
    expect(stages(r, 0).atk).toBe(0);
    expect(stageEvents(r.events)).toEqual([{ side: 1, stat: 'atk', delta: -1, after: -1, cause: 'move', src: 0 }]);
    // the 30 % default on a damaging move: both outcomes exist across seeds
    const chance = customMove('Tackle', 'E:lower_atk_30', { effect: 'lower_atk', accuracy: null });
    expect(chance.effectChance).toBe(30);
    findSeed((seed) => (stages(turn(start(ATT, DEF, seed), move(chance.id), move(NOOP.id)), 1).atk === -1 ? true : null));
    findSeed((seed) => (stages(turn(start(ATT, DEF, seed), move(chance.id), move(NOOP.id)), 1).atk === 0 ? true : null));
    // still on the defender when the move also deals damage
    expect(stages(turn(start(), move(LOWER_ATK_DMG.id), move(NOOP.id)), 1).atk).toBe(-1);
  });

  it('lower_def lowers the defender Def by one', () => {
    const r = turn(start(), move(LOWER_DEF.id), move(NOOP.id));
    expect(stages(r, 1).def).toBe(-1);
    expect(stages(r, 0).def).toBe(0);
  });

  it('lower_spd lowers the defender Spd by one and effective speed follows', () => {
    const r = turn(start(), move(LOWER_SPD.id), move(NOOP.id));
    expect(stages(r, 1).spd).toBe(-1);
    const b = activeOf(r.state, 1);
    expect(effectiveSpeed(b, 'none', content)).toBe(Math.floor((b.spd * 2) / 3));
  });

  it('lower_spAtk: content rewrites it to lower_atk (Moonblast); the core handler still lowers the defender Atk', () => {
    expect(content.move('Moonblast').effect).toBe('lower_atk');
    const r = turn(start(), move(LOWER_SPATK.id), move(NOOP.id));
    expect(stages(r, 1).atk).toBe(-1);
    expect(stages(r, 0).atk).toBe(0);
  });

  it('raise_atk raises the attacker Atk by one', () => {
    const r = turn(start(), move(RAISE_ATK.id), move(NOOP.id));
    expect(stages(r, 0).atk).toBe(1);
    expect(stages(r, 1).atk).toBe(0);
    expect(stageEvents(r.events)).toEqual([{ side: 0, stat: 'atk', delta: 1, after: 1, cause: 'move', src: 0 }]);
  });

  it('raise_def raises the attacker Def by one', () => {
    expect(stages(turn(start(), move(RAISE_DEF.id), move(NOOP.id)), 0).def).toBe(1);
  });

  it('raise_spd raises the attacker Spd by one', () => {
    expect(stages(turn(start(), move(RAISE_SPD.id), move(NOOP.id)), 0).spd).toBe(1);
  });

  it('raise_all raises Atk, Def, Spd by one — three statStage events in that order', () => {
    const r = turn(start(), move(RAISE_ALL.id), move(NOOP.id));
    expect(stages(r, 0)).toMatchObject({ atk: 1, def: 1, spd: 1 });
    expect(eventsOf(r.events, 'statStage').map((e) => e.stat)).toEqual(['atk', 'def', 'spd']);
    // and on a damaging move (Ancient Power) it still raises the attacker after the hit
    const r2 = turn(start(), move(sure('Ancient Power', 'E:raise_all_dmg').id), move(NOOP.id));
    expect(stages(r2, 0)).toMatchObject({ atk: 1, def: 1, spd: 1 });
    expect(eventsOf(r2.events, 'damage')[0]!.target.side).toBe(1);
  });

  it('stages clamp at ±6 with a delta-0 clamped event', () => {
    let st = start();
    for (let i = 0; i < 6; i++) st = turn(st, move(RAISE_ATK.id), move(NOOP.id)).state;
    expect(activeOf(st, 0).stages.atk).toBe(6);
    const r = turn(st, move(RAISE_ATK.id), move(NOOP.id));
    expect(stageEvents(r.events)).toEqual([{ side: 0, stat: 'atk', delta: 0, after: 6, cause: 'move', src: 0 }]);
    expect(eventsOf(r.events, 'statStage')[0]!.clamped).toBe(true);
  });

  it('crit: a per-move crit stage of 2 (rate 1/2) — not a stat stage, no event of its own', () => {
    const critMove = sure('Vine Lash', 'E:crit', { effect: 'crit' });
    let crits = 0;
    let plain = 0;
    for (let seed = 0; seed < 300; seed++) {
      if (eventsOf(turn(start(ATT, DEF, seed), move(critMove.id), move(NOOP.id)).events, 'damage')[0]!.crit) crits++;
      if (eventsOf(turn(start(ATT, DEF, seed), move(TACKLE.id), move(NOOP.id)).events, 'damage')[0]!.crit) plain++;
    }
    expect(crits / 300).toBeGreaterThan(0.4);
    expect(crits / 300).toBeLessThan(0.6);
    expect(plain / 300).toBeLessThan(0.15);
    const r = turn(start(), move(critMove.id), move(NOOP.id));
    expect(eventsOf(r.events, 'statStage').length).toBe(0);
    expect(stages(r, 0)).toMatchObject({ atk: 0, def: 0, spd: 0, acc: 0, eva: 0 });
  });

  it('first: content sets priority 1; a slower battler with a priority move acts first', () => {
    expect(content.move('Quick Attack').priority).toBe(1);
    expect(content.move('Tackle').priority).toBe(0);
    const slowFirst = customMove('Quick Attack', 'E:first', { accuracy: null });
    // mufflo (105) is slower than bramblecub (108) yet moves first with Quick Attack
    const r = turn(start(), move(TACKLE.id), move(slowFirst.id));
    expect(eventsOf(r.events, 'moveUsed').map((e) => e.who.side)).toEqual([1, 0]);
    // and without it the faster side goes first
    const r2 = turn(start(), move(TACKLE.id), move(TACKLE.id));
    expect(eventsOf(r2.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
  });

  it('flinch: the defender skips its move only when the attacker moved first', () => {
    const r = turn(start(), move(FLINCH.id), move(TACKLE.id));
    expect(eventsOf(r.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
    expect(eventsOf(r.events, 'flinch')).toEqual([{ t: 'flinch', who: { side: 1, slot: 0 } }]);
    expect(activeOf(r.state, 1).volatile.flinched).toBe(false); // consumed
    // attacker moved second → no effect; the (already-acted) target keeps acting next turn
    const r2 = turn(start(), move(TACKLE.id), move(FLINCH.id));
    expect(eventsOf(r2.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
    expect(eventsOf(r2.events, 'flinch').length).toBe(0);
    expect(activeOf(r2.state, 0).volatile.flinched).toBe(false);
    const r3 = turn(r2.state, move(TACKLE.id), move(TACKLE.id));
    expect(eventsOf(r3.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
    // default chance on Knockout Blow is 30
    expect(content.move('Knockout Blow').effectChance).toBe(30);
  });

  it('burn: 1/16 max HP at end of turn, Atk-based damage ×0.5, Fire types immune', () => {
    const r = turn(start(), move(BURN.id), move(NOOP.id));
    const applied = eventsOf(r.events, 'statusApplied')[0]!;
    expect(applied).toEqual({ t: 'statusApplied', target: { side: 1, slot: 0 }, status: 'burn', source: { side: 0, slot: 0 }, turns: null });
    const d = activeOf(r.state, 1);
    expect(d.creature.status).toEqual(['burn']);
    const chip = eventsOf(r.events, 'damage').find((e) => e.cause === 'burn')!;
    expect(chip.amount).toBe(Math.floor(d.maxHp / 16));
    expect(chip.target).toEqual({ side: 1, slot: 0 });
    expect(chip.hpAfter).toBe(d.creature.hp);
    // burned attacker: halved damage vs the same seed unburned
    const burnedAtt: CreatureSpec = { ...ATT, status: ['burn'] };
    const dmgBurned = eventsOf(turn(start(burnedAtt, DEF, 3), move(TACKLE.id), move(NOOP.id)).events, 'damage')[0]!.amount;
    const dmgPlain = eventsOf(turn(start(ATT, DEF, 3), move(TACKLE.id), move(NOOP.id)).events, 'damage')[0]!.amount;
    expect(dmgBurned).toBe(Math.floor(dmgPlain / 2));
    // Fire types immune (cindercap's Flame Body, not Flash Fire — a Flash Fire holder absorbs the Fire-type move
    // itself under §2.14 step 0 before any status check, which is a different immunity)
    const vsFire = turn(start(ATT, { species: 'cindercap', level: 50, ability: 'Flame Body' }), move(BURN.id), move(NOOP.id));
    expect(eventsOf(vsFire.events, 'statusBlocked')).toEqual([{ t: 'statusBlocked', target: { side: 1, slot: 0 }, status: 'burn', reason: 'type' }]);
    expect(activeOf(vsFire.state, 1).creature.status).toEqual([]);
    // major statuses are exclusive: a second one is blocked with alreadyStatused
    const second = turn(r.state, move(POISON.id), move(NOOP.id));
    expect(eventsOf(second.events, 'statusBlocked')[0]).toMatchObject({ status: 'poison', reason: 'alreadyStatused' });
    expect(activeOf(second.state, 1).creature.status).toEqual(['burn']);
  });

  it('poison: 1/8 max HP at end of turn; Poison and Steel types immune', () => {
    const r = turn(start(), move(POISON.id), move(NOOP.id));
    const d = activeOf(r.state, 1);
    expect(d.creature.status).toEqual(['poison']);
    const chip = eventsOf(r.events, 'damage').find((e) => e.cause === 'poison')!;
    expect(chip.amount).toBe(Math.floor(d.maxHp / 8));
    // glowtent (Water/Poison): the Poison-type move connects (x0.5) and the status is refused by type.
    const vsPoison = turn(start(ATT, { species: 'glowtent', level: 50, ability: 'Swift Swim' }), move(POISON.id), move(NOOP.id));
    expect(eventsOf(vsPoison.events, 'statusBlocked')[0]).toEqual({ t: 'statusBlocked', target: { side: 1, slot: 0 }, status: 'poison', reason: 'type' });
    expect(activeOf(vsPoison.state, 1).creature.status).toEqual([]);
    // grubolt (Bug/Steel): Poison→Steel is 0 on the chart, so a Poison-TYPED status move never connects at all
    // (§2.14 step 0 precedes the status check) — moveFailed { immune }, no statusBlocked.
    const chart = turn(start(ATT, { species: 'grubolt', level: 50, ability: 'Keen Eye' }), move(POISON.id), move(NOOP.id));
    expect(eventsOf(chart.events, 'moveFailed')[0]).toEqual({ t: 'moveFailed', who: { side: 0, slot: 0 }, move: POISON.id, reason: 'immune' });
    expect(eventsOf(chart.events, 'statusBlocked').length).toBe(0);
    // ...and the Steel type's own status immunity shows once the move can connect (a Normal-typed poison move).
    const poisonN = sure('Poison Fog', 'E:poison_normal', { type: 'Normal' });
    const steel = turn(start(ATT, { species: 'grubolt', level: 50, ability: 'Keen Eye' }), move(poisonN.id), move(NOOP.id));
    expect(eventsOf(steel.events, 'statusBlocked')[0]).toMatchObject({ status: 'poison', reason: 'type' });
    expect(activeOf(steel.state, 1).creature.status).toEqual([]);
  });

  it('paralyze: Spd ×0.5, 25 % full paralysis each turn; Electric types immune', () => {
    const r = turn(start(), move(PARALYZE.id), move(NOOP.id));
    const d = activeOf(r.state, 1);
    expect(d.creature.status).toEqual(['paralyze']);
    expect(effectiveSpeed(d, 'none', content)).toBe(Math.floor(d.spd / 2));
    // full paralysis: statusTick paralyzed and no moveUsed from side 1
    const para = findSeed((seed) => {
      const st = start(ATT, DEF, seed);
      const s1 = turn(st, move(PARALYZE.id), move(NOOP.id)).state;
      const s2 = turn(s1, move(NOOP.id), move(TACKLE.id));
      return eventsOf(s2.events, 'statusTick').some((e) => e.status === 'paralyze') ? s2 : null;
    });
    expect(eventsOf(para.events, 'statusTick')[0]).toEqual({ t: 'statusTick', target: { side: 1, slot: 0 }, status: 'paralyze', detail: 'paralyzed' });
    expect(eventsOf(para.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
    let ticks = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s1 = turn(start(ATT, DEF, seed), move(PARALYZE.id), move(NOOP.id)).state;
      if (eventsOf(turn(s1, move(NOOP.id), move(TACKLE.id)).events, 'statusTick').length > 0) ticks++;
    }
    expect(ticks / 400).toBeGreaterThan(0.17);
    expect(ticks / 400).toBeLessThan(0.33);
    const imm = turn(start(ATT, { species: 'stormchick', level: 50, ability: 'Speed Boost' }), move(PARALYZE.id), move(NOOP.id));
    expect(eventsOf(imm.events, 'statusBlocked')[0]).toMatchObject({ status: 'paralyze', reason: 'type' });
  });

  it('freeze: cannot act; 20 % thaw at start of own action; a Fire hit thaws; Ice types immune', () => {
    const frozen = turn(start(), move(FREEZE.id), move(NOOP.id)).state;
    expect(activeOf(frozen, 1).creature.status).toEqual(['freeze']);
    const stuck = findSeed((seed) => {
      const s = turn({ ...frozen, rng: startBattle({ a: ATT, b: DEF, seed }).state.rng }, move(NOOP.id), move(TACKLE.id));
      return eventsOf(s.events, 'statusTick').some((e) => e.status === 'freeze') ? s : null;
    });
    expect(eventsOf(stuck.events, 'statusTick')[0]).toMatchObject({ status: 'freeze', detail: 'frozen' });
    expect(eventsOf(stuck.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
    const thawed = findSeed((seed) => {
      const s = turn({ ...frozen, rng: startBattle({ a: ATT, b: DEF, seed }).state.rng }, move(NOOP.id), move(TACKLE.id));
      return eventsOf(s.events, 'statusCured').some((e) => e.status === 'freeze' && e.cause === 'thaw') ? s : null;
    });
    expect(eventsOf(thawed.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
    expect(activeOf(thawed.state, 1).creature.status).toEqual([]);
    // Fire hit thaws
    const fireHit = turn(frozen, move(FIRE40.id), move(NOOP.id));
    expect(eventsOf(fireHit.events, 'statusCured')[0]).toEqual({ t: 'statusCured', target: { side: 1, slot: 0 }, status: 'freeze', cause: 'fireHit' });
    // Ice types immune
    const imm = turn(start(ATT, { species: 'shiveruff', level: 50, ability: 'Competitive' }), move(FREEZE.id), move(NOOP.id));
    expect(eventsOf(imm.events, 'statusBlocked')[0]).toMatchObject({ status: 'freeze', reason: 'type' });
    // Ice Beam default chance 10
    expect(content.move('Ice Beam').effectChance).toBe(10);
  });

  it('sleep: 1 + rng.int(3) turns, decremented at the start of the sleeper action, then statusCured timer', () => {
    // §2.11 step 6: at the start of EVERY action of the sleeper — including the one later in the turn the sleep
    // landed (bramblecub moved first) — the counter decrements; > 0 → statusTick + skip, 0 → statusCured and it acts.
    // So a sleep of N turns skips N − 1 actions in total, and a 1-turn sleep landing before the sleeper's action
    // is cured at that very action.
    const seen = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const r = turn(start(ATT, DEF, seed), move(SLEEP.id), move(NOOP.id));
      const applied = eventsOf(r.events, 'statusApplied')[0]!;
      expect(applied.status).toBe('sleep');
      expect([1, 2, 3]).toContain(applied.turns);
      seen.add(applied.turns!);
      const d = activeOf(r.state, 1);
      expect(d.volatile.sleepTurns).toBe(applied.turns! - 1);
      let skipped = 0;
      if (applied.turns === 1) {
        expect(eventsOf(r.events, 'statusCured')).toEqual([{ t: 'statusCured', target: { side: 1, slot: 0 }, status: 'sleep', cause: 'timer' }]);
        expect(eventsOf(r.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
        expect(d.creature.status).toEqual([]);
        continue;
      }
      expect(eventsOf(r.events, 'statusTick')).toEqual([{ t: 'statusTick', target: { side: 1, slot: 0 }, status: 'sleep', detail: 'asleep' }]);
      expect(eventsOf(r.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
      expect(d.creature.status).toEqual(['sleep']);
      skipped++;
      let st = r.state;
      let cured = false;
      for (let i = 0; i < 4 && !cured; i++) {
        const t = turn(st, move(NOOP.id), move(TACKLE.id));
        st = t.state;
        if (eventsOf(t.events, 'statusTick').some((e) => e.status === 'sleep')) {
          skipped++;
          expect(eventsOf(t.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
        } else {
          cured = true;
          expect(eventsOf(t.events, 'statusCured')[0]).toEqual({ t: 'statusCured', target: { side: 1, slot: 0 }, status: 'sleep', cause: 'timer' });
          expect(eventsOf(t.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
          expect(activeOf(t.state, 1).volatile.sleepTurns).toBe(0);
          expect(activeOf(t.state, 1).creature.status).toEqual([]);
        }
      }
      expect(cured).toBe(true);
      expect(skipped).toBe(applied.turns! - 1);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(content.move('Hypno Fog').effectChance).toBe(100);
  });

  it('confuse: 2 + rng.int(3) turns; 33 % self-hit with a 40-power typeless move (own Atk vs own Def, no crit/STAB)', () => {
    const seenTurns = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const r = turn(start(ATT, DEF, seed), move(CONFUSE.id), move(NOOP.id));
      const applied = eventsOf(r.events, 'statusApplied')[0]!;
      expect(applied.status).toBe('confuse');
      expect([2, 3, 4]).toContain(applied.turns);
      seenTurns.add(applied.turns!);
      expect(activeOf(r.state, 1).creature.status).toEqual(['confuse']);
      // §2.11 step 6: the confused side acted later this same turn, so the counter has already ticked once
      expect(activeOf(r.state, 1).volatile.confusedTurns).toBe(applied.turns! - 1);
    }
    expect([...seenTurns].sort()).toEqual([2, 3, 4]);
    // a state with at least two confused turns left, so the next action can be a self-hit rather than the cure
    const confused = findSeed((seed) => {
      const s = turn(start(ATT, DEF, seed), move(CONFUSE.id), move(NOOP.id)).state;
      return activeOf(s, 1).volatile.confusedTurns >= 2 ? s : null;
    });
    const selfHit = findSeed((seed) => {
      const s = turn({ ...confused, rng: startBattle({ a: ATT, b: DEF, seed }).state.rng }, move(NOOP.id), move(TACKLE.id));
      return eventsOf(s.events, 'damage').some((e) => e.cause === 'confusion') ? s : null;
    });
    const hit = eventsOf(selfHit.events, 'damage').find((e) => e.cause === 'confusion')!;
    const d = activeOf(confused, 1);
    const L = d.creature.level;
    const sp = content.species(d.creature.speciesId);
    const A = calcStat(sp.baseAtk, L);
    const D = calcStat(sp.baseDef, L);
    const expected = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * 40 * A) / D) / 50) + 2;
    expect(hit).toMatchObject({ target: { side: 1, slot: 0 }, source: { side: 1, slot: 0 }, amount: expected, crit: false, stab: false, effectiveness: 1, move: null });
    expect(eventsOf(selfHit.events, 'statusTick')[0]).toMatchObject({ status: 'confuse', detail: 'confused' });
    expect(eventsOf(selfHit.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
    // the counter runs down to statusCured { confuse, timer }
    let st = confused;
    let cured = false;
    for (let i = 0; i < 5 && !cured; i++) {
      const t = turn(st, move(NOOP.id), move(NOOP.id));
      st = t.state;
      cured = eventsOf(t.events, 'statusCured').some((e) => e.status === 'confuse' && e.cause === 'timer');
    }
    expect(cured).toBe(true);
    expect(activeOf(st, 1).creature.status).toEqual([]);
    // confusion coexists with a major status
    const both = turn(turn(start(), move(BURN.id), move(NOOP.id)).state, move(CONFUSE.id), move(NOOP.id));
    expect(activeOf(both.state, 1).creature.status).toEqual(['burn', 'confuse']);
  });

  it('trap: 4 + rng.int(2) turns, 1/8 chip at end of turn, no switch or flee; cleared when either active leaves', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const r = turn(start(ATT, DEF, seed), move(TRAP.id), move(NOOP.id));
      const ev = eventsOf(r.events, 'trapped')[0]!;
      expect([4, 5]).toContain(ev.turns);
      seen.add(ev.turns);
      expect(ev).toMatchObject({ target: { side: 1, slot: 0 }, source: { side: 0, slot: 0 } });
      const d = activeOf(r.state, 1);
      // chip already ticked once this turn: counter is turns - 1
      expect(d.volatile.trappedTurns).toBe(ev.turns - 1);
      const chip = eventsOf(r.events, 'damage').find((e) => e.cause === 'trap')!;
      expect(chip.amount).toBe(Math.floor(d.maxHp / 8));
    }
    expect([...seen].sort()).toEqual([4, 5]);
    // trapped side cannot switch or flee (wild)
    const wild = start({ ...ATT }, { ...DEF, kind: undefined } as CreatureSpec, 'w', 'wild');
    const wildTrapped = turn(start(DEF, ATT, 'w2', 'wild'), move(NOOP.id), move(TRAP.id)).state; // side 0 (mufflo) trapped by side 1
    expect(activeOf(wildTrapped, 0).volatile.trappedTurns).toBeGreaterThan(0);
    expect(validateAction(wildTrapped, 0, FLEE, content)).toBeNull(); // flee is accepted, then fails in-turn
    const fleeTry = turn(wildTrapped, FLEE, null);
    expect(eventsOf(fleeTry.events, 'moveFailed')[0]).toEqual({ t: 'moveFailed', who: { side: 0, slot: 0 }, move: null, reason: 'trapped' });
    expect(eventsOf(fleeTry.events, 'fled').length).toBe(0);
    expect(fleeTry.state.ended).toBeNull();
    expect(eventsOf(fleeTry.events, 'moveUsed').map((e) => e.who.side)).toEqual([1]); // the wild side still acts
    void wild;
    const twoParty = startBattle({ a: [DEF, ATT], b: ATT, seed: 't' }).state;
    const trappedTwo = turn(twoParty, move(NOOP.id), move(TRAP.id)).state;
    expect(validateAction(trappedTwo, 0, sw(1), content)).toBe('trapped');
    // the counter runs to 0 → trapEnd
    let st = trappedTwo;
    let ended = false;
    for (let i = 0; i < 6 && !ended; i++) {
      const t = turn(st, move(NOOP.id), move(NOOP.id));
      st = t.state;
      ended = eventsOf(t.events, 'trapEnd').length > 0;
    }
    expect(ended).toBe(true);
    expect(activeOf(st, 0).volatile.trappedTurns).toBe(0);
    expect(validateAction(st, 0, sw(1), content)).toBeNull();
    // the trapper leaving the field frees the target
    const trapperBench = startBattle({ a: DEF, b: [ATT, DEF], seed: 't2' }).state;
    const held = turn(trapperBench, move(NOOP.id), move(TRAP.id)).state;
    const freed = turn(held, move(NOOP.id), sw(1));
    expect(eventsOf(freed.events, 'trapEnd')).toEqual([{ t: 'trapEnd', target: { side: 0, slot: 0 } }]);
    expect(activeOf(freed.state, 0).volatile.trappedTurns).toBe(0);
  });

  it('recoil: attacker loses floor(damageDealt / 4), min 1, as damage { cause: recoil }', () => {
    const r = turn(start(), move(RECOIL.id), move(NOOP.id));
    const dmg = eventsOf(r.events, 'damage');
    const hit = dmg.find((e) => e.cause === 'move')!;
    const recoil = dmg.find((e) => e.cause === 'recoil')!;
    expect(recoil).toMatchObject({ target: { side: 0, slot: 0 }, source: { side: 0, slot: 0 }, amount: Math.max(1, Math.floor(hit.amount / 4)), move: RECOIL.id });
    expect(activeOf(r.state, 0).creature.hp).toBe(activeOf(r.state, 0).maxHp - recoil.amount);
    // a missed move deals no recoil
    const missy = customMove('Flare Blitz', 'E:recoil_miss', { accuracy: 1, type: 'Normal' });
    const missed = findSeed((seed) => {
      const t = turn(start(ATT, DEF, seed), move(missy.id), move(NOOP.id));
      return eventsOf(t.events, 'moveMissed').length > 0 ? t : null;
    });
    expect(eventsOf(missed.events, 'damage').length).toBe(0);
  });

  it('drain: attacker heals floor(damageDealt / 2), min 1, capped at max HP', () => {
    const hurt: CreatureSpec = { ...ATT, hp: 30 };
    const r = turn(start(hurt, DEF), move(DRAIN.id), move(NOOP.id));
    const hit = eventsOf(r.events, 'damage')[0]!;
    const heal = eventsOf(r.events, 'heal')[0]!;
    expect(heal).toEqual({ t: 'heal', target: { side: 0, slot: 0 }, amount: Math.max(1, Math.floor(hit.amount / 2)), hpAfter: 30 + Math.floor(hit.amount / 2), cause: 'drain', item: null });
    // at full hp the heal is 0 (capped)
    const full = turn(start(), move(DRAIN.id), move(NOOP.id));
    expect(eventsOf(full.events, 'heal')[0]!.amount).toBe(0);
    expect(activeOf(full.state, 0).creature.hp).toBe(activeOf(full.state, 0).maxHp);
  });

  it('heal: floor(maxHp / 2); fails with moveFailed { fullHp } at full HP, PP still spent', () => {
    const hurt: CreatureSpec = { ...ATT, hp: 10 };
    const r = turn(start(hurt, DEF), move(HEAL.id), move(NOOP.id));
    const a = activeOf(r.state, 0);
    expect(eventsOf(r.events, 'heal')[0]).toEqual({ t: 'heal', target: { side: 0, slot: 0 }, amount: Math.floor(a.maxHp / 2), hpAfter: 10 + Math.floor(a.maxHp / 2), cause: 'move', item: null });
    const full = turn(start(), move(HEAL.id), move(NOOP.id));
    expect(eventsOf(full.events, 'moveFailed')[0]).toEqual({ t: 'moveFailed', who: { side: 0, slot: 0 }, move: HEAL.id, reason: 'fullHp' });
    expect(eventsOf(full.events, 'heal').length).toBe(0);
    const used = eventsOf(full.events, 'moveUsed')[0]!;
    expect(used.ppLeft).toBe(HEAL.pp - 1);
    expect(activeOf(full.state, 0).creature.moves.find((m) => m.id === HEAL.id)!.pp).toBe(HEAL.pp - 1);
  });

  it('weather: type → kind mapping, 5 turns (setting turn counts), replaces the current weather', () => {
    expect(weatherForType('Water')).toBe('rain');
    expect(weatherForType('Fire')).toBe('sun');
    expect(weatherForType('Ice')).toBe('hail');
    expect(weatherForType('Rock')).toBe('sand');
    expect(weatherForType('Ground')).toBe('sand');
    expect(weatherForType('Normal')).toBe('sand');
    for (const [m, kind] of [[SAND, 'sand'], [HAIL, 'hail'], [RAIN, 'rain'], [SUNW, 'sun'], [OTHERW, 'sand']] as const) {
      const r = turn(start(), move(m.id), move(NOOP.id));
      expect(eventsOf(r.events, 'weatherSet')[0]).toEqual({ t: 'weatherSet', kind, turns: 5, source: { side: 0, slot: 0 } });
      expect(r.state.field.weather).toEqual({ kind, turns: 4 }); // the setting turn was turn 1 of 5
      expect(eventsOf(r.events, 'weatherTick')[0]).toEqual({ t: 'weatherTick', kind, turnsLeft: 4 });
    }
    // lasts exactly 5 end-of-turns
    let st = turn(start(), move(SAND.id), move(NOOP.id)).state;
    for (let left = 3; left >= 1; left--) {
      const t = turn(st, move(NOOP.id), move(NOOP.id));
      st = t.state;
      expect(eventsOf(t.events, 'weatherTick')[0]).toEqual({ t: 'weatherTick', kind: 'sand', turnsLeft: left });
    }
    const last = turn(st, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(last.events, 'weatherEnd')).toEqual([{ t: 'weatherEnd', kind: 'sand' }]);
    expect(last.state.field.weather).toEqual({ kind: 'none', turns: 0 });
    // sand chips non Rock/Ground/Steel for 1/16 each end of turn; hail chips non-Ice
    const sandy = turn(start(), move(SAND.id), move(NOOP.id));
    const chips = eventsOf(sandy.events, 'damage').filter((e) => e.cause === 'sand');
    expect(chips.map((e) => e.target.side)).toEqual([0, 1]);
    expect(chips[0]!.amount).toBe(Math.floor(activeOf(sandy.state, 0).maxHp / 16));
    const rockSide = turn(start(ATT, { species: 'pebblit', level: 50, ability: 'Regenerator' }), move(SAND.id), move(NOOP.id));
    expect(eventsOf(rockSide.events, 'damage').filter((e) => e.cause === 'sand').map((e) => e.target.side)).toEqual([0]);
    const icy = turn(start(ATT, { species: 'shiveruff', level: 50, ability: 'Competitive' }), move(HAIL.id), move(NOOP.id));
    expect(eventsOf(icy.events, 'damage').filter((e) => e.cause === 'hail').map((e) => e.target.side)).toEqual([0]);
    // replaces
    const replaced = turn(turn(start(), move(SAND.id), move(NOOP.id)).state, move(HAIL.id), move(NOOP.id));
    expect(replaced.state.field.weather).toEqual({ kind: 'hail', turns: 4 });
  });

  it('sun: sets sun for 5 turns; Chlorophyll doubles speed under it; Fire ×1.5 / Water ×0.5', () => {
    const r = turn(start(), move(SUN.id), move(NOOP.id));
    expect(eventsOf(r.events, 'weatherSet')[0]).toEqual({ t: 'weatherSet', kind: 'sun', turns: 5, source: { side: 0, slot: 0 } });
    expect(r.state.field.weather).toEqual({ kind: 'sun', turns: 4 });
    const a = activeOf(r.state, 0);
    expect(effectiveSpeed(a, 'sun', content)).toBe(a.spd * 2);
    expect(effectiveSpeed(a, 'none', content)).toBe(a.spd);
    // Fire damage is boosted under the sun for the same seed (r is fixed by seed; compare with/without sun)
    const plain = eventsOf(turn(start(ATT, DEF, 9), move(FIRE40.id), move(NOOP.id)).events, 'damage')[0]!.amount;
    const sunny = eventsOf(turn({ ...start(ATT, DEF, 9), field: { weather: { kind: 'sun', turns: 5 }, terrain: 'grove' } }, move(FIRE40.id), move(NOOP.id)).events, 'damage')[0]!.amount;
    expect(sunny).toBe(Math.floor((plain * 3) / 2));
    expect(content.move('Sunny Day').target).toBe('field');
  });

  it('status-move accuracy is rolled: a missed status move has no effect and emits moveMissed', () => {
    const shaky = customMove('Growl', 'E:shaky', { accuracy: 50 });
    const miss = findSeed((seed) => {
      const t = turn(start(ATT, DEF, seed), move(shaky.id), move(NOOP.id));
      return eventsOf(t.events, 'moveMissed').length > 0 ? t : null;
    });
    expect(eventsOf(miss.events, 'moveMissed')[0]).toEqual({ t: 'moveMissed', who: { side: 0, slot: 0 }, move: shaky.id, target: { side: 1, slot: 0 } });
    expect(stages(miss, 1).atk).toBe(0);
    expect(eventsOf(miss.events, 'moveUsed')[0]!.ppLeft).toBe(shaky.pp - 1);
  });
});
