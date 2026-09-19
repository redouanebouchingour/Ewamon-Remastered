import { describe, expect, it } from 'vitest';
import { calcDamage, calcStat, createRng } from '../src/index';
import type { Battler, MoveDef } from '../src/index';
import { calcDamageFor, damageAmount, damageStop } from '../src/damage';
import type { DamageInputs } from '../src/damage';
import { battler, content, countingRng, customMove, scriptedRng, startBattle } from './helpers';

/**
 * Baseline pair: bramblecub (Grass, baseAtk 62) L50 → A = 122; cindercap (Fire, baseDef 44) L50 → D = 104;
 * mufflo (Normal, baseDef 50) L50 → D = 110. All values below are hand-computed from §2.14.
 */
const atk = (): Battler => battler({ species: 'bramblecub', level: 50 });
const fireDef = (): Battler => battler({ species: 'cindercap', level: 50 });
// mufflo's default ability is Thick Fat, which is itself a damage hook — the baseline uses Natural Cure (no hook).
const normalDef = (): Battler => battler({ species: 'mufflo', level: 50, ability: 'Natural Cure' });

const N70 = customMove('Vine Lash', 'T:Normal70', { type: 'Normal', effect: null });
const G70 = customMove('Vine Lash', 'T:Grass70', { effect: null });
const F70 = customMove('Vine Lash', 'T:Fire70', { type: 'Fire', effect: null });
const W70 = customMove('Vine Lash', 'T:Water70', { type: 'Water', effect: null });
const I70 = customMove('Vine Lash', 'T:Ice70', { type: 'Ice', effect: null });
const GROUND70 = customMove('Vine Lash', 'T:Ground70', { type: 'Ground', effect: null });
const E70 = customMove('Vine Lash', 'T:Electric70', { type: 'Electric', effect: null });
const G70CRIT = customMove('Vine Lash', 'T:Grass70crit', { effect: 'crit' });

const inp = (attacker: Battler, defender: Battler, weather: DamageInputs['weather'] = 'none'): DamageInputs => ({ attacker, defender, weather });
const dmg = (i: DamageInputs, m: MoveDef, eff: 0 | 0.25 | 0.5 | 1 | 2 | 4 = 1, crit = false, r = 100): number =>
  damageAmount(i, m, eff, crit, r, content).amount;

describe('§2.14 damage — the 12 steps, each isolated', () => {
  it('stat inputs are the §2.7 values', () => {
    expect(atk().atk).toBe(122);
    expect(fireDef().def).toBe(104);
    expect(normalDef().def).toBe(110);
    expect(calcStat(62, 50)).toBe(122);
  });

  it('step 2 base: floor(floor(floor(2L/5 + 2) * P * A / D) / 50) + 2', () => {
    // floor(2*50/5 + 2) = 22; 22 * 70 * 122 = 187880; / 110 = 1708.0 → 1708; / 50 = 34.16 → 34; + 2 = 36
    expect(dmg(inp(atk(), normalDef()), N70)).toBe(36);
    // vs cindercap: 187880 / 104 = 1806.5 → 1806; / 50 → 36; + 2 = 38
    expect(dmg(inp(atk(), fireDef()), N70)).toBe(38);
  });

  it('step 3 STAB: ×3/2 floored, only when the move type is one of the attacker types', () => {
    expect(dmg(inp(atk(), normalDef()), N70)).toBe(36);
    expect(dmg(inp(atk(), normalDef()), G70)).toBe(54); // floor(36 * 3 / 2)
    const smell = battler({ species: 'smellduck', level: 50 }); // Grass/Normal: both STAB
    const base = dmg(inp(smell, fireDef()), customMove('Vine Lash', 'T:Fire70b', { type: 'Fire', effect: null }));
    expect(dmg(inp(smell, fireDef()), N70)).toBe(Math.floor((base * 3) / 2));
    expect(calcDamageFor(inp(atk(), normalDef()), G70, scriptedRng([1, 15]), content).stab).toBe(true);
    expect(calcDamageFor(inp(atk(), normalDef()), N70, scriptedRng([1, 15]), content).stab).toBe(false);
  });

  it('step 4 type: exact ×0.25 / ×0.5 / ×2 / ×4 after STAB', () => {
    const i = inp(atk(), normalDef());
    expect(dmg(i, G70, 1)).toBe(54);
    expect(dmg(i, G70, 2)).toBe(108);
    expect(dmg(i, G70, 4)).toBe(216);
    expect(dmg(i, G70, 0.5)).toBe(27);
    expect(dmg(i, G70, 0.25)).toBe(13); // floor(13.5)
    // the effectiveness fed by the pipeline comes from typeMultiplier over the defender's types
    const vsFire = calcDamageFor(inp(atk(), fireDef()), G70, scriptedRng([1, 15]), content);
    expect(vsFire.effectiveness).toBe(0.5);
    expect(vsFire.amount).toBe(28); // base 38 → STAB 57 → ×0.5 = 28 → r=100
  });

  it('step 5 crit: ×3/2 floored; crit stage 2 for effect crit (1 in 2), else 1 in 16', () => {
    const i = inp(atk(), normalDef());
    expect(dmg(i, N70, 1, true)).toBe(54);
    expect(dmg(i, G70, 1, true)).toBe(81);
    // rng.int(16) === 0 → crit for a plain move
    expect(calcDamageFor(i, N70, scriptedRng([0, 15]), content).crit).toBe(true);
    expect(calcDamageFor(i, N70, scriptedRng([1, 15]), content).crit).toBe(false);
    expect(calcDamageFor(i, N70, scriptedRng([15, 15]), content).crit).toBe(false);
    // crit move: rng.int(2) === 0 → crit; the scripted value 1 (mod 2) misses
    expect(calcDamageFor(i, G70CRIT, scriptedRng([0, 15]), content).crit).toBe(true);
    expect(calcDamageFor(i, G70CRIT, scriptedRng([1, 15]), content).crit).toBe(false);
    // statistically: crit move ≈ 50 %, plain ≈ 6.25 %
    let critMove = 0;
    let plain = 0;
    const rng = createRng('crit');
    for (let k = 0; k < 4000; k++) {
      if (calcDamageFor(i, G70CRIT, rng, content).crit) critMove++;
      if (calcDamageFor(i, N70, rng, content).crit) plain++;
    }
    expect(critMove / 4000).toBeGreaterThan(0.46);
    expect(critMove / 4000).toBeLessThan(0.54);
    expect(plain / 4000).toBeGreaterThan(0.04);
    expect(plain / 4000).toBeLessThan(0.09);
  });

  it('step 6 random: r = 85 + rng.int(16), dmg = floor(dmg * r / 100)', () => {
    const i = inp(atk(), normalDef());
    expect(dmg(i, N70, 1, false, 85)).toBe(30); // floor(36 * 0.85) = 30.6 → 30
    expect(dmg(i, N70, 1, false, 100)).toBe(36);
    for (let v = 0; v < 16; v++) {
      const r = calcDamageFor(i, N70, scriptedRng([1, v]), content);
      expect(r.amount).toBe(Math.floor((36 * (85 + v)) / 100));
    }
  });

  it('step 7 burn: attacker burned → ×1/2 unless the ability has a statused attack boost (Guts)', () => {
    const burned = battler({ species: 'bramblecub', level: 50, status: ['burn'] });
    expect(dmg(inp(burned, normalDef()), N70)).toBe(18);
    const guts = battler({ species: 'bramblecub', level: 50, status: ['burn'], ability: 'Guts' });
    // Guts: A = floor(122 * 1.5) = 183; 22 * 70 * 183 = 281820; /110 = 2562 → /50 = 51 → 53; no halving
    expect(dmg(inp(guts, normalDef()), N70)).toBe(53);
    const gutsHealthy = battler({ species: 'bramblecub', level: 50, ability: 'Guts' });
    expect(dmg(inp(gutsHealthy, normalDef()), N70)).toBe(36); // Guts only when statused
    const poisonedGuts = battler({ species: 'bramblecub', level: 50, status: ['poison'], ability: 'Guts' });
    expect(dmg(inp(poisonedGuts, normalDef()), N70)).toBe(53); // any major status
  });

  it('step 8 weather: sun Fire ×3/2, sun Water ×1/2, rain Water ×3/2, rain Fire ×1/2; sand/hail untouched', () => {
    const a = atk();
    const d = normalDef();
    const fire = dmg(inp(a, d), F70);
    const water = dmg(inp(a, d), W70);
    expect(fire).toBe(36);
    expect(dmg(inp(a, d, 'sun'), F70)).toBe(54);
    expect(dmg(inp(a, d, 'sun'), W70)).toBe(18);
    expect(dmg(inp(a, d, 'rain'), W70)).toBe(54);
    expect(dmg(inp(a, d, 'rain'), F70)).toBe(18);
    expect(dmg(inp(a, d, 'sand'), F70)).toBe(fire);
    expect(dmg(inp(a, d, 'hail'), W70)).toBe(water);
    expect(dmg(inp(a, d, 'sun'), G70)).toBe(54); // other types unaffected
  });

  it('step 9 abilities: Thick Fat halves Fire/Ice on the defender; Flash Fire ×3/2 on the attacker only when flagged', () => {
    const thick = battler({ species: 'mufflo', level: 50, ability: 'Thick Fat' });
    expect(dmg(inp(atk(), thick), F70)).toBe(18);
    expect(dmg(inp(atk(), thick), I70)).toBe(18);
    expect(dmg(inp(atk(), thick), N70)).toBe(36);
    const ff = battler({ species: 'bramblecub', level: 50, ability: 'Flash Fire' });
    expect(dmg(inp(ff, normalDef()), F70)).toBe(36);
    const flagged: Battler = { ...ff, volatile: { ...ff.volatile, flashFired: true } };
    expect(dmg(inp(flagged, normalDef()), F70)).toBe(54);
    expect(dmg(inp(flagged, normalDef()), N70)).toBe(36); // only Fire moves
  });

  it('step 10 held items: attacker typeBoost ×6/5 on matching type only', () => {
    const charcoal = battler({ species: 'bramblecub', level: 50, heldItem: 'Charcoal' });
    expect(dmg(inp(charcoal, normalDef()), F70)).toBe(43); // floor(36 * 6 / 5) = 43.2
    expect(dmg(inp(charcoal, normalDef()), N70)).toBe(36);
    const mystic = battler({ species: 'bramblecub', level: 50, heldItem: 'Mystic Water' });
    expect(dmg(inp(mystic, normalDef()), W70)).toBe(43);
  });

  it('step 11 Solid Rock: ×3/4 only when effectiveness ≥ 2, applied after items', () => {
    const rock = battler({ species: 'mufflo', level: 50, ability: 'Solid Rock' });
    const i = inp(atk(), rock);
    expect(dmg(i, N70, 2)).toBe(54); // 72 * 3/4
    expect(dmg(i, N70, 4)).toBe(108);
    expect(dmg(i, N70, 1)).toBe(36);
    expect(dmg(i, N70, 0.5)).toBe(18);
    // item then Solid Rock: Charcoal Fire super-effective on a Grass Solid Rock defender
    const grassRock = battler({ species: 'bramblecub', level: 50, ability: 'Solid Rock' });
    const charcoal = battler({ species: 'cindercap', level: 50, heldItem: 'Charcoal' }); // A = 74 + 60 = 134, D(bramblecub) = 118
    // base = floor(floor(22*70*134/118)/50)+2 = floor(206360/118)=1748 → 34 → 36; STAB Fire ×3/2 = 54; ×2 = 108; r 100; Charcoal → 129; Solid Rock → 96
    expect(dmg(inp(charcoal, grassRock), F70, 2)).toBe(96);
  });

  it('step 12 min 1 only when step 0 passed', () => {
    const weak = battler({ species: 'mufflo', level: 1 });
    const tank = battler({ species: 'lithokrysm', level: 100 });
    expect(dmg(inp(weak, tank), N70, 0.25, false, 85)).toBe(1);
    const r = calcDamageFor(inp(weak, tank), N70, scriptedRng([1, 0]), content);
    expect(r.amount).toBe(1);
  });

  it('step 0: type-chart immunity → amount 0, effectiveness 0, no rng draw (never 1)', () => {
    const ghost = battler({ species: 'nettlewisp', level: 50 }); // Ghost/Grass
    const rng = countingRng(createRng(1));
    const r = calcDamageFor(inp(atk(), ghost), N70, rng, content);
    expect(r).toEqual({ amount: 0, effectiveness: 0, crit: false, stab: false, absorbed: null });
    expect(rng.count()).toBe(0);
    expect(damageStop(inp(atk(), ghost), N70, content).stop).toBe('typeChart');
    const flying = battler({ species: 'gustuff', level: 50 }); // Fairy/Flying
    expect(calcDamageFor(inp(atk(), flying), GROUND70, rng, content).amount).toBe(0);
    const ground = battler({ species: 'fennorange', level: 50 });
    expect(calcDamageFor(inp(atk(), ground), E70, rng, content).amount).toBe(0);
    expect(rng.count()).toBe(0);
  });

  it('step 0: ability typeImmunity → amount 0 with `absorbed` = the reaction kind, no draw', () => {
    const rng = countingRng(createRng(1));
    const levitate = battler({ species: 'mufflo', level: 50, ability: 'Levitate' });
    expect(calcDamageFor(inp(atk(), levitate), GROUND70, rng, content)).toMatchObject({ amount: 0, absorbed: null, effectiveness: 1 });
    const absorb = battler({ species: 'mufflo', level: 50, ability: 'Water Absorb' });
    expect(calcDamageFor(inp(atk(), absorb), W70, rng, content)).toMatchObject({ amount: 0, absorbed: 'heal' });
    const volt = battler({ species: 'mufflo', level: 50, ability: 'Volt Absorb' });
    expect(calcDamageFor(inp(atk(), volt), E70, rng, content)).toMatchObject({ amount: 0, absorbed: 'heal' });
    const ff = battler({ species: 'mufflo', level: 50, ability: 'Flash Fire' });
    expect(calcDamageFor(inp(atk(), ff), F70, rng, content)).toMatchObject({ amount: 0, absorbed: 'flag' });
    const rod = battler({ species: 'mufflo', level: 50, ability: 'Lightning Rod' });
    expect(calcDamageFor(inp(atk(), rod), E70, rng, content)).toMatchObject({ amount: 0, absorbed: 'raiseStat' });
    const voidS = battler({ species: 'mufflo', level: 50, ability: 'Void Sovereign' });
    const FAIRY70 = customMove('Vine Lash', 'T:Fairy70', { type: 'Fairy', effect: null });
    expect(calcDamageFor(inp(atk(), voidS), FAIRY70, rng, content)).toMatchObject({ amount: 0, absorbed: null });
    expect(rng.count()).toBe(0);
    // the immunity only covers its own type
    expect(calcDamageFor(inp(atk(), levitate), N70, createRng(1), content).amount).toBeGreaterThan(0);
  });

  it('step 0: Wonder Guard blocks effectiveness < 2 for damaging moves, lets ×2 through, ignores status moves', () => {
    const wg = battler({ species: 'mufflo', level: 50, ability: 'Wonder Guard' });
    const rng = countingRng(createRng(1));
    expect(damageStop(inp(atk(), wg), N70, content).stop).toBe('wonderGuard');
    expect(calcDamageFor(inp(atk(), wg), N70, rng, content).amount).toBe(0);
    expect(rng.count()).toBe(0);
    const FIGHT70 = customMove('Vine Lash', 'T:Fighting70', { type: 'Fighting', effect: null });
    const through = calcDamageFor(inp(atk(), wg), FIGHT70, rng, content);
    expect(through.effectiveness).toBe(2);
    expect(through.amount).toBeGreaterThan(0);
    expect(rng.count()).toBe(2);
    expect(damageStop(inp(atk(), wg), content.move('Growl'), content).stop).toBe('statusMove');
  });

  it('step 0: a power-0 move → amount 0 and no draw', () => {
    const rng = countingRng(createRng(1));
    const r = calcDamageFor(inp(atk(), normalDef()), content.move('Growl'), rng, content);
    expect(r.amount).toBe(0);
    expect(r.effectiveness).toBe(1);
    expect(rng.count()).toBe(0);
  });

  it('consumes exactly 2 rng draws when step 0 passes and exactly 0 otherwise', () => {
    const passing = countingRng(createRng(5));
    calcDamageFor(inp(atk(), normalDef()), N70, passing, content);
    expect(passing.count()).toBe(2);
    calcDamageFor(inp(atk(), normalDef()), G70CRIT, passing, content);
    expect(passing.count()).toBe(4);
  });

  it('step 1 stages: atk/def stages scale A and D by the §2.7 ratios', () => {
    const a = atk();
    const d = normalDef();
    const up: Battler = { ...a, stages: { ...a.stages, atk: 1 } }; // A = 183
    expect(dmg(inp(up, d), N70)).toBe(53); // 22*70*183/110 = 2562 → 51 + 2
    const max: Battler = { ...a, stages: { ...a.stages, atk: 6 } }; // A = 488
    expect(dmg(inp(max, d), N70)).toBe(Math.floor(Math.floor((22 * 70 * 488) / 110) / 50) + 2);
    const down: Battler = { ...a, stages: { ...a.stages, atk: -1 } }; // A = floor(122*2/3) = 81
    expect(dmg(inp(down, d), N70)).toBe(Math.floor(Math.floor((22 * 70 * 81) / 110) / 50) + 2);
    const dUp: Battler = { ...d, stages: { ...d.stages, def: 2 } }; // D = 220
    expect(dmg(inp(a, dUp), N70)).toBe(Math.floor(Math.floor((22 * 70 * 122) / 220) / 50) + 2);
    const dDown: Battler = { ...d, stages: { ...d.stages, def: -6 } }; // D = floor(110*2/8) = 27
    expect(dmg(inp(a, dDown), N70)).toBe(Math.floor(Math.floor((22 * 70 * 122) / 27) / 50) + 2);
    // Battler.atk/def themselves are unstaged
    expect(up.atk).toBe(122);
  });

  it('step 1 items and abilities on A/D: Choice Band/Specs ×1.25, Hustle ×1.5, Assault Vest ×1.25, Eviolite ×1.5 only if the defender can evolve', () => {
    const d = normalDef();
    const band = battler({ species: 'bramblecub', level: 50, heldItem: 'Choice Band' }); // A = floor(122*5/4) = 152
    expect(dmg(inp(band, d), N70)).toBe(Math.floor(Math.floor((22 * 70 * 152) / 110) / 50) + 2);
    const specs = battler({ species: 'bramblecub', level: 50, heldItem: 'Choice Specs' });
    expect(dmg(inp(specs, d), N70)).toBe(dmg(inp(band, d), N70));
    const hustle = battler({ species: 'bramblecub', level: 50, ability: 'Hustle' }); // A = 183
    expect(dmg(inp(hustle, d), N70)).toBe(53);
    const vest = battler({ species: 'mufflo', level: 50, heldItem: 'Assault Vest' }); // D = floor(110*5/4) = 137
    expect(dmg(inp(atk(), vest), N70)).toBe(Math.floor(Math.floor((22 * 70 * 122) / 137) / 50) + 2);
    const evio = battler({ species: 'mufflo', level: 50, heldItem: 'Eviolite' }); // mufflo → wooltug: D = 165
    expect(dmg(inp(atk(), evio), N70)).toBe(Math.floor(Math.floor((22 * 70 * 122) / 165) / 50) + 2);
    const finalEvio = battler({ species: 'rambull', level: 50, heldItem: 'Eviolite' });
    const finalPlain = battler({ species: 'rambull', level: 50 });
    expect(content.species('rambull').evolution).toBeNull();
    expect(dmg(inp(atk(), finalEvio), N70)).toBe(dmg(inp(atk(), finalPlain), N70));
    // Choice Scarf / Speed Scarf never touch A
    const scarf = battler({ species: 'bramblecub', level: 50, heldItem: 'Choice Scarf' });
    expect(dmg(inp(scarf, d), N70)).toBe(36);
  });

  it('Intimidate contributes nothing inside calcDamage (applied once on switch-in, never per calc)', () => {
    const plain = dmg(inp(atk(), normalDef()), N70);
    const intimAtk = battler({ species: 'bramblecub', level: 50, ability: 'Intimidate' });
    const intimDef = battler({ species: 'mufflo', level: 50, ability: 'Intimidate' });
    const plainDef = battler({ species: 'mufflo', level: 50, ability: 'Natural Cure' });
    expect(dmg(inp(atk(), plainDef), N70)).toBe(plain);
    expect(dmg(inp(intimAtk, normalDef()), N70)).toBe(plain);
    expect(dmg(inp(atk(), intimDef), N70)).toBe(plain);
  });

  it('the full pipeline in spec order: burn before weather before abilities before items before Solid Rock', () => {
    // burned Fire attacker with Charcoal, in sun, vs Grass Solid Rock defender, Fire 70, x2
    const a: Battler = { ...battler({ species: 'cindercap', level: 50, status: ['burn'], heldItem: 'Charcoal' }) };
    const d = battler({ species: 'bramblecub', level: 50, ability: 'Solid Rock' });
    // base 36 (see step 11), STAB 54, x2 = 108, r 100 → 108, burn → 54, sun Fire → 81, Charcoal → 97, Solid Rock → 72
    expect(dmg(inp(a, d, 'sun'), F70, 2)).toBe(72);
  });

  it('calcDamage(state, side, move, rng, content) resolves the two actives', () => {
    const { state } = startBattle({ a: { species: 'bramblecub', level: 50 }, b: { species: 'mufflo', level: 50, ability: 'Natural Cure' } });
    const r = calcDamage(state, 0, N70, scriptedRng([1, 15]), content);
    expect(r.amount).toBe(36);
    const back = calcDamage(state, 1, N70, scriptedRng([1, 15]), content);
    // mufflo (atk 40 → 100, STAB Normal) vs bramblecub (def 58 → 118): 22*70*100/118 = 1305 → 26 + 2 = 28 → STAB 42
    expect(back.amount).toBe(42);
    expect(back.stab).toBe(true);
  });
});
