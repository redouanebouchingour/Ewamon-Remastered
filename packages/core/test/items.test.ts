/** §2.6 — held items (14 battle rows + 3 HMs), orbs and consumables. */
import { describe, expect, it } from 'vitest';
import { validateAction } from '../src/index';
import type { ConsumableDef, ItemDef } from '../src/index';
import { calcDamageFor } from '../src/damage';
import { heldHooks, isConsumableDef, isHeldItemDef } from '../src/items';
import { effectiveSpeed } from '../src/speed';
import type { CreatureSpec } from './helpers';
import { activeOf, battler, content, customMove, eventsOf, item, move, scriptedRng, startBattle, sw, turn } from './helpers';

const NOOP = customMove('Growl', 'I:noop', { effect: null, accuracy: null });
const TACKLE = customMove('Tackle', 'I:tackle', { accuracy: null });
const FIGHTING = customMove('Vine Lash', 'I:fighting', { type: 'Fighting', accuracy: null });
const GROWL = customMove('Growl', 'I:growl', { accuracy: null });
const BIG = customMove('Vine Lash', 'I:big', { type: 'Normal', power: 250, accuracy: null });

const A = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [TACKLE.id, GROWL.id, NOOP.id, FIGHTING.id], ...extra });
const D = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [TACKLE.id, GROWL.id, NOOP.id, BIG.id], ...extra });

describe('§2.6 item definitions', () => {
  it('17 held/key items and the §2.6 consumables are indexed; HMs are key items with a field verb and no hooks', () => {
    const held = content.itemIds.filter((id) => isHeldItemDef(content.item(id)));
    expect(held.length).toBe(17);
    for (const hm of ['HM Surf', 'HM Cut', 'HM Strength']) {
      const def = content.item(hm) as ItemDef;
      expect(def.slot).toBe('key');
      expect(def.hooks).toEqual([]);
      expect(def.fieldVerb).toBe(hm.slice(3).toLowerCase());
    }
    expect((content.item('Choice Band') as ItemDef).hooks).toEqual((content.item('Choice Specs') as ItemDef).hooks);
    const cons = content.itemIds.filter((id) => isConsumableDef(content.item(id)));
    expect(cons).toContain('potion');
    expect(cons).toContain('escape_rope');
    expect(cons).not.toContain('hyperpotion');
    expect(cons).not.toContain('fullheal');
    expect(() => content.item('ewamon_ball')).toThrow(RangeError);
    expect(() => content.orb('great_ball')).toThrow(RangeError);
    expect(content.orbIds.length).toBe(10);
  });
});

describe('§2.6 held items', () => {
  it('Choice Band: Atk ×1.25 and locked to the first move until switched out (choiceLocked from validateAction)', () => {
    const st = startBattle({ a: [A({ heldItem: 'Choice Band' }), A()], b: D() }).state;
    const r = turn(st, move(TACKLE.id), move(NOOP.id));
    expect(activeOf(r.state, 0).volatile.choiceLockedMove).toBe(TACKLE.id);
    expect(validateAction(r.state, 0, move(GROWL.id), content)).toBe('choiceLocked');
    expect(validateAction(r.state, 0, move(TACKLE.id), content)).toBeNull();
    expect(() => turn(r.state, move(GROWL.id), move(NOOP.id))).toThrow(/choiceLocked/);
    // persists across turns, cleared by switching out and back
    const r2 = turn(r.state, move(TACKLE.id), move(NOOP.id));
    expect(validateAction(r2.state, 0, move(GROWL.id), content)).toBe('choiceLocked');
    const out = turn(r2.state, sw(1), move(NOOP.id)).state;
    const back = turn(out, sw(0), move(NOOP.id)).state;
    expect(activeOf(back, 0).volatile.choiceLockedMove).toBeNull();
    expect(validateAction(back, 0, move(GROWL.id), content)).toBeNull();
    // ×1.25 Atk
    const band = battler(A({ heldItem: 'Choice Band' }));
    const plain = battler(A());
    const def = battler(D());
    const withBand = calcDamageFor({ attacker: band, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content).amount;
    const without = calcDamageFor({ attacker: plain, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content).amount;
    expect(withBand).toBeGreaterThan(without);
  });

  it('Choice Scarf: Spd ×1.25 (floored) and choice lock', () => {
    const b = battler(A({ heldItem: 'Choice Scarf' }));
    expect(effectiveSpeed(b, 'none', content)).toBe(Math.floor((b.spd * 5) / 4));
    const r = turn(startBattle({ a: A({ heldItem: 'Choice Scarf' }), b: D() }).state, move(TACKLE.id), move(NOOP.id));
    expect(validateAction(r.state, 0, move(GROWL.id), content)).toBe('choiceLocked');
  });

  it('Choice Specs: identical to Choice Band by construction', () => {
    const specs = battler(A({ heldItem: 'Choice Specs' }));
    const band = battler(A({ heldItem: 'Choice Band' }));
    const def = battler(D());
    expect(calcDamageFor({ attacker: specs, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content)).toEqual(
      calcDamageFor({ attacker: band, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content),
    );
  });

  it('Assault Vest: Def ×1.25 and power-0 moves rejected (statusMoveBlocked)', () => {
    const st = startBattle({ a: A({ heldItem: 'Assault Vest' }), b: D() }).state;
    expect(validateAction(st, 0, move(GROWL.id), content)).toBe('statusMoveBlocked');
    expect(validateAction(st, 0, move(TACKLE.id), content)).toBeNull();
    expect(() => turn(st, move(GROWL.id), move(NOOP.id))).toThrow(/statusMoveBlocked/);
    const vest = battler(D({ heldItem: 'Assault Vest' }));
    const plain = battler(D());
    const att = battler(A());
    expect(calcDamageFor({ attacker: att, defender: vest, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount).toBeLessThan(
      calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount,
    );
  });

  it('Eviolite: Def ×1.5 only when the species can still evolve', () => {
    const att = battler(A());
    const evio = battler(D({ heldItem: 'Eviolite' })); // mufflo evolves
    const plain = battler(D());
    expect(calcDamageFor({ attacker: att, defender: evio, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount).toBeLessThan(
      calcDamageFor({ attacker: att, defender: plain, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount,
    );
    const finalEvio = battler({ species: 'rambull', level: 50, ability: 'Rough Skin', heldItem: 'Eviolite' });
    const finalPlain = battler({ species: 'rambull', level: 50, ability: 'Rough Skin' });
    expect(calcDamageFor({ attacker: att, defender: finalEvio, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount).toBe(
      calcDamageFor({ attacker: att, defender: finalPlain, weather: 'none' }, BIG, scriptedRng([1, 15]), content).amount,
    );
  });

  it('Heavy Duty Boots: a documented no-op — identical events with or without it', () => {
    const withBoots = turn(startBattle({ a: A({ heldItem: 'Heavy Duty Boots' }), b: D(), seed: 4 }).state, move(TACKLE.id), move(TACKLE.id));
    const without = turn(startBattle({ a: A(), b: D(), seed: 4 }).state, move(TACKLE.id), move(TACKLE.id));
    expect(withBoots.events).toEqual(without.events);
  });

  it('Sitrus Berry: below 50 % at end of turn → heal floor(maxHp / 4), consumed once', () => {
    const b = battler(A());
    const low = Math.floor(b.maxHp / 2) - 1;
    const r = turn(startBattle({ a: A({ heldItem: 'Sitrus Berry', hp: low }), b: D() }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(r.events, 'heldItemTrigger')).toEqual([{ t: 'heldItemTrigger', who: { side: 0, slot: 0 }, item: 'Sitrus Berry', consumed: true }]);
    expect(eventsOf(r.events, 'heal')[0]).toEqual({ t: 'heal', target: { side: 0, slot: 0 }, amount: Math.floor(b.maxHp / 4), hpAfter: low + Math.floor(b.maxHp / 4), cause: 'berry', item: 'Sitrus Berry' });
    expect(activeOf(r.state, 0).creature.heldItem).toBeNull();
    expect(activeOf(r.state, 0).volatile.berryConsumed).toBe(true);
    // exactly at 50 % → not yet
    const at = turn(startBattle({ a: A({ heldItem: 'Sitrus Berry', hp: Math.floor(b.maxHp / 2) }), b: D() }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(at.events, 'heldItemTrigger').length).toBe(0);
    expect(activeOf(at.state, 0).creature.heldItem).toBe('Sitrus Berry');
  });

  it('Oran Berry: below 25 % → +10 HP flat, consumed', () => {
    const b = battler(A());
    const low = Math.floor(b.maxHp / 4) - 1;
    const r = turn(startBattle({ a: A({ heldItem: 'Oran Berry', hp: low }), b: D() }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(r.events, 'heal')[0]).toMatchObject({ amount: 10, cause: 'berry', item: 'Oran Berry' });
    expect(activeOf(r.state, 0).creature.heldItem).toBeNull();
    const notYet = turn(startBattle({ a: A({ heldItem: 'Oran Berry', hp: Math.floor(b.maxHp / 2) }), b: D() }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(notYet.events, 'heal').length).toBe(0);
  });

  it('type boosts: Charcoal Fire, Mystic Water Water, Mirrorcoat Psychic, Black Sludge Poison — ×6/5 on the matching type only', () => {
    const def = battler(D());
    const rows: [string, string][] = [['Charcoal', 'Fire'], ['Mystic Water', 'Water'], ['Mirrorcoat', 'Psychic'], ['Black Sludge', 'Poison']];
    for (const [itemId, type] of rows) {
      const mv = customMove('Vine Lash', `I:boost:${type}`, { type: type as 'Fire', accuracy: null });
      const holder = battler(A({ heldItem: itemId }));
      const plain = battler(A());
      const boosted = calcDamageFor({ attacker: holder, defender: def, weather: 'none' }, mv, scriptedRng([1, 15]), content).amount;
      const base = calcDamageFor({ attacker: plain, defender: def, weather: 'none' }, mv, scriptedRng([1, 15]), content).amount;
      expect(boosted).toBe(Math.floor((base * 6) / 5));
      const other = calcDamageFor({ attacker: holder, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content).amount;
      expect(other).toBe(calcDamageFor({ attacker: plain, defender: def, weather: 'none' }, TACKLE, scriptedRng([1, 15]), content).amount);
    }
  });

  it('Weakness Policy: +2 Atk when hit super-effectively, consumed; nothing on a neutral hit', () => {
    const r = turn(startBattle({ a: A(), b: D({ heldItem: 'Weakness Policy' }) }).state, move(FIGHTING.id), move(NOOP.id));
    expect(eventsOf(r.events, 'heldItemTrigger')).toEqual([{ t: 'heldItemTrigger', who: { side: 1, slot: 0 }, item: 'Weakness Policy', consumed: true }]);
    expect(eventsOf(r.events, 'statStage')[0]).toMatchObject({ target: { side: 1, slot: 0 }, stat: 'atk', delta: 2, cause: 'item' });
    expect(activeOf(r.state, 1).creature.heldItem).toBeNull();
    expect(activeOf(r.state, 1).volatile.weaknessPolicyUsed).toBe(true);
    const neutral = turn(startBattle({ a: A(), b: D({ heldItem: 'Weakness Policy' }) }).state, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(neutral.events, 'heldItemTrigger').length).toBe(0);
    expect(activeOf(neutral.state, 1).creature.heldItem).toBe('Weakness Policy');
  });

  it('Speed Scarf: Spd ×1.1 floored, no lock', () => {
    const b = battler(A({ heldItem: 'Speed Scarf' }));
    expect(effectiveSpeed(b, 'none', content)).toBe(Math.floor((b.spd * 11) / 10));
    const r = turn(startBattle({ a: A({ heldItem: 'Speed Scarf' }), b: D() }).state, move(TACKLE.id), move(NOOP.id));
    expect(validateAction(r.state, 0, move(GROWL.id), content)).toBeNull();
  });

  it('HM items in the held slot contribute no hooks and cannot be used as battle items', () => {
    const b = battler(A({ heldItem: 'HM Surf' }));
    expect(heldHooks(b, content)).toEqual([]);
    const st = startBattle({ a: A(), b: D() }).state;
    expect(validateAction(st, 0, item('HM Surf'), content)).toBe('itemNotUsableInBattle');
    expect(validateAction(st, 0, item('Choice Band'), content)).toBe('itemNotUsableInBattle');
  });
});

describe('§2.6 consumables in battle', () => {
  it('potion heals 20 (cause item), is recorded in consumedItems, and resolves before moves', () => {
    const st = startBattle({ a: A({ hp: 10 }), b: D() }).state;
    const r = turn(st, item('potion'), move(TACKLE.id));
    expect(eventsOf(r.events, 'itemUsed')).toEqual([{ t: 'itemUsed', who: { side: 0, slot: 0 }, item: 'potion', target: { side: 0, slot: 0 }, consumedHeld: false }]);
    expect(eventsOf(r.events, 'heal')[0]).toEqual({ t: 'heal', target: { side: 0, slot: 0 }, amount: 20, hpAfter: 30, cause: 'item', item: 'potion' });
    expect(r.state.sides[0].consumedItems).toEqual(['potion']);
    const types = r.events.map((e) => e.t);
    expect(types.indexOf('itemUsed')).toBeLessThan(types.indexOf('moveUsed'));
  });

  it('max_potion / full_restore / hyper_potion heal to full or by 100; full_restore also cures', () => {
    const st = startBattle({ a: A({ hp: 1, status: ['burn'] }), b: D() }).state;
    const full = turn(st, item('full_restore'), move(NOOP.id));
    const a = activeOf(full.state, 0);
    expect(a.creature.hp).toBe(a.maxHp);
    expect(a.creature.status).toEqual([]);
    expect(eventsOf(full.events, 'statusCured')[0]).toMatchObject({ status: 'burn', cause: 'item' });
    const maxp = turn(st, item('max_potion'), move(NOOP.id));
    expect(activeOf(maxp.state, 0).creature.hp).toBe(a.maxHp);
    expect(activeOf(maxp.state, 0).creature.status).toEqual(['burn']);
    const hyper = turn(st, item('hyper_potion'), move(NOOP.id));
    expect(activeOf(hyper.state, 0).creature.hp).toBe(Math.min(a.maxHp, 101));
  });

  it('status cures: antidote / burn_heal / ice_heal / awakening / paralyze_heal cure one; full_heal cures all incl. confusion', () => {
    const rows: [string, 'poison' | 'burn' | 'freeze' | 'sleep' | 'paralyze'][] = [
      ['antidote', 'poison'], ['burn_heal', 'burn'], ['ice_heal', 'freeze'], ['awakening', 'sleep'], ['paralyze_heal', 'paralyze'],
    ];
    for (const [id, status] of rows) {
      const st = startBattle({ a: A({ status: [status] }), b: D() }).state;
      const r = turn(st, item(id), move(NOOP.id));
      expect(activeOf(r.state, 0).creature.status).toEqual([]);
      expect(eventsOf(r.events, 'statusCured')).toEqual([{ t: 'statusCured', target: { side: 0, slot: 0 }, status, cause: 'item' }]);
      // the wrong cure does nothing
      const wrong = turn(startBattle({ a: A({ status: [status === 'poison' ? 'burn' : 'poison'] }), b: D() }).state, item(id), move(NOOP.id));
      expect(eventsOf(wrong.events, 'statusCured').length).toBe(0);
    }
    const both = startBattle({ a: A({ status: ['paralyze', 'confuse'] }), b: D() }).state;
    const r = turn(both, item('full_heal'), move(NOOP.id));
    expect(activeOf(r.state, 0).creature.status).toEqual([]);
    expect(eventsOf(r.events, 'statusCured').map((e) => e.status)).toEqual(['paralyze', 'confuse']);
  });

  it('revive / max_revive only target a fainted party member; other items refuse fainted targets', () => {
    const st = startBattle({ a: [A(), A({ hp: 0 })], b: D() }).state;
    expect(validateAction(st, 0, item('revive', 1), content)).toBeNull();
    expect(validateAction(st, 0, item('revive', 0), content)).toBe('badItemTarget');
    expect(validateAction(st, 0, item('potion', 1), content)).toBe('badItemTarget');
    expect(validateAction(st, 0, item('potion', 7), content)).toBe('badItemTarget');
    const r = turn(st, item('revive', 1), move(NOOP.id));
    const revived = r.state.sides[0].party[1]!;
    expect(revived.creature.hp).toBe(Math.floor(revived.maxHp / 2));
    expect(eventsOf(r.events, 'heal')[0]).toMatchObject({ target: { side: 0, slot: 1 }, cause: 'item', item: 'revive' });
    const mr = turn(st, item('max_revive', 1), move(NOOP.id));
    expect(mr.state.sides[0].party[1]!.creature.hp).toBe(revived.maxHp);
  });

  it('elixir / max_ether / rarecandy / repel / nugget are not usable in battle; unknown ids are unknownItem', () => {
    const st = startBattle({ a: A(), b: D() }).state;
    for (const id of ['elixir', 'max_ether', 'rarecandy', 'repel', 'lure', 'nugget', 'star_piece']) {
      expect(validateAction(st, 0, item(id), content)).toBe('itemNotUsableInBattle');
    }
    expect(validateAction(st, 0, item('phoenix_down'), content)).toBe('unknownItem');
    expect(() => turn(st, item('elixir'), move(NOOP.id))).toThrow(/itemNotUsableInBattle/);
    expect((content.item('elixir') as ConsumableDef).usableInBattle).toBe(false);
  });

  it('escape_rope ends a wild battle as fled and is refused when the side cannot flee', () => {
    const wild = startBattle({ a: A(), b: D(), format: 'wild' }).state;
    const r = turn(wild, item('escape_rope'), null);
    expect(eventsOf(r.events, 'fled')).toEqual([{ t: 'fled', side: 0 }]);
    expect(r.state.ended).toEqual({ winner: 'fled' });
    expect(r.events.map((e) => e.t)).toEqual(['turnStart', 'itemUsed', 'fled', 'battleEnd']);
    const trainer = startBattle({ a: A(), b: D(), format: 'trainer' }).state;
    expect(validateAction(trainer, 0, item('escape_rope'), content)).toBe('itemNotUsableInBattle');
  });

  it('items resolve after switches and before catch and moves, ordered by speed between the two sides', () => {
    const st = startBattle({ a: [A({ hp: 5 }), A()], b: D({ hp: 5 }), format: 'pvp' }).state;
    const r = turn(st, item('potion'), item('potion'));
    // bramblecub (108) outspeeds mufflo (105): side 0's item first
    expect(eventsOf(r.events, 'itemUsed').map((e) => e.who.side)).toEqual([0, 1]);
    const r2 = turn(st, sw(1), item('potion'));
    const types = r2.events.map((e) => e.t);
    expect(types.indexOf('switchIn')).toBeLessThan(types.indexOf('itemUsed'));
  });
});
