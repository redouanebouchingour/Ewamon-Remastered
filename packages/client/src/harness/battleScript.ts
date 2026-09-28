/**
 * The §50.6.1 shot-5 battle, scripted with `@ewa/core` locally (no server): a wild battle between the player's lead and
 * the zone's first `common` encounter slot, resolved by the same `createBattle` / `resolveTurn` the server runs. The
 * harness plays it through the real BattleController (its preview digest matches, so the preview state is adopted
 * exactly as it is online). Pure and deterministic: the seed is the first one ≥ 1 whose turns 1 and 2 both carry a
 * move `damage` event and whose turn 1 ends with both battlers standing.
 */
import { calcMaxHp, createBattle, digestBattleState, expToLevel, projectBattler, resolveTurn } from '@ewa/core';
import type { Action, BattleEvent, BattleState, ContentIndex, CreatureInstance, Terrain } from '@ewa/core';

export interface ScriptOptions {
  readonly playerId: string;
  readonly playerSpecies: string;
  readonly playerLevel: number;
  readonly wildSpecies: string;
  readonly wildLevel: number;
  readonly zoneId: string;
  readonly terrain: Terrain;
  /** seeds tried: 1..maxSeed */
  readonly maxSeed?: number;
}

export interface ScriptedTurn {
  readonly action: Action;
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly digest: string;
}

export interface ScriptedBattle {
  readonly seed: number;
  readonly battleId: string;
  readonly start: { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly digest: string };
  readonly turns: readonly [ScriptedTurn, ScriptedTurn];
  readonly move: string;
}

/** A creature at `level` with its last ≤ 4 learnset moves (the fuzz driver's shape). */
export function makeCreature(content: ContentIndex, speciesId: string, level: number, id: string, ownerId: string | null): CreatureInstance {
  const sp = content.species(speciesId);
  const learned = sp.learnableMoves.filter((l) => l.level <= level).map((l) => l.move);
  const uniq = [...new Set(learned)].slice(-4);
  const moves = (uniq.length > 0 ? uniq : [sp.learnableMoves[0]!.move]).map((m) => {
    const def = content.move(m);
    return { id: m, pp: def.pp, ppMax: def.pp };
  });
  return {
    id, ownerId, speciesId, nickname: null, level, exp: expToLevel(level), hp: calcMaxHp(sp.baseHp, level), moves, status: [],
    ability: sp.abilities[0]!, heldItem: null, variantKey: 'normal', isAlpha: false, caughtAt: null, ribbons: [], favorite: false, locked: false,
  };
}

function moveDamage(events: readonly BattleEvent[]): boolean {
  return events.some((e) => e.t === 'damage' && e.cause === 'move');
}

function fainted(events: readonly BattleEvent[]): boolean {
  return events.some((e) => e.t === 'faint');
}

/** Builds the battle and resolves turns 1 and 2 (the player uses its first damaging move; the wild side passes null). */
export function scriptWildBattle(content: ContentIndex, o: ScriptOptions): ScriptedBattle {
  const lead = makeCreature(content, o.playerSpecies, o.playerLevel, 'harness-lead', o.playerId);
  const wild = makeCreature(content, o.wildSpecies, o.wildLevel, 'harness-wild', null);
  const move = lead.moves.find((m) => content.move(m.id).power > 0)?.id ?? lead.moves[0]!.id;
  const action: Action = { kind: 'move', move };
  const max = o.maxSeed ?? 500;
  for (let seed = 1; seed <= max; seed++) {
    const battleId = `harness-wild-${seed}`;
    const start = createBattle({
      id: battleId, format: 'wild', zoneId: o.zoneId, terrain: o.terrain, seed,
      sides: [
        { kind: 'player', party: [projectBattler(lead, content)], active: 0, trainerId: o.playerId, canFlee: true, canCatch: true },
        { kind: 'wild', party: [projectBattler(wild, content)], active: 0, trainerId: null, canFlee: false, canCatch: false },
      ],
    }, content);
    const t1 = resolveTurn(start.state, [action, null], content);
    if (t1.state.ended !== null || fainted(t1.events) || !moveDamage(t1.events)) continue;
    const t2 = resolveTurn(t1.state, [action, null], content);
    if (!moveDamage(t2.events)) continue;
    return {
      seed, battleId, move,
      start: { state: start.state, events: start.events, digest: digestBattleState(start.state) },
      turns: [
        { action, state: t1.state, events: t1.events, digest: digestBattleState(t1.state) },
        { action, state: t2.state, events: t2.events, digest: digestBattleState(t2.state) },
      ],
    };
  }
  throw new Error(`no seed in 1..${max} gives two damaging turns for ${o.playerSpecies} vs ${o.wildSpecies}`);
}
