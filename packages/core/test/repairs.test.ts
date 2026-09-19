/**
 * PLAN.md "Combat — Repairs to the migrated formula": one regression per row, each written so the legacy behaviour
 * would fail it. The two legacy battle paths (battleSocket.js / wildBattleService.js) are replaced by this one core.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../src/index';
import { calcStat, createRng, eloDelta, typeMultiplier } from '../src/index';
import type { Battler, MoveDef, SpeciesDef, TypeName } from '../src/index';
import { accuracyCheck } from '../src/accuracy';
import { catchValue } from '../src/catch';
import { calcDamageFor, damageAmount } from '../src/damage';
import { EFFECT_HANDLERS } from '../src/effects';
import { activeOf, battler, content, customMove, eventsOf, findSeed, move, scriptedRng, startBattle, sw, turn } from './helpers';
import type { CreatureSpec } from './helpers';

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'R:noop', { effect: null });
const GROWL = sure('Growl', 'R:growl');
const TACKLE = sure('Tackle', 'R:tackle');
const GRASS70 = sure('Vine Lash', 'R:grass70'); // Grass 70: STAB for bramblecub
const NORMAL70 = sure('Vine Lash', 'R:normal70', { type: 'Normal' });
const ACC70 = customMove('Vine Lash', 'R:acc70', { type: 'Normal', accuracy: 70 });

const A = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [TACKLE.id, GROWL.id, NOOP.id, GRASS70.id], ...extra });
const D = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [TACKLE.id, GROWL.id, NOOP.id], ...extra });

const inp = (attacker: Battler, defender: Battler) => ({ attacker, defender, weather: 'none' as const });
/** crit roll 1 (no crit), random factor 85 + 15 = 100 (×1): the damage is the formula with no random noise. */
const fixedRng = () => scriptedRng([1, 15]);

describe('PLAN.md combat repairs', () => {
  it('repair: STAB ×3/2 — a move matching one of the attacker’s types deals floor(base × 3 / 2) and flags stab', () => {
    const att = battler(A());
    const def = battler(D());
    const grass = calcDamageFor(inp(att, def), GRASS70, fixedRng(), content);
    const normal = calcDamageFor(inp(att, def), NORMAL70, fixedRng(), content);
    expect(grass.stab).toBe(true);
    expect(normal.stab).toBe(false);
    // hand-computed §2.14 steps 1–3 with r = 100, effectiveness 1 for both moves
    const L = 50;
    const Aatk = calcStat(62, L);
    const Ddef = calcStat(50, L);
    const base = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * 70 * Aatk) / Ddef) / 50) + 2;
    expect(normal.amount).toBe(base);
    expect(grass.amount).toBe(Math.floor((base * 3) / 2));
    expect(grass.amount).toBeGreaterThan(normal.amount);
  });

  it('repair: accuracy rolls — a 70-accuracy move misses when rng.int(100) lands in 70..99 and hits on 0..69', () => {
    const att = battler(A());
    const def = battler(D());
    for (const roll of [0, 35, 69]) expect(accuracyCheck(att, def, ACC70, 'none', content, scriptedRng([roll]))).toBe(true);
    for (const roll of [70, 71, 85, 99]) expect(accuracyCheck(att, def, ACC70, 'none', content, scriptedRng([roll]))).toBe(false);
    // and a miss really does nothing in a turn: moveMissed, no damage, PP spent
    const st = startBattle({ a: A(), b: D() }).state;
    const missed = findSeed((seed) => {
      const r = turn({ ...st, rng: createRng(seed).snapshot() }, move(ACC70.id), move(NOOP.id));
      return eventsOf(r.events, 'moveMissed').length > 0 ? r : null;
    });
    expect(eventsOf(missed.events, 'damage').length).toBe(0);
    expect(eventsOf(missed.events, 'moveUsed')[0]!.ppLeft).toBe(ACC70.pp - 1);
    // the 4 sub-80 % legacy moves are real accuracies in content, not decoration
    const shaky = content.moveIds.filter((id) => (content.move(id).accuracy ?? 100) < 80);
    expect(shaky.length).toBeGreaterThanOrEqual(4);
    let hits = 0;
    for (let seed = 0; seed < 300; seed++) {
      const r = turn({ ...st, rng: createRng(seed).snapshot() }, move(ACC70.id), move(NOOP.id));
      if (eventsOf(r.events, 'damage').length > 0) hits++;
    }
    expect(hits / 300).toBeGreaterThan(0.6);
    expect(hits / 300).toBeLessThan(0.8);
  });

  it('repair: nine effects implemented — crit, heal, recoil, trap, drain, raise_all, weather, sun are live; lower_spAtk is content-rewritten', () => {
    const handlers = Object.keys(EFFECT_HANDLERS);
    for (const e of ['crit', 'heal', 'recoil', 'trap', 'drain', 'raise_all', 'weather', 'sun', 'lower_spAtk']) expect(handlers).toContain(e);
    const start = () => startBattle({ a: A({ hp: 40 }), b: D(), seed: 'nine' }).state;
    // crit: rate 1/2 observable
    const CRIT = sure('Vine Lash', 'R:crit', { effect: 'crit' });
    let crits = 0;
    for (let seed = 0; seed < 200; seed++) if (eventsOf(turn({ ...start(), rng: createRng(seed).snapshot() }, move(CRIT.id), move(NOOP.id)).events, 'damage')[0]!.crit) crits++;
    expect(crits).toBeGreaterThan(70);
    expect(crits).toBeLessThan(130);
    // heal
    const heal = turn(start(), move(sure('Synthesis', 'R:heal').id), move(NOOP.id));
    expect(eventsOf(heal.events, 'heal')[0]).toMatchObject({ cause: 'move', amount: Math.floor(activeOf(heal.state, 0).maxHp / 2) });
    // recoil
    const recoil = turn(start(), move(sure('Flare Blitz', 'R:recoil', { type: 'Normal' }).id), move(NOOP.id));
    expect(eventsOf(recoil.events, 'damage').some((e) => e.cause === 'recoil' && e.target.side === 0)).toBe(true);
    // trap
    const trap = turn(start(), move(sure('Fairy Lock', 'R:trap', { type: 'Normal' }).id), move(NOOP.id));
    expect(eventsOf(trap.events, 'trapped')[0]).toMatchObject({ target: { side: 1, slot: 0 } });
    expect(eventsOf(trap.events, 'damage').some((e) => e.cause === 'trap')).toBe(true);
    // drain
    const drain = turn(start(), move(sure('Nature Drain', 'R:drain').id), move(NOOP.id));
    expect(eventsOf(drain.events, 'heal')[0]).toMatchObject({ cause: 'drain', target: { side: 0, slot: 0 } });
    // raise_all
    const all = turn(start(), move(sure('Ancient Power', 'R:raise_all').id), move(NOOP.id));
    expect(activeOf(all.state, 0).stages).toMatchObject({ atk: 1, def: 1, spd: 1 });
    // weather / sun
    expect(turn(start(), move(sure('Sandstorm', 'R:sand').id), move(NOOP.id)).state.field.weather.kind).toBe('sand');
    expect(turn(start(), move(sure('Sunny Day', 'R:sun').id), move(NOOP.id)).state.field.weather.kind).toBe('sun');
    // lower_spAtk never reaches core from content: every legacy lower_spAtk move is now lower_atk on the defender
    for (const id of content.moveIds) expect(content.move(id).effect).not.toBe('lower_spAtk');
    expect(content.move('Moonblast').effect).toBe('lower_atk');
  });

  it('repair: stages are not permanent — Battler.atk/def/spd never change; stages reset to 0 on switch-out', () => {
    const st = startBattle({ a: [A(), A()], b: D() }).state;
    const before = activeOf(st, 0);
    const lowered = turn(st, move(NOOP.id), move(GROWL.id)).state;
    const b = activeOf(lowered, 0);
    expect(b.stages.atk).toBe(-1);
    expect([b.atk, b.def, b.spd]).toEqual([before.atk, before.def, before.spd]);
    expect(b.atk).toBe(calcStat(62, 50));
    // six more Growls floor the stage at -6 and still leave the base stat alone
    let s = lowered;
    for (let i = 0; i < 6; i++) s = turn(s, move(NOOP.id), move(GROWL.id)).state;
    expect(activeOf(s, 0).stages.atk).toBe(-6);
    expect(activeOf(s, 0).atk).toBe(before.atk);
    // switching out and back resets to 0 — the legacy mutation would have carried -7 Atk points forever
    const out = turn(s, sw(1), move(NOOP.id)).state;
    expect(out.sides[0].party[0]!.stages.atk).toBe(0);
    const back = turn(out, sw(0), move(NOOP.id)).state;
    expect(activeOf(back, 0).stages.atk).toBe(0);
    expect(activeOf(back, 0).atk).toBe(before.atk);
    // the persisted creature carries no derived stat at all
    expect(Object.keys(activeOf(back, 0).creature)).not.toContain('atk');
  });

  it('repair: burn halves damage — a burned attacker deals floor(x / 2) (Guts excepted)', () => {
    const burned = battler(A({ status: ['burn'] }));
    const healthy = battler(A());
    const def = battler(D());
    const h = calcDamageFor(inp(healthy, def), NORMAL70, fixedRng(), content).amount;
    const b = calcDamageFor(inp(burned, def), NORMAL70, fixedRng(), content).amount;
    expect(b).toBe(Math.floor(h / 2));
    expect(b).toBeLessThan(h);
    const guts = battler(A({ status: ['burn'], ability: 'Guts' }));
    expect(calcDamageFor(inp(guts, def), NORMAL70, fixedRng(), content).amount).toBeGreaterThan(h);
  });

  it('repair: immunity is zero — every ×0 chart pair deals 0 (never the min-1 clamp), in calcDamage and in a turn', () => {
    const zeros: [TypeName, TypeName][] = [];
    for (const atk of core.TYPE_NAMES) {
      for (const def of core.TYPE_NAMES) if (typeMultiplier(content.typeChart, atk, [def]) === 0) zeros.push([atk, def]);
    }
    expect(zeros.length).toBeGreaterThanOrEqual(8);
    const base = content.species('mufflo');
    for (const [atk, def] of zeros) {
      const sp: SpeciesDef = { ...base, id: `R:imm_${def}`, name: `Imm ${def}`, types: [def] };
      content.withSpecies(sp);
      const mv = customMove('Vine Lash', `R:imm_${atk}`, { type: atk, accuracy: null });
      const target = battler({ species: sp.id, level: 50, ability: 'Natural Cure' });
      const res = calcDamageFor(inp(battler(A()), target), mv, scriptedRng([]), content); // no draw is made
      expect(res).toEqual({ amount: 0, effectiveness: 0, crit: false, stab: false, absorbed: null });
      const r = turn(startBattle({ a: A(), b: { species: sp.id, level: 50, ability: 'Natural Cure' } }).state, move(mv.id), move(NOOP.id));
      expect(eventsOf(r.events, 'damage').filter((e) => e.target.side === 1).length).toBe(0);
      expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ move: mv.id, reason: 'immune' });
    }
    // the min-1 clamp exists only past step 0
    expect(damageAmount(inp(battler(A({ level: 1 })), battler(D({ level: 100 }))), TACKLE, 1, false, 85, content).amount).toBeGreaterThanOrEqual(1);
  });

  it('repair: lower_atk hits the defender — in wild, trainer and pvp alike, never the user', () => {
    for (const format of ['wild', 'trainer', 'pvp'] as const) {
      const r = turn(startBattle({ a: A(), b: D(), format }).state, move(GROWL.id), format === 'wild' ? null : move(NOOP.id));
      expect(activeOf(r.state, 1).stages.atk, format).toBe(-1);
      expect(activeOf(r.state, 0).stages.atk, format).toBe(0);
      const ev = eventsOf(r.events, 'statStage').find((e) => e.cause === 'move')!;
      expect(ev).toMatchObject({ target: { side: 1, slot: 0 }, source: { side: 0, slot: 0 }, stat: 'atk', delta: -1 });
    }
    // the 9 legacy lower_atk moves plus the rewritten lower_spAtk ones all point at the defender
    const lowerers = content.moveIds.filter((id) => content.move(id).effect === 'lower_atk');
    expect(lowerers.length).toBeGreaterThanOrEqual(9);
    for (const id of lowerers) expect(content.move(id).target).toBe('foe');
  });

  it('repair: Intimidate once — −1 Atk on entry only; calcDamage never applies a per-calc ×0.75', () => {
    const start = startBattle({ a: A({ ability: 'Intimidate' }), b: D() });
    expect(eventsOf(start.events, 'statStage')).toHaveLength(1);
    let st = start.state;
    for (let i = 0; i < 3; i++) {
      const r = turn(st, move(TACKLE.id), move(TACKLE.id));
      expect(eventsOf(r.events, 'statStage')).toHaveLength(0);
      st = r.state;
    }
    expect(activeOf(st, 1).stages.atk).toBe(-1);
    // the intimidated foe's damage equals a plain -1-stage calc: the defender's Intimidate contributes nothing
    const foe = activeOf(st, 1);
    const vsIntimidate = battler(A({ ability: 'Intimidate' }));
    const vsPlain = battler(A({ ability: 'Chlorophyll' }));
    expect(calcDamageFor(inp(foe, vsIntimidate), TACKLE, fixedRng(), content).amount).toBe(calcDamageFor(inp(foe, vsPlain), TACKLE, fixedRng(), content).amount);
    // a re-entry fires it again (once per entry, as designed)
    const bench = startBattle({ a: [A({ ability: 'Chlorophyll' }), A({ ability: 'Intimidate' })], b: D() }).state;
    const swapped = turn(bench, sw(1), move(NOOP.id));
    expect(eventsOf(swapped.events, 'statStage')).toHaveLength(1);
  });

  it('repair: Elo loser negative — the loser never gains; the legacy Math.max(10, negative) is gone', () => {
    // the legacy case: a 1000-rated loser vs a 2000-rated winner "gained" +10
    const upset = eloDelta(2000, 1000);
    expect(upset.loserDelta).toBeLessThanOrEqual(0);
    expect(upset.winnerDelta).toBeGreaterThanOrEqual(0);
    expect(eloDelta(1000, 1000)).toEqual({ winnerDelta: 16, loserDelta: -16 });
    const rng = createRng('elo-repair');
    for (let i = 0; i < 2000; i++) {
      const w = rng.int(3000);
      const l = rng.int(3000);
      const d = eloDelta(w, l);
      expect(d.loserDelta).toBeLessThanOrEqual(0);
      expect(d.winnerDelta).toBeGreaterThanOrEqual(0);
    }
  });

  it('repair: champion is zeon — the league roster’s champion id is "zeon"; a championCleared check keyed on "goku" can never be true', () => {
    // @ewa/content does not ship LEAGUE yet; the canonical roster is the legacy league.js this content migrates from.
    const src = readFileSync(fileURLToPath(new URL('../../../.design/legacy/league.js', import.meta.url)), 'utf8');
    const roster = loadRoster(src);
    const champions = roster.filter((t) => t.stage === 'champion');
    expect(champions.map((t) => t.id)).toEqual(['zeon']);
    expect(roster.some((t) => t.id === 'goku')).toBe(false);
    const championCleared = (defeated: readonly string[]): boolean => champions.every((c) => defeated.includes(c.id));
    expect(championCleared(['zeon'])).toBe(true);
    expect(championCleared(['goku'])).toBe(false);
    expect(championCleared(roster.map((t) => t.id))).toBe(true);
    // the legacy bug is real and lives only in the legacy file
    expect(src).toContain('defeatedSet.has("goku")');
  });

  it('repair: one catch formula — core exports a single catch surface (CATCH_B) and one resolution, the Gen curve with a status bonus', () => {
    const exported = Object.keys(core).sort();
    const catchExports = exported.filter((k) => /catch/i.test(k));
    expect(catchExports).toEqual(['CATCH_B']);
    expect(exported).not.toContain('calcCatch');
    expect(exported).not.toContain('catchChance');
    expect(exported).not.toContain('resolveCatch');
    // the one curve: status doubles `a` for sleep/freeze, ×1.5 for the others, alpha halves the rate
    const wild = battler(D());
    const asleep = battler(D({ status: ['sleep'] }));
    const burned = battler(D({ status: ['burn'] }));
    const alpha = battler(D({ isAlpha: true }));
    const sp = content.species('mufflo');
    const orb = content.orb('spark_orb');
    const a0 = catchValue(wild, sp, orb);
    expect(catchValue(asleep, sp, orb)).toBe(Math.floor(((3 * wild.maxHp - 2 * wild.creature.hp) * sp.catchRate * 1 * 2) / (3 * wild.maxHp)));
    expect(catchValue(asleep, sp, orb)).toBeGreaterThan(a0);
    expect(catchValue(burned, sp, orb)).toBeGreaterThan(a0);
    expect(catchValue(alpha, sp, orb)).toBeLessThan(a0);
    // a battle catch and the standalone `a` agree: aether_orb (999) is always >= 255 → 0 draws
    const r = turn(startBattle({ a: A(), b: D(), format: 'wild' }).state, { kind: 'catch', orb: 'aether_orb' }, null);
    expect(r.state.ended).toEqual({ winner: 'caught', slot: 0 });
  });
});

interface RosterEntry {
  readonly id: string;
  readonly stage: string;
}

/** Evaluates the CommonJS legacy roster in a sandboxed wrapper (data only, no requires) and returns id/stage pairs. */
function loadRoster(src: string): RosterEntry[] {
  const mod: { exports: { LEAGUE_TRAINERS?: RosterEntry[] } } = { exports: {} };
  const fn = new Function('module', 'exports', src) as (m: typeof mod, e: unknown) => void;
  fn(mod, mod.exports);
  const roster = mod.exports.LEAGUE_TRAINERS;
  if (roster === undefined) throw new Error('legacy league.js exports no LEAGUE_TRAINERS');
  return roster.map((t) => ({ id: t.id, stage: t.stage }));
}
