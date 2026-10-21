/**
 * Shared test helpers: a process-wide legacy ContentIndex, creature/battler/side/battle builders, scripted
 * and counting Rngs, event pickers, and a seed finder for chance-gated behaviour (resolveTurn draws from
 * state.rng, so scripted outcomes are reached by choosing the seed, never by patching core).
 */
import type {
  Action,
  Battler,
  BattleEvent,
  BattleFormat,
  BattleState,
  CreatureInstance,
  MoveDef,
  Rng,
  RngState,
  Side,
  StatusId,
  TurnResult,
} from '../src/index';
import { createBattle, createRng, projectBattler, resolveTurn } from '../src/index';
import { buildLegacyContent, defaultEffectChance } from './fixtures/legacyContent';
import type { LegacyContent } from './fixtures/legacyContent';

export const content: LegacyContent = buildLegacyContent();

// ─── creatures ──────────────────────────────────────────────────────────────

export interface CreatureSpec {
  readonly species: string;
  readonly level?: number;
  readonly moves?: readonly string[];
  readonly ability?: string;
  readonly heldItem?: string | null;
  readonly hp?: number; // absolute; default full
  readonly status?: readonly StatusId[];
  readonly isAlpha?: boolean;
  readonly nickname?: string | null;
  readonly exp?: number;
  readonly pp?: number; // override pp on every move
  readonly honor?: number; // the honor ledger (absent = no field)
  readonly bandborn?: true; // breeding: hatched from a Majin and a Tenjin parent (absent = no field)
}

let nextId = 1;

export function creature(spec: CreatureSpec, c: LegacyContent = content): CreatureInstance {
  const sp = c.species(spec.species);
  const level = spec.level ?? 50;
  const moveIds = spec.moves ?? sp.moves;
  const moves = moveIds.map((id) => {
    const md = c.move(id);
    const pp = spec.pp ?? md.pp;
    return { id, pp, ppMax: md.pp };
  });
  const maxHp = Math.floor((sp.baseHp * level) / 50) + level + 20;
  return {
    id: `c${nextId++}`,
    ownerId: null,
    speciesId: sp.id,
    nickname: spec.nickname ?? null,
    level,
    exp: spec.exp ?? level * level * level,
    hp: spec.hp ?? maxHp,
    moves,
    status: spec.status ?? [],
    ability: spec.ability ?? sp.abilities[0]!,
    heldItem: spec.heldItem ?? null,
    variantKey: 'normal',
    isAlpha: spec.isAlpha ?? false,
    caughtAt: null,
    ...(spec.honor !== undefined ? { honor: spec.honor } : {}),
    ...(spec.bandborn === true ? { bandborn: true as const } : {}),
    ribbons: [],
    favorite: false,
    locked: false,
  };
}

export function battler(spec: CreatureSpec, c: LegacyContent = content): Battler {
  return projectBattler(creature(spec, c), c);
}

// ─── sides and battles ──────────────────────────────────────────────────────

export interface SideSpec {
  readonly party: readonly CreatureSpec[];
  readonly kind?: Side['kind'];
  readonly active?: number;
  readonly canFlee?: boolean;
  readonly canCatch?: boolean;
  readonly trainerId?: string | null;
}

export interface BattleSpec {
  readonly a: SideSpec | readonly CreatureSpec[] | CreatureSpec;
  readonly b: SideSpec | readonly CreatureSpec[] | CreatureSpec;
  readonly format?: BattleFormat;
  readonly seed?: RngState | number | string;
  readonly id?: string;
  readonly content?: LegacyContent;
}

function toSideSpec(x: SideSpec | readonly CreatureSpec[] | CreatureSpec): SideSpec {
  if (Array.isArray(x)) return { party: x as readonly CreatureSpec[] };
  if ('party' in x) return x as SideSpec;
  return { party: [x as CreatureSpec] };
}

export function makeSide(
  spec: SideSpec,
  role: 'player' | 'foe',
  format: BattleFormat,
  c: LegacyContent,
): Omit<Side, 'mustSwitch' | 'consumedItems'> {
  const defaultKind: Side['kind'] = role === 'player' ? 'player' : format === 'wild' ? 'wild' : format === 'pvp' ? 'player' : 'npc';
  const kind = spec.kind ?? defaultKind;
  return {
    kind,
    party: spec.party.map((p) => battler(p, c)),
    active: spec.active ?? 0,
    trainerId: spec.trainerId ?? (kind === 'player' ? `${role}-uuid` : kind === 'npc' ? 'npc-trainer' : null),
    canFlee: spec.canFlee ?? (role === 'player' && format === 'wild'),
    canCatch: spec.canCatch ?? (role === 'player' && format === 'wild'),
  };
}

/** createBattle from compact specs. Side 0 is the player side. */
export function startBattle(spec: BattleSpec): TurnResult {
  const c = spec.content ?? content;
  const format = spec.format ?? 'trainer';
  return createBattle(
    {
      id: spec.id ?? 'test-battle',
      format,
      zoneId: 'mirevale',
      terrain: 'grove',
      seed: spec.seed ?? 'ewamon',
      sides: [makeSide(toSideSpec(spec.a), 'player', format, c), makeSide(toSideSpec(spec.b), 'foe', format, c)],
    },
    c,
  );
}

export const move = (m: string): Action => ({ kind: 'move', move: m });
export const sw = (to: number): Action => ({ kind: 'switch', to });
export const item = (id: string, target?: number): Action => (target === undefined ? { kind: 'item', item: id } : { kind: 'item', item: id, target });
export const FLEE: Action = { kind: 'flee' };
export const FORFEIT: Action = { kind: 'forfeit' };
export const catchWith = (orb: string): Action => ({ kind: 'catch', orb });

/**
 * A copy of `state` in which `side`'s active creature knows `moveId` (full PP). No-op when it already does or
 * when content does not know the move. Fills a free slot first; at four moves the LAST slot is replaced, so a
 * species default is what gets displaced — never a move a test taught earlier in the same call chain unless
 * it sat in slot 3. Movesets never touch the rng stream, so seed-driven assertions are unaffected.
 */
export function teach(state: BattleState, side: 0 | 1, moveId: string, c: LegacyContent = content): BattleState {
  const s = state.sides[side];
  const b = s.party[s.active];
  if (b === undefined) return state;
  if (b.creature.moves.some((m) => m.id === moveId)) return state;
  let md: MoveDef;
  try {
    md = c.move(moveId);
  } catch (_e) {
    return state;
  }
  const slot = { id: md.id, pp: md.pp, ppMax: md.pp };
  const moves = b.creature.moves.length < 4 ? [...b.creature.moves, slot] : [...b.creature.moves.slice(0, 3), slot];
  const party = s.party.map((p, i) => (i === s.active ? { ...p, creature: { ...p.creature, moves } } : p));
  const sides: BattleState['sides'] = side === 0 ? [{ ...s, party }, state.sides[1]] : [state.sides[0], { ...s, party }];
  return { ...state, sides };
}

/**
 * resolveTurn with a test convenience: a `move` action naming a content-registered move the active creature
 * does not know is taught first (see `teach`), so scenario files can register dozens of `customMove`s and use
 * them on a stock creature. Core's own `unknownMove` rule (§2.10) is asserted through `resolveTurn` directly.
 */
export function turn(state: BattleState, a0: Action | null, a1: Action | null, c: LegacyContent = content): TurnResult {
  let st = state;
  if (a0 !== null && a0.kind === 'move') st = teach(st, 0, a0.move, c);
  if (a1 !== null && a1.kind === 'move') st = teach(st, 1, a1.move, c);
  return resolveTurn(st, [a0, a1], c);
}

export function activeOf(state: BattleState, side: 0 | 1): Battler {
  const s = state.sides[side];
  return s.party[s.active]!;
}

// ─── events ─────────────────────────────────────────────────────────────────

export type EventOf<T extends BattleEvent['t']> = Extract<BattleEvent, { t: T }>;

export function eventsOf<T extends BattleEvent['t']>(events: readonly BattleEvent[], t: T): EventOf<T>[] {
  return events.filter((e): e is EventOf<T> => e.t === t);
}

export function firstEvent<T extends BattleEvent['t']>(events: readonly BattleEvent[], t: T): EventOf<T> | undefined {
  return eventsOf(events, t)[0];
}

export function eventTypes(events: readonly BattleEvent[]): string[] {
  return events.map((e) => e.t);
}

// ─── rngs ───────────────────────────────────────────────────────────────────

/** An Rng whose int(n) returns the scripted values in order (mod n); next() returns v / 2^32. Runs out → throws. */
export function scriptedRng(values: readonly number[]): Rng & { readonly draws: () => number } {
  let i = 0;
  const take = (): number => {
    if (i >= values.length) throw new Error(`scriptedRng exhausted after ${values.length} draws`);
    return values[i++]!;
  };
  const rng: Rng & { draws: () => number } = {
    next: () => take() / 4294967296,
    int: (n) => take() % n,
    chance: (p) => take() / 4294967296 < p,
    pick: (a) => a[take() % a.length]!,
    shuffle: (a) => {
      const out = a.slice();
      for (let k = out.length - 1; k > 0; k--) {
        const j = take() % (k + 1);
        const tmp = out[k]!;
        out[k] = out[j]!;
        out[j] = tmp;
      }
      return out;
    },
    fork: () => scriptedRng(values.slice(i)),
    snapshot: () => [0, 0, 0, 0],
    draws: () => i,
  };
  return rng;
}

/** Wraps an Rng and counts every underlying draw (int/next/chance/pick each = 1; shuffle = n-1; fork = 4). */
export function countingRng(inner: Rng): Rng & { readonly count: () => number } {
  let n = 0;
  return {
    next: () => {
      n++;
      return inner.next();
    },
    int: (k) => {
      n++;
      return inner.int(k);
    },
    chance: (p) => {
      n++;
      return inner.chance(p);
    },
    pick: (a) => {
      n++;
      return inner.pick(a);
    },
    shuffle: (a) => {
      n += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    fork: () => {
      n += 4;
      return inner.fork();
    },
    snapshot: () => inner.snapshot(),
    count: () => n,
  };
}

export const rngFor = (seed: RngState | number | string): Rng => createRng(seed);

/** Tries seeds 0..maxTries-1 until `run(seed)` returns a truthy value; returns that value. Throws when none does. */
export function findSeed<T>(run: (seed: number) => T | null | undefined | false, maxTries = 500): T {
  for (let seed = 0; seed < maxTries; seed++) {
    const r = run(seed);
    if (r) return r;
  }
  throw new Error(`findSeed: no seed in 0..${maxTries - 1} satisfied the predicate`);
}

// ─── content tweaks ─────────────────────────────────────────────────────────

/**
 * A copy of an existing move with fields overridden, registered under a new id. When the patch changes `effect`
 * or `power` without pinning `effectChance`, the §2.4 default chance is re-derived for the new (effect, power)
 * pair — as the content build would — instead of inheriting the base move's chance.
 */
export function customMove(base: string, id: string, patch: Partial<MoveDef>, c: LegacyContent = content): MoveDef {
  const merged: MoveDef = { ...c.move(base), ...patch, id };
  const rederive = patch.effectChance === undefined && (patch.effect !== undefined || patch.power !== undefined);
  const m: MoveDef = rederive ? { ...merged, effectChance: defaultEffectChance(merged.effect, merged.power) } : merged;
  c.withMove(m);
  return m;
}
