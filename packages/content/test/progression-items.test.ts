/**
 * Phase D1–D3 content: story grants, TMs + move tutors, evolution stones and trade evolutions.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TABLES,
  EVOLUTION_STONES,
  KEY_ITEMS,
  LEAGUE,
  MOVE_TUTOR_PRICE,
  MOVES,
  PROGRESSION_STOCK,
  QUESTS,
  SPECIES,
  STORY,
  TM_MOVES,
  ZONES,
  canLearnMachineMove,
  createContentIndex,
  storyBeat,
  tmItemId,
  tmMoveOf,
  validate,
} from '../src/index';
import { STONE_AND_TRADE_EVOLUTIONS } from '../src/data/evolutions';

const idx = createContentIndex();
const species = (id: string) => SPECIES.find((s) => s.id === id)!;
const move = (id: string) => MOVES.find((m) => m.id === id)!;

describe('D1 story grants', () => {
  it('HM Cut at bloom_after, Old Rod from Maren at drowned_harbour, HM Surf at current_after, HM Strength at fault_after', () => {
    expect(storyBeat('bloom_after').grant).toEqual({ 'HM Cut': 1 });
    expect(storyBeat('drowned_harbour').grant).toEqual({ old_rod: 1 });
    expect(storyBeat('drowned_harbour').speaker).toBe('saltmourn.harbourmaster');
    expect(storyBeat('current_after').grant).toEqual({ 'HM Surf': 1 });
    expect(storyBeat('fault_after').grant).toEqual({ 'HM Strength': 1 });
  });

  it('every granted item resolves in the ContentIndex as a key item and the grant says so in `after`', () => {
    for (const b of STORY) {
      for (const id of Object.keys(b.grant ?? {})) {
        const def = idx.item(id);
        expect('slot' in def && def.slot === 'key', `${b.id}: ${id}`).toBe(true);
        expect(b.after.length, `${b.id} announces the gift`).toBeGreaterThan(0);
      }
    }
  });

  it('a grant is never a gate: no need flag names an item', () => {
    const granted = new Set(STORY.flatMap((b) => Object.keys(b.grant ?? {})));
    for (const b of STORY) for (const f of b.need) expect(granted.has(f)).toBe(false);
  });

  it('mutation: a grant naming an unknown item fails validation', async () => {
    const { STORY: story } = await import('../src/data/story');
    const beat = story.find((b) => b.id === 'current_after') as { grant?: Record<string, number> };
    const saved = beat.grant;
    beat.grant = { 'HM Fly': 1 };
    try {
      const r = validate({ skipHeightfields: true });
      expect(r.errors.some((e) => e.includes('current_after') && e.includes('HM Fly'))).toBe(true);
    } finally {
      beat.grant = saved;
    }
  });
});

describe('D2 TMs and tutors', () => {
  it('39 TMs, each a priced key item named after its move, that tmMoveOf inverts', () => {
    expect(TM_MOVES.length).toBe(39);
    expect(new Set(TM_MOVES).size).toBe(39);
    for (const m of TM_MOVES) {
      expect(MOVES.some((x) => x.id === m), m).toBe(true);
      const def = idx.item(tmItemId(m));
      expect('slot' in def && def.slot === 'key').toBe(true);
      expect('price' in def && def.price !== null && def.price > 0).toBe(true);
      expect(tmMoveOf(tmItemId(m))).toBe(m);
      expect(tmItemId(m).length).toBeLessThanOrEqual(40); // protocol ItemId cap
    }
    expect(tmMoveOf('potion')).toBeNull();
    expect(KEY_ITEMS.filter((k) => tmMoveOf(k.id) !== null)).toHaveLength(39);
  });

  it('TMs are sold from Saltmourn on and every TM can be bought or earned', () => {
    const sold = new Set(ZONES.flatMap((z) => z.shop ?? []));
    const rewarded = new Set(QUESTS.flatMap((q) => Object.keys(q.rewards.items)));
    for (const m of TM_MOVES) expect(sold.has(tmItemId(m)) || rewarded.has(tmItemId(m)), m).toBe(true);
    for (const z of ['mirevale', 'cinderhold'] as const) expect(ZONES.find((x) => x.id === z)!.shop!.some((i) => tmMoveOf(i) !== null)).toBe(false);
    for (const [zone, stock] of Object.entries(PROGRESSION_STOCK)) {
      const shop = ZONES.find((z) => z.id === zone)!.shop!;
      for (const id of stock ?? []) expect(shop, `${zone} sells ${id}`).toContain(id);
    }
  });

  it('machine compatibility: Normal moves for anyone, typed moves for a shared type or a learnset entry', () => {
    const fire = species('cindercap'); // Fire
    expect(canLearnMachineMove(fire, move('Body Slam'))).toBe(true);
    expect(canLearnMachineMove(fire, move('Heat Wave'))).toBe(true);
    expect(canLearnMachineMove(fire, move('Ice Beam'))).toBe(false);
    const learnsetMove = fire.learnableMoves.find((e) => move(e.move).type !== 'Fire' && move(e.move).type !== 'Normal');
    if (learnsetMove !== undefined) expect(canLearnMachineMove(fire, move(learnsetMove.move))).toBe(true);
  });

  it('two town NPCs are move tutors, teaching real moves', () => {
    const tutors = ZONES.flatMap((z) => z.npcs.filter((n) => n.tutor !== undefined).map((n) => ({ z, n })));
    expect(tutors.map((t) => t.n.id).sort()).toEqual(['skyrend.roost_keeper', 'vesperveil.lantern_maker']);
    for (const { z, n } of tutors) {
      expect(z.kind).toBe('town');
      for (const m of n.tutor!) expect(MOVES.some((x) => x.id === m), m).toBe(true);
    }
    expect(MOVE_TUTOR_PRICE).toBeGreaterThan(0);
    // non-tutors carry no key at all (the layout reads x/z only, but keep the records byte-identical)
    expect(ZONES.flatMap((z) => z.npcs).filter((n) => 'tutor' in n)).toHaveLength(2);
  });
});

describe('D3 evolution stones and trade evolutions', () => {
  it('species.ts carries exactly the STONE_AND_TRADE_EVOLUTIONS table', () => {
    const fromSpecies = Object.fromEntries(
      SPECIES.filter((s) => s.evolution !== null && (s.evolution.kind === 'item' || s.evolution.kind === 'trade')).map((s) => [s.id, s.evolution]),
    );
    expect(fromSpecies).toEqual(STONE_AND_TRADE_EVOLUTIONS);
    expect(Object.keys(STONE_AND_TRADE_EVOLUTIONS)).toHaveLength(9);
  });

  it('six stones, each an evolutionStone consumable that some species uses and some town sells', () => {
    expect(EVOLUTION_STONES).toHaveLength(6);
    const sold = new Set(ZONES.flatMap((z) => z.shop ?? []));
    for (const st of EVOLUTION_STONES) {
      expect(st.effect).toEqual({ kind: 'evolutionStone' });
      expect(st.usableInBattle).toBe(false);
      expect(idx.item(st.id)).toBe(st);
      expect(SPECIES.some((s) => s.evolution?.kind === 'item' && s.evolution.item === st.id), st.id).toBe(true);
      expect(sold.has(st.id), st.id).toBe(true);
    }
  });

  it('no league team holds a stone / trade family (the story walk and the league evolve as before)', () => {
    const fam = new Set<string>();
    for (const [from, e] of Object.entries(STONE_AND_TRADE_EVOLUTIONS)) {
      fam.add(from);
      fam.add(e.into);
    }
    for (const l of LEAGUE) for (const m of l.team) expect(fam.has(m.species), `${l.id}: ${m.species}`).toBe(false);
  });

  it('mutation: an item evolution naming a non-stone fails; a stone nobody sells fails', () => {
    const bad = SPECIES.map((s) => (s.id === 'embrock' ? { ...s, evolution: { kind: 'item' as const, item: 'potion', into: 'magmolith' } } : s));
    const r1 = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, species: bad });
    expect(r1.errors.some((e) => e.includes('embrock') && e.includes('not an evolution stone'))).toBe(true);
    const unsold = DEFAULT_TABLES.zones.map((z) => (z.shop === null ? z : { ...z, shop: z.shop.filter((i) => i !== 'dusk_stone') }));
    const r2 = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, zones: unsold });
    expect(r2.errors.some((e) => e.includes('dusk_stone') && e.includes('not sold'))).toBe(true);
  });
});
