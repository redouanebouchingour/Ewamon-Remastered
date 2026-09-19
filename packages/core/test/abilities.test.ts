/** §2.5 — all 25 ability rows, each through the hook that implements it. */
import { describe, expect, it } from 'vitest';
import type { CreatureSpec } from './helpers';
import { accuracyThreshold } from '../src/accuracy';
import { stageLowerImmune } from '../src/abilities';
import { calcDamageFor } from '../src/damage';
import { effectiveSpeed } from '../src/speed';
import { ABILITY_HOOKS } from './fixtures/legacyContent';
import { activeOf, battler, content, customMove, eventsOf, findSeed, move, scriptedRng, startBattle, sw, turn } from './helpers';

const NOOP = customMove('Growl', 'A:noop', { effect: null, accuracy: null });
const TACKLE = customMove('Tackle', 'A:tackle', { accuracy: null }); // Normal 40, contact
const GRASS = customMove('Vine Lash', 'A:grass', { accuracy: null }); // non-contact
const WATER = customMove('Vine Lash', 'A:water', { type: 'Water', accuracy: null });
const ELECTRIC = customMove('Vine Lash', 'A:electric', { type: 'Electric', accuracy: null });
const FIRE = customMove('Vine Lash', 'A:fire', { type: 'Fire', accuracy: null });
const GROUND = customMove('Vine Lash', 'A:ground', { type: 'Ground', accuracy: null });
const FAIRY = customMove('Vine Lash', 'A:fairy', { type: 'Fairy', accuracy: null });
const FIGHTING = customMove('Vine Lash', 'A:fighting', { type: 'Fighting', accuracy: null });
const GROWL = customMove('Growl', 'A:growl', { accuracy: null });
const POISON_FOG = customMove('Poison Fog', 'A:poison', { accuracy: null });
const BURN = customMove('Will-O-Wisp', 'A:burn', { accuracy: null });
const SAND = customMove('Sandstorm', 'A:sand', { accuracy: null });

const A = (ability: string, extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability, ...extra });
const D = (ability: string, extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability, ...extra });

describe('§2.5 the 25 rows exist as hooks', () => {
  it('content ships exactly the 25 legacy abilities and every hook kind is one core implements', () => {
    expect(content.abilityIds.length).toBe(25);
    expect(Object.keys(ABILITY_HOOKS).sort()).toEqual([...content.abilityIds].sort());
    const kinds = new Set(content.abilityIds.flatMap((id) => content.ability(id).hooks.map((h) => h.kind)));
    expect([...kinds].sort()).toEqual([
      'endOfTurn', 'modifyAccuracy', 'modifyAttack', 'modifyDamage', 'modifySpeed', 'onContact', 'onStatLowered',
      'onSwitchIn', 'onSwitchOut', 'stageLowerImmunity', 'statusImmunity', 'typeImmunity', 'wonderGuard',
    ]);
  });
});

describe('§2.5 abilities', () => {
  it('Chlorophyll: speed ×2 in sun only', () => {
    const b = battler(A('Chlorophyll'));
    expect(effectiveSpeed(b, 'sun', content)).toBe(b.spd * 2);
    for (const w of ['none', 'rain', 'sand', 'hail'] as const) expect(effectiveSpeed(b, w, content)).toBe(b.spd);
  });

  it('Swift Swim: speed ×2 in rain only', () => {
    const b = battler(A('Swift Swim'));
    expect(effectiveSpeed(b, 'rain', content)).toBe(b.spd * 2);
    expect(effectiveSpeed(b, 'sun', content)).toBe(b.spd);
  });

  it('Thick Fat: Fire and Ice damage halved on the defender', () => {
    const thick = battler(D('Thick Fat'));
    const plain = battler(D('Natural Cure'));
    const att = battler(A('Chlorophyll'));
    const rng = () => scriptedRng([1, 15]);
    expect(calcDamageFor({ attacker: att, defender: thick, weather: 'none' }, FIRE, rng(), content).amount).toBe(
      Math.floor(calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, FIRE, rng(), content).amount / 2),
    );
    expect(calcDamageFor({ attacker: att, defender: thick, weather: 'none' }, GRASS, rng(), content).amount).toBe(
      calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, GRASS, rng(), content).amount,
    );
  });

  it('Lightning Rod: immune to Electric, raises Atk +1', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Lightning Rod') }).state, move(ELECTRIC.id), move(NOOP.id));
    expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ move: ELECTRIC.id, reason: 'immune' });
    expect(eventsOf(r.events, 'damage').length).toBe(0);
    expect(eventsOf(r.events, 'statStage')[0]).toMatchObject({ target: { side: 1, slot: 0 }, stat: 'atk', delta: 1, cause: 'ability' });
    expect(eventsOf(r.events, 'abilityTrigger')[0]).toMatchObject({ who: { side: 1, slot: 0 }, ability: 'Lightning Rod' });
    expect(activeOf(r.state, 1).stages.atk).toBe(1);
  });

  it('Competitive: +2 Atk once per foe-caused lowering; a self-caused lowering does not trigger', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Competitive') }).state, move(GROWL.id), move(NOOP.id));
    const st = eventsOf(r.events, 'statStage');
    expect(st.map((e) => [e.stat, e.delta, e.cause])).toEqual([['atk', -1, 'move'], ['atk', 2, 'ability']]);
    expect(activeOf(r.state, 1).stages.atk).toBe(1);
    // Intimidate on the foe lead is foe-caused too
    const start = startBattle({ a: A('Intimidate'), b: D('Competitive') });
    expect(activeOf(start.state, 1).stages.atk).toBe(1);
    expect(eventsOf(start.events, 'statStage').map((e) => e.delta)).toEqual([-1, 2]);
  });

  it('Flame Body: 30 % burn on contact; never on non-contact moves', () => {
    const burned = findSeed((seed) => {
      const t = turn(startBattle({ a: A('Chlorophyll'), b: D('Flame Body'), seed }).state, move(TACKLE.id), move(NOOP.id));
      return eventsOf(t.events, 'statusApplied').some((e) => e.status === 'burn' && e.target.side === 0) ? t : null;
    });
    expect(eventsOf(burned.events, 'statusApplied')[0]).toMatchObject({ target: { side: 0, slot: 0 }, status: 'burn', source: { side: 1, slot: 0 } });
    expect(eventsOf(burned.events, 'abilityTrigger').some((e) => e.ability === 'Flame Body' && e.detail === 'onContact')).toBe(true);
    let count = 0;
    for (let seed = 0; seed < 200; seed++) {
      const t = turn(startBattle({ a: A('Chlorophyll'), b: D('Flame Body'), seed }).state, move(GRASS.id), move(NOOP.id));
      if (eventsOf(t.events, 'statusApplied').length > 0) count++;
    }
    expect(count).toBe(0);
    expect(content.move('Vine Lash').contact).toBe(false);
    expect(content.move('Tackle').contact).toBe(true);
  });

  it('Poison Spores: 30 % poison on contact', () => {
    const t = findSeed((seed) => {
      const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Poison Spores'), seed }).state, move(TACKLE.id), move(NOOP.id));
      return eventsOf(r.events, 'statusApplied').some((e) => e.status === 'poison' && e.target.side === 0) ? r : null;
    });
    expect(activeOf(t.state, 0).creature.status).toEqual(['poison']);
  });

  it('Rough Skin: contact attacker loses floor(maxHp / 8) as damage { cause: contact }', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Rough Skin') }).state, move(TACKLE.id), move(NOOP.id));
    const contact = eventsOf(r.events, 'damage').find((e) => e.cause === 'contact')!;
    const a = activeOf(r.state, 0);
    expect(contact).toMatchObject({ target: { side: 0, slot: 0 }, source: { side: 1, slot: 0 }, amount: Math.floor(a.maxHp / 8), move: null });
    const none = turn(startBattle({ a: A('Chlorophyll'), b: D('Rough Skin') }).state, move(GRASS.id), move(NOOP.id));
    expect(eventsOf(none.events, 'damage').some((e) => e.cause === 'contact')).toBe(false);
  });

  it('Water Absorb: immune to Water, heals floor(maxHp / 4) as heal { cause: absorb }', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Water Absorb', { hp: 20 }) }).state, move(WATER.id), move(NOOP.id));
    const d = activeOf(r.state, 1);
    expect(eventsOf(r.events, 'heal')[0]).toEqual({ t: 'heal', target: { side: 1, slot: 0 }, amount: Math.floor(d.maxHp / 4), hpAfter: 20 + Math.floor(d.maxHp / 4), cause: 'absorb', item: null });
    expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ reason: 'immune' });
    expect(eventsOf(r.events, 'damage').length).toBe(0);
  });

  it('Volt Absorb: immune to Electric, heals floor(maxHp / 4)', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Volt Absorb', { hp: 20 }) }).state, move(ELECTRIC.id), move(NOOP.id));
    expect(eventsOf(r.events, 'heal')[0]).toMatchObject({ cause: 'absorb', amount: Math.floor(activeOf(r.state, 1).maxHp / 4) });
  });

  it('Flash Fire: immune to Fire, sets flashFired; then its own Fire moves deal ×3/2', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Flash Fire') }).state, move(FIRE.id), move(NOOP.id));
    expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ reason: 'immune' });
    expect(activeOf(r.state, 1).volatile.flashFired).toBe(true);
    const flagged = activeOf(r.state, 1);
    const plain = { ...flagged, volatile: { ...flagged.volatile, flashFired: false } };
    const target = activeOf(r.state, 0);
    const boosted = calcDamageFor({ attacker: flagged, defender: target, weather: 'none' }, FIRE, scriptedRng([1, 15]), content).amount;
    const base = calcDamageFor({ attacker: plain, defender: target, weather: 'none' }, FIRE, scriptedRng([1, 15]), content).amount;
    expect(boosted).toBe(Math.floor((base * 3) / 2));
    // the flag clears on switch-out
    const two = startBattle({ a: A('Chlorophyll'), b: [D('Flash Fire'), D('Natural Cure')] }).state;
    const flaggedState = turn(two, move(FIRE.id), move(NOOP.id)).state;
    const swapped = turn(flaggedState, move(NOOP.id), sw(1)).state;
    expect(swapped.sides[1].party[0]!.volatile.flashFired).toBe(false);
  });

  it('Immunity: cannot be poisoned (statusBlocked { reason: ability })', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Immunity') }).state, move(POISON_FOG.id), move(NOOP.id));
    expect(eventsOf(r.events, 'statusBlocked')[0]).toEqual({ t: 'statusBlocked', target: { side: 1, slot: 0 }, status: 'poison', reason: 'ability' });
    expect(activeOf(r.state, 1).creature.status).toEqual([]);
    const burnOk = turn(startBattle({ a: A('Chlorophyll'), b: D('Immunity') }).state, move(BURN.id), move(NOOP.id));
    expect(activeOf(burnOk.state, 1).creature.status).toEqual(['burn']);
  });

  it('Speed Boost: +1 Spd at end of every turn', () => {
    const r = turn(startBattle({ a: A('Speed Boost'), b: D('Natural Cure') }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(r.events, 'statStage')[0]).toMatchObject({ target: { side: 0, slot: 0 }, stat: 'spd', delta: 1, cause: 'ability', source: { side: 0, slot: 0 } });
    expect(activeOf(r.state, 0).stages.spd).toBe(1);
    expect(activeOf(turn(r.state, move(NOOP.id), move(NOOP.id)).state, 0).stages.spd).toBe(2);
  });

  it('Intimidate: foe Atk −1 once on entry (createBattle lead and switch-in), never per calc', () => {
    const start = startBattle({ a: A('Intimidate'), b: D('Natural Cure') });
    expect(eventsOf(start.events, 'statStage')).toEqual([
      { t: 'statStage', target: { side: 1, slot: 0 }, stat: 'atk', delta: -1, after: -1, clamped: false, source: { side: 0, slot: 0 }, cause: 'ability' },
    ]);
    const after = turn(start.state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(after.events, 'statStage').length).toBe(0); // once
    expect(activeOf(after.state, 1).stages.atk).toBe(-1);
    // switch-in fires it again
    const bench = startBattle({ a: [A('Chlorophyll'), A('Intimidate')], b: D('Natural Cure') }).state;
    const swapped = turn(bench, sw(1), move(NOOP.id));
    expect(eventsOf(swapped.events, 'statStage')[0]).toMatchObject({ target: { side: 1, slot: 0 }, stat: 'atk', delta: -1, cause: 'ability' });
    // both leads: side 0 first
    const both = startBattle({ a: A('Intimidate'), b: D('Intimidate') });
    expect(eventsOf(both.events, 'statStage').map((e) => e.target.side)).toEqual([1, 0]);
  });

  it('Wonder Guard: only ×2+ moves deal damage; status moves unaffected', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Wonder Guard') }).state, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(r.events, 'moveFailed')[0]).toEqual({ t: 'moveFailed', who: { side: 0, slot: 0 }, move: TACKLE.id, reason: 'wonderGuard' });
    expect(eventsOf(r.events, 'damage').length).toBe(0);
    const se = turn(startBattle({ a: A('Chlorophyll'), b: D('Wonder Guard') }).state, move(FIGHTING.id), move(NOOP.id));
    expect(eventsOf(se.events, 'damage')[0]!.effectiveness).toBe(2);
    const status = turn(startBattle({ a: A('Chlorophyll'), b: D('Wonder Guard') }).state, move(GROWL.id), move(NOOP.id));
    expect(eventsOf(status.events, 'moveFailed').length).toBe(0);
    expect(activeOf(status.state, 1).stages.atk).toBe(-1);
  });

  it('Regenerator: heals floor(maxHp / 3) on switch-out (nothing at full HP)', () => {
    const st = startBattle({ a: [A('Regenerator', { hp: 10 }), A('Chlorophyll')], b: D('Natural Cure') }).state;
    const r = turn(st, sw(1), move(NOOP.id));
    const b0 = r.state.sides[0].party[0]!;
    expect(eventsOf(r.events, 'heal')[0]).toEqual({ t: 'heal', target: { side: 0, slot: 0 }, amount: Math.floor(b0.maxHp / 3), hpAfter: 10 + Math.floor(b0.maxHp / 3), cause: 'regenerator', item: null });
    const full = turn(startBattle({ a: [A('Regenerator'), A('Chlorophyll')], b: D('Natural Cure') }).state, sw(1), move(NOOP.id));
    expect(eventsOf(full.events, 'heal').length).toBe(0);
  });

  it('Keen Eye: accuracy cannot be lowered (hook live; no v1 move triggers it)', () => {
    const hooks = content.ability('Keen Eye').hooks;
    expect(stageLowerImmune(hooks, 'acc')).toBe(true);
    expect(stageLowerImmune(hooks, 'atk')).toBe(false);
    expect(stageLowerImmune(hooks, 'eva')).toBe(false);
    for (const id of content.moveIds) expect(content.move(id).effect).not.toBe('lower_acc');
  });

  it('Solid Rock: super-effective damage ×3/4', () => {
    const rock = battler(D('Solid Rock'));
    const plain = battler(D('Natural Cure'));
    const att = battler(A('Chlorophyll'));
    const rng = () => scriptedRng([1, 15]);
    const base = calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, FIGHTING, rng(), content).amount;
    expect(calcDamageFor({ attacker: att, defender: rock, weather: 'none' }, FIGHTING, rng(), content).amount).toBe(Math.floor((base * 3) / 4));
    expect(calcDamageFor({ attacker: att, defender: rock, weather: 'none' }, GRASS, rng(), content).amount).toBe(
      calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, GRASS, rng(), content).amount,
    );
  });

  it('Natural Cure: clears major statuses on switch-out (statusCured { cause: ability }); confusion is not its doing', () => {
    const st = startBattle({ a: [A('Natural Cure', { status: ['burn'] }), A('Chlorophyll')], b: D('Natural Cure') }).state;
    const r = turn(st, sw(1), move(NOOP.id));
    expect(eventsOf(r.events, 'statusCured')).toEqual([{ t: 'statusCured', target: { side: 0, slot: 0 }, status: 'burn', cause: 'ability' }]);
    expect(r.state.sides[0].party[0]!.creature.status).toEqual([]);
    const healthy = turn(startBattle({ a: [A('Natural Cure'), A('Chlorophyll')], b: D('Natural Cure') }).state, sw(1), move(NOOP.id));
    expect(eventsOf(healthy.events, 'statusCured').length).toBe(0);
    expect(eventsOf(healthy.events, 'abilityTrigger').length).toBe(0);
  });

  it('Sand Veil: foe accuracy ×0.8 in sand only', () => {
    const veil = battler(D('Sand Veil'));
    const att = battler(A('Chlorophyll'));
    expect(accuracyThreshold(att, veil, content.move('Tackle'), 'sand', content)).toBe(80);
    expect(accuracyThreshold(att, veil, content.move('Tackle'), 'none', content)).toBe(100);
    const inSand = turn(startBattle({ a: A('Chlorophyll'), b: D('Sand Veil') }).state, move(SAND.id), move(NOOP.id)).state;
    expect(inSand.field.weather.kind).toBe('sand');
  });

  it('Hustle: Atk ×1.5 and accuracy ×0.8 on damaging moves only', () => {
    const hustle = battler(A('Hustle'));
    const plain = battler(A('Chlorophyll'));
    const def = battler(D('Natural Cure'));
    const rng = () => scriptedRng([1, 15]);
    const a = calcDamageFor({ attacker: hustle, defender: def, weather: 'none' }, TACKLE, rng(), content).amount;
    const b = calcDamageFor({ attacker: plain, defender: def, weather: 'none' }, TACKLE, rng(), content).amount;
    expect(a).toBeGreaterThan(b);
    expect(accuracyThreshold(hustle, def, content.move('Tackle'), 'none', content)).toBe(80);
    expect(accuracyThreshold(hustle, def, content.move('Growl'), 'none', content)).toBe(100);
  });

  it('Guts: Atk ×1.5 while statused and the burn halving is cancelled', () => {
    const guts = battler(A('Guts', { status: ['burn'] }));
    const burned = battler(A('Chlorophyll', { status: ['burn'] }));
    const healthy = battler(A('Chlorophyll'));
    const def = battler(D('Natural Cure'));
    const rng = () => scriptedRng([1, 15]);
    const g = calcDamageFor({ attacker: guts, defender: def, weather: 'none' }, TACKLE, rng(), content).amount;
    const b = calcDamageFor({ attacker: burned, defender: def, weather: 'none' }, TACKLE, rng(), content).amount;
    const h = calcDamageFor({ attacker: healthy, defender: def, weather: 'none' }, TACKLE, rng(), content).amount;
    expect(b).toBe(Math.floor(h / 2));
    expect(g).toBeGreaterThan(h);
  });

  it('Iron Barbs: contact attacker loses floor(maxHp / 8)', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Iron Barbs') }).state, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(r.events, 'damage').find((e) => e.cause === 'contact')).toMatchObject({ target: { side: 0, slot: 0 }, amount: Math.floor(activeOf(r.state, 0).maxHp / 8) });
    expect(eventsOf(r.events, 'abilityTrigger').some((e) => e.ability === 'Iron Barbs')).toBe(true);
  });

  it('Levitate: immune to Ground with no reaction (absorbed null)', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Levitate') }).state, move(GROUND.id), move(NOOP.id));
    expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ move: GROUND.id, reason: 'immune' });
    expect(eventsOf(r.events, 'damage').length).toBe(0);
    expect(eventsOf(r.events, 'heal').length).toBe(0);
    expect(eventsOf(r.events, 'statStage').length).toBe(0);
    expect(eventsOf(r.events, 'abilityTrigger')[0]).toMatchObject({ ability: 'Levitate', detail: 'typeImmunity' });
  });

  it('Void Sovereign: immune to Fairy with no reaction', () => {
    const r = turn(startBattle({ a: A('Chlorophyll'), b: D('Void Sovereign') }).state, move(FAIRY.id), move(NOOP.id));
    expect(eventsOf(r.events, 'moveFailed')[0]).toMatchObject({ move: FAIRY.id, reason: 'immune' });
    expect(eventsOf(r.events, 'damage').length).toBe(0);
    const other = turn(startBattle({ a: A('Chlorophyll'), b: D('Void Sovereign') }).state, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(other.events, 'damage').length).toBe(1);
  });
});
