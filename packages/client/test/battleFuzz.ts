/**
 * A seeded battle driver for the client tests (the §2.20 fuzz shape, rebuilt here: tests may not import core's own
 * test helpers across packages). Random 1..6 parties from `allSpecies()`, levels 5..60, learnset moves; player sides
 * are driven by `chooseNpcAction` over a forked rng, NPC / wild sides pass null (core chooses, §2.10).
 */
import { calcMaxHp, chooseNpcAction, createBattle, createRng, expToLevel, projectBattler, resolveTurn, validateAction } from '@ewa/core';
import type { Action, BattleEvent, BattleFormat, BattleState, ContentIndex, CreatureInstance, Rng, Side, SpeciesDef } from '@ewa/core';

const FORMATS: readonly BattleFormat[] = ['wild', 'trainer', 'league', 'pvp'];

export function makeCreature(content: ContentIndex, sp: SpeciesDef, level: number, id: string, ownerId: string | null): CreatureInstance {
  const learned = sp.learnableMoves.filter((l) => l.level <= level).map((l) => l.move);
  const uniq = [...new Set(learned)].slice(-4);
  const moves = (uniq.length > 0 ? uniq : [sp.learnableMoves[0]!.move]).map((m) => {
    const def = content.move(m);
    return { id: m, pp: def.pp, ppMax: def.pp };
  });
  return {
    id, ownerId, speciesId: sp.id, nickname: null, level, exp: expToLevel(level), hp: calcMaxHp(sp.baseHp, level), moves, status: [],
    ability: sp.abilities[0]!, heldItem: null, variantKey: 'normal', isAlpha: false, caughtAt: null, ribbons: [], favorite: false, locked: false,
  };
}

function party(content: ContentIndex, rng: Rng, n: number, prefix: string, ownerId: string | null): CreatureInstance[] {
  const all = content.allSpecies();
  const out: CreatureInstance[] = [];
  for (let i = 0; i < n; i++) out.push(makeCreature(content, all[rng.int(all.length)]!, 5 + rng.int(56), `${prefix}-${i}`, ownerId));
  return out;
}

export interface TurnRecord {
  readonly before: BattleState;
  readonly events: readonly BattleEvent[];
  readonly after: BattleState;
}

export interface FuzzBattle {
  readonly seed: number;
  readonly format: BattleFormat;
  readonly start: { readonly state: BattleState; readonly events: readonly BattleEvent[] };
  readonly turns: readonly TurnRecord[];
}

export function startBattle(content: ContentIndex, seed: number, format: BattleFormat, p0: readonly CreatureInstance[], p1: readonly CreatureInstance[]): { state: BattleState; events: readonly BattleEvent[] } {
  const kind1: Side['kind'] = format === 'wild' ? 'wild' : format === 'pvp' ? 'player' : 'npc';
  const side0 = { kind: 'player' as const, party: p0.map((c) => projectBattler(c, content)), active: 0, trainerId: 'p0', canFlee: format === 'wild', canCatch: format === 'wild' };
  const side1 = { kind: kind1, party: p1.map((c) => projectBattler(c, content)), active: 0, trainerId: kind1 === 'wild' ? null : 'p1', canFlee: format === 'pvp' ? false : false, canCatch: false };
  const r = createBattle({ id: `b-${seed}`, format, zoneId: 'mirevale', terrain: 'grove', seed, sides: [side0, side1] }, content);
  return { state: r.state, events: r.events };
}

export function runFuzzBattle(content: ContentIndex, seed: number, maxTurns = 200): FuzzBattle {
  const rng = createRng(seed);
  const format = FORMATS[rng.int(FORMATS.length)]!;
  const p0 = party(content, rng, 1 + rng.int(6), `s${seed}a`, 'p0');
  const p1 = party(content, rng, format === 'wild' ? 1 : 1 + rng.int(6), `s${seed}b`, format === 'pvp' ? 'p1' : null);
  const start = startBattle(content, seed, format, p0, p1);
  const driver = rng.fork();
  let state = start.state;
  const turns: TurnRecord[] = [];
  while (state.ended === null && turns.length < maxTurns) {
    const anySwitch = state.sides[0].mustSwitch || state.sides[1].mustSwitch;
    const acts: [Action | null, Action | null] = [null, null];
    for (const side of [0, 1] as const) {
      if (state.sides[side].kind !== 'player') continue;
      if (anySwitch && !state.sides[side].mustSwitch) continue;
      const a = chooseNpcAction(state, side, content, driver);
      if (validateAction(state, side, a, content) !== null) throw new Error(`seed ${seed}: invalid fuzz action`);
      acts[side] = a;
    }
    const res = resolveTurn(state, acts, content);
    turns.push({ before: state, events: res.events, after: res.state });
    state = res.state;
  }
  return { seed, format, start, turns };
}
