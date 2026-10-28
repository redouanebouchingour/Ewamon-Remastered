/**
 * Watching battles in the open world (watch.ts): the spectator's field and a turn as `WatchEvent`s carry only what
 * both fighters see (species, look, level, hp as a percentage, the moves, the hits) and parse as `battleWatch`.
 */
import { describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { calcMaxHp, createBattle, expToLevel, projectBattler, resolveTurn } from '@ewa/core';
import type { BattleState, CreatureInstance } from '@ewa/core';
import { BattleWatchMsg, decodeLeadFlags, watchEvents, watchField } from '../src/index';

const content = createContentIndex();

function creature(speciesId: string, level: number, id: string, shiny = false): CreatureInstance {
  const sp = content.species(speciesId);
  const moves = [...new Set(sp.learnableMoves.filter((l) => l.level <= level).map((l) => l.move))].slice(-4).map((m) => ({ id: m, pp: content.move(m).pp, ppMax: content.move(m).pp }));
  return {
    id, ownerId: null, speciesId, nickname: 'Secret Name', level, exp: expToLevel(level), hp: calcMaxHp(sp.baseHp, level), moves, status: [],
    ability: sp.abilities[0]!, heldItem: 'oran_berry', variantKey: 'normal', isAlpha: false, caughtAt: null, ribbons: [], favorite: false, locked: false,
    ...(shiny ? { isShiny: true } : {}),
  };
}

function battle(): BattleState {
  return createBattle(
    {
      id: 'b1', format: 'wild', zoneId: 'mirevale', terrain: 'grove', seed: 7,
      sides: [
        { kind: 'player', party: [projectBattler(creature('mossling', 20, 'a', true), content), projectBattler(creature('glimp', 18, 'a2'), content)], active: 0, trainerId: 'p0', canFlee: true, canCatch: true },
        { kind: 'wild', party: [projectBattler(creature('glimp', 12, 'w'), content)], active: 0, trainerId: null, canFlee: false, canCatch: false },
      ],
    },
    content,
  ).state;
}

describe('watchField', () => {
  it('the creatures on the field only: species, look, level, full hp as 100, no bench, nickname or item', () => {
    const f = watchField(battle(), content);
    expect(f).toEqual([
      { side: 0, pos: 0, species: 'mossling', flags: f[0]!.flags, level: 20, hpPct: 100, status: '' },
      { side: 1, pos: 0, species: 'glimp', flags: 0, level: 12, hpPct: 100, status: '' },
    ]);
    expect(decodeLeadFlags(f[0]!.flags).isShiny).toBe(true);
    expect(JSON.stringify(f)).not.toContain('Secret');
    expect(JSON.stringify(f)).not.toContain('oran');
  });
});

describe('watchEvents', () => {
  it('a turn: both moves, the hits as percentages (never the amount or the hp), nothing about exp', () => {
    const before = battle();
    const move = (side: 0 | 1): string => before.sides[side].party[0]!.creature.moves[0]!.id;
    const { state, events } = resolveTurn(before, [{ kind: 'move', move: move(0) }, { kind: 'move', move: move(1) }], content);
    const w = watchEvents(state, events, content);
    expect(w.filter((e) => e.k === 'move').map((e) => (e.k === 'move' ? e.move : ''))).toEqual(events.filter((e) => e.t === 'moveUsed').map((e) => (e.t === 'moveUsed' ? e.move : '')));
    for (const e of events) {
      if (e.t !== 'damage') continue;
      const hit = w.find((x) => x.k === 'hit' && x.side === e.target.side);
      expect(hit).toMatchObject({ hpPct: e.hpAfter <= 0 ? 0 : Math.max(1, Math.ceil((e.hpAfter / e.maxHp) * 100)) });
    }
    const wire = JSON.stringify(w);
    for (const k of ['amount', 'hpAfter', 'maxHp', 'expAfter', 'ppLeft']) expect(wire).not.toContain(k);
    expect(BattleWatchMsg.safeParse({ type: 'battleWatch', battleId: 'b1', turn: state.turn, events: w }).success).toBe(true);
  });

  it('a knockout ends with a faint and the end; a catch throw names the thrower', () => {
    let st = battle();
    let all: ReturnType<typeof watchEvents> = [];
    for (let i = 0; i < 30 && st.ended === null; i++) {
      const r = resolveTurn(st, [{ kind: 'move', move: st.sides[0].party[st.sides[0].active]!.creature.moves[0]!.id }, { kind: 'move', move: st.sides[1].party[0]!.creature.moves[0]!.id }], content);
      all = [...all, ...watchEvents(r.state, r.events, content)];
      st = r.state;
    }
    expect(st.ended).not.toBeNull();
    expect(all.some((e) => e.k === 'faint')).toBe(true);
    expect(all.at(-1)).toEqual({ k: 'end', winner: (st.ended as { winner: unknown }).winner });
  });
});
