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
  /** the wild level the script used (the slot's minimum, raised when no move gives two damaging turns) */
  readonly wildLevel: number;
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

/**
 * Builds the battle and resolves turns 1 and 2 (the player repeats one damaging move; the wild side passes null). The
 * lead's first damaging move is tried first (the M2 choice), then the others weakest first (a strong move one-shots a level-2 creature it is super-effective against, and an
 * immune target takes no damage), each over seeds 1..maxSeed; if no move works at the wild level, the wild level is
 * raised by 2 up to +10, then lowered to 6 / 4 / 2 (M3 zones whose first common slot is immune to, fragile against, or
 * far above the slice's level-5 lead).
 */
export function scriptWildBattle(content: ContentIndex, o: ScriptOptions): ScriptedBattle {
  const lead = makeCreature(content, o.playerSpecies, o.playerLevel, 'harness-lead', o.playerId);
  // the M2 choice first (the lead's first damaging move, so the slice's shot is unchanged), then the others weakest first
  const damaging = lead.moves.filter((m) => content.move(m.id).power > 0).map((m) => m.id);
  const rest = damaging.slice(1).sort((a, b) => content.move(a).power - content.move(b).power);
  const moves = damaging.length > 0 ? [damaging[0]!, ...rest] : [lead.moves[0]!.id];
  const max = o.maxSeed ?? 500;
  // pass 0: turns 1 and 2 both carry move damage; pass 1 (last resort, e.g. a Steel wild that sets Iron Defense on turn
  // 1 and walls the slice lead): turn 1 damages, turn 2 only has a move used (the stage then notes "no HP frame")
  // wild levels: the slot's own, raised by 2 up to +10, then (late-game slots that knock the level-5 lead out on turn 1)
  // lowered to 6, 4, 2
  const levels = [0, 2, 4, 6, 8, 10].map((b) => o.wildLevel + b).concat([6, 4, 2].filter((l) => l < o.wildLevel));
  for (let pass = 0; pass < 2; pass++) for (const level of levels) {
    const wild = makeCreature(content, o.wildSpecies, level, 'harness-wild', null);
    for (const move of moves) {
      const action: Action = { kind: 'move', move };
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
        if (pass === 0 ? !moveDamage(t2.events) : !t2.events.some((e) => e.t === 'moveUsed')) continue;
        return {
          seed, battleId, move, wildLevel: level,
          start: { state: start.state, events: start.events, digest: digestBattleState(start.state) },
          turns: [
            { action, state: t1.state, events: t1.events, digest: digestBattleState(t1.state) },
            { action, state: t2.state, events: t2.events, digest: digestBattleState(t2.state) },
          ],
        };
      }
    }
  }
  throw new Error(`no seed in 1..${max} gives two damaging turns for ${o.playerSpecies} vs ${o.wildSpecies} (any damaging move, wild level +0..+10 or 6 / 4 / 2)`);
}
