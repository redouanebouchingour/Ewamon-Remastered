/**
 * §2.20 fuzz driver — shared by determinism.test.ts (the 1,000-seed run + digests) and npc.test.ts (policy
 * legality over thousands of real states). Pure over (seed, content): the same seed against any correctly
 * built ContentIndex must produce the same digests, which is exactly what the two-instance run asserts.
 *
 * Per seed: two random 1..6-creature parties from allSpecies(), levels 5..100, random held items / abilities /
 * learnset moves / hp / status, a random format among the five; player sides are driven by chooseNpcAction
 * over a forked rng (the server would forward a human's choice; the policy stands in for one), NPC/wild sides
 * pass null so core chooses from the battle rng (§2.10). Wild battles sprinkle catch / item / flee actions so
 * every action kind reaches resolveTurn.
 */
import type {
  Action,
  BattleFormat,
  BattleState,
  ContentIndex,
  CreatureInstance,
  MajorStatus,
  Rng,
  Side,
  SpeciesDef,
  TurnResult,
  VariantKey,
} from '../src/index';
import {
  calcMaxHp,
  canonicalJson,
  chooseNpcAction,
  createBattle,
  createRng,
  digestBattleState,
  fnv1a32,
  projectBattler,
  resolveTurn,
  validateAction,
} from '../src/index';
import { isHeldItemDef } from '../src/items';

export const FORMATS: readonly BattleFormat[] = ['wild', 'trainer', 'league', 'pvp', 'raid'];
const MAJOR: readonly MajorStatus[] = ['burn', 'poison', 'paralyze', 'sleep', 'freeze'];
const VARIANTS: readonly VariantKey[] = ['normal', 'dawn', 'dusk', 'verdant', 'ember'];
const ORBS: readonly string[] = ['spark_orb', 'crest_orb', 'prism_orb', 'mythos_orb', 'verdant_orb', 'ember_orb', 'tide_orb', 'dusk_orb', 'phantom_orb', 'aether_orb'];
const BATTLE_ITEMS: readonly string[] = ['potion', 'superpotion', 'hyper_potion', 'max_potion', 'full_restore', 'revive', 'max_revive', 'full_heal', 'antidote', 'burn_heal'];

/** Held items a creature may carry in the fuzz: every `slot: 'held'` ItemDef in content, sorted by id. */
export function heldItemIds(content: ContentIndex, candidates: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const id of candidates) {
    try {
      const def = content.item(id);
      if (isHeldItemDef(def) && def.slot === 'held') out.push(id);
    } catch (_e) {
      // not in this content
    }
  }
  return out.slice().sort();
}

export const HELD_CANDIDATES: readonly string[] = [
  'Assault Vest', 'Choice Band', 'Choice Scarf', 'Choice Specs', 'Eviolite', 'Heavy Duty Boots', 'Sitrus Berry',
  'Oran Berry', 'Charcoal', 'Mystic Water', 'Mirrorcoat', 'Black Sludge', 'Weakness Policy', 'Speed Scarf',
];

export function randomCreature(rng: Rng, sp: SpeciesDef, held: readonly string[], content: ContentIndex, id: string): CreatureInstance {
  const level = 5 + rng.int(96);
  // moves: the defaults, or up to 4 distinct learnset moves reachable at this level
  let moveIds: string[] = sp.moves.slice();
  if (rng.chance(0.5)) {
    const pool: string[] = [];
    for (const e of sp.learnableMoves) if (e.level <= level && pool.indexOf(e.move) === -1) pool.push(e.move);
    if (pool.length > 0) {
      const n = 1 + rng.int(Math.min(4, pool.length));
      moveIds = rng.shuffle(pool).slice(0, n);
    }
  }
  const moves = moveIds.map((m) => {
    const md = content.move(m);
    const pp = rng.chance(0.1) ? rng.int(md.pp + 1) : md.pp;
    return { id: m, pp, ppMax: md.pp };
  });
  const maxHp = calcMaxHp(sp.baseHp, level);
  const hp = rng.chance(0.2) ? 1 + rng.int(maxHp) : maxHp;
  const status = rng.chance(0.15) ? [rng.pick(MAJOR)] : [];
  return {
    id,
    ownerId: null,
    speciesId: sp.id,
    nickname: null,
    level,
    exp: level * level * level,
    hp,
    moves,
    status,
    ability: rng.pick(sp.abilities),
    heldItem: rng.chance(0.5) && held.length > 0 ? rng.pick(held) : null,
    variantKey: rng.pick(VARIANTS),
    isAlpha: rng.chance(0.1),
    caughtAt: null,
    ribbons: [],
    favorite: false,
    locked: false,
  };
}

export interface FuzzSetup {
  readonly format: BattleFormat;
  readonly state: BattleState;
  readonly createEvents: TurnResult['events'];
  /** The driver stream for player-side choices (independent of the battle rng). */
  readonly driver: Rng;
}

export function buildBattle(seed: number, content: ContentIndex): FuzzSetup {
  const rng = createRng(seed);
  const all = content.allSpecies();
  const held = heldItemIds(content, HELD_CANDIDATES);
  const format = rng.pick(FORMATS);
  const n0 = 1 + rng.int(6);
  const n1 = format === 'wild' || format === 'raid' ? 1 : 1 + rng.int(6);
  const party = (n: number, tag: string) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(projectBattler(randomCreature(rng, rng.pick(all), held, content, `${tag}${i}`), content));
    return out;
  };
  const p0 = party(n0, 'a');
  const p1 = party(n1, 'b');
  // side 0 always has a standing lead (a battle cannot start with a fainted active)
  if (p0[0]!.creature.hp <= 0) p0[0] = { ...p0[0]!, creature: { ...p0[0]!.creature, hp: 1 } };
  if (p1[0]!.creature.hp <= 0) p1[0] = { ...p1[0]!, creature: { ...p1[0]!.creature, hp: 1 } };
  const kind1: Side['kind'] = format === 'wild' ? 'wild' : format === 'pvp' ? 'player' : 'npc';
  const side0: Omit<Side, 'mustSwitch' | 'consumedItems'> = {
    kind: 'player',
    party: p0,
    active: 0,
    trainerId: 'player-a',
    canFlee: format === 'wild',
    canCatch: format === 'wild',
  };
  const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = {
    kind: kind1,
    party: p1,
    active: 0,
    trainerId: kind1 === 'wild' ? null : kind1 === 'player' ? 'player-b' : 'npc-b',
    canFlee: false,
    canCatch: false,
  };
  const driver = rng.fork();
  const battleSeed = rng.int(2147483647);
  const created = createBattle(
    { id: `fuzz-${seed}`, format, zoneId: 'mirevale', terrain: 'grove', seed: battleSeed, sides: [side0, side1] },
    content,
  );
  return { format, state: created.state, createEvents: created.events, driver };
}

/** The actions a fuzz driver submits for one turn. Player sides get a policy choice; NPC/wild sides pass null. */
export function pickActions(state: BattleState, content: ContentIndex, driver: Rng): [Action | null, Action | null] {
  const acts: [Action | null, Action | null] = [null, null];
  const replacement = state.sides[0].mustSwitch || state.sides[1].mustSwitch;
  for (const side of [0, 1] as const) {
    const s = state.sides[side];
    if (s.kind !== 'player') continue;
    if (replacement && !s.mustSwitch) continue;
    let a: Action = chooseNpcAction(state, side, content, driver);
    if (!replacement && side === 0 && state.format === 'wild') {
      // sprinkle catch / item / flee so every action kind reaches resolveTurn; keep only legal ones
      const roll = driver.int(100);
      let alt: Action | null = null;
      if (roll < 12) alt = { kind: 'catch', orb: driver.pick(ORBS) };
      else if (roll < 18) alt = { kind: 'item', item: driver.pick(BATTLE_ITEMS), target: driver.int(s.party.length) };
      else if (roll < 20) alt = { kind: 'flee' };
      if (alt !== null && validateAction(state, side, alt, content) === null) a = alt;
    } else if (!replacement && driver.int(100) < 4) {
      const alt: Action = { kind: 'item', item: driver.pick(BATTLE_ITEMS), target: driver.int(s.party.length) };
      if (validateAction(state, side, alt, content) === null) a = alt;
    }
    acts[side] = a;
  }
  return acts;
}

export interface FuzzBattleRecord {
  readonly seed: number;
  readonly format: BattleFormat;
  readonly turns: number;
  readonly outcome: string;
  /** digestBattleState after createBattle, then after every resolveTurn call. */
  readonly turnDigests: readonly string[];
  readonly actions: readonly (readonly [Action | null, Action | null])[];
  /** fnv1a32 over the joined turn digests, 8 lowercase hex — one line of fuzz-digests.json. */
  readonly digest: string;
  readonly maxHpViolation: string | null;
}

export interface Invariants {
  readonly noNaN: boolean;
  readonly hpInRange: boolean;
  readonly stagesInRange: boolean;
  readonly ppNonNegative: boolean;
}

export function checkInvariants(state: BattleState): Invariants {
  let hpInRange = true;
  let stagesInRange = true;
  let ppNonNegative = true;
  for (const side of state.sides) {
    for (const b of side.party) {
      if (b.creature.hp < 0 || b.creature.hp > b.maxHp) hpInRange = false;
      for (const k of ['atk', 'def', 'spd', 'acc', 'eva'] as const) {
        const s = b.stages[k];
        if (s < -6 || s > 6 || !Number.isInteger(s)) stagesInRange = false;
      }
      for (const m of b.creature.moves) if (m.pp < 0 || !Number.isInteger(m.pp)) ppNonNegative = false;
    }
  }
  return { noNaN: !hasNaN(state), hpInRange, stagesInRange, ppNonNegative };
}

export function hasNaN(value: unknown): boolean {
  if (typeof value === 'number') return Number.isNaN(value) || !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNaN);
  if (value !== null && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasNaN);
  return false;
}

export function digestOf(turnDigests: readonly string[]): string {
  return fnv1a32(turnDigests.join(',')).toString(16).padStart(8, '0');
}

export interface RunOpts {
  readonly seed: number;
  readonly content: ContentIndex;
  readonly maxTurns: number;
  /** Called with every (state, actions) pair before resolveTurn — for legality / purity assertions. */
  readonly onStep?: (state: BattleState, actions: readonly [Action | null, Action | null], result: TurnResult) => void;
}

/** Drives one seeded battle to its end (or maxTurns resolveTurn calls). Throws on an invariant breach. */
export function runBattle(o: RunOpts): FuzzBattleRecord {
  const setup = buildBattle(o.seed, o.content);
  let state = setup.state;
  const turnDigests: string[] = [digestBattleState(state)];
  const actions: (readonly [Action | null, Action | null])[] = [];
  let calls = 0;
  let violation: string | null = null;
  while (state.ended === null && calls < o.maxTurns) {
    const acts = pickActions(state, o.content, setup.driver);
    for (const side of [0, 1] as const) {
      const err = validateAction(state, side, acts[side], o.content);
      if (err !== null) throw new Error(`seed ${o.seed} turn ${state.turn}: side ${side} action ${canonicalJson(acts[side])} invalid: ${err}`);
    }
    const res = resolveTurn(state, acts, o.content);
    if (o.onStep !== undefined) o.onStep(state, acts, res);
    const inv = checkInvariants(res.state);
    if (!inv.noNaN || !inv.hpInRange || !inv.stagesInRange || !inv.ppNonNegative) {
      violation = `seed ${o.seed} turn ${res.state.turn}: ${canonicalJson(inv)}`;
      throw new Error(violation);
    }
    actions.push(acts);
    state = res.state;
    turnDigests.push(digestBattleState(state));
    calls++;
  }
  return {
    seed: o.seed,
    format: setup.format,
    turns: state.turn,
    outcome: state.ended === null ? 'unfinished' : canonicalJson(state.ended),
    turnDigests,
    actions,
    digest: digestOf(turnDigests),
    maxHpViolation: violation,
  };
}

export interface FuzzResult {
  readonly battles: number;
  readonly turns: number;
  readonly digests: readonly string[];
  readonly records: readonly FuzzBattleRecord[];
  readonly unfinished: readonly number[];
}

/** §2.20 `fuzzBattles`: seeds 0..seeds-1, each driven to its end; a battle hitting maxTurns is listed in `unfinished`. */
export function fuzzBattles(opts: {
  readonly seeds: number;
  readonly content: ContentIndex;
  readonly maxTurns: number;
  readonly onStep?: RunOpts['onStep'];
}): FuzzResult {
  const records: FuzzBattleRecord[] = [];
  const unfinished: number[] = [];
  let turns = 0;
  for (let seed = 0; seed < opts.seeds; seed++) {
    const rec = runBattle({ seed, content: opts.content, maxTurns: opts.maxTurns, onStep: opts.onStep });
    records.push(rec);
    turns += rec.actions.length;
    if (rec.outcome === 'unfinished') unfinished.push(seed);
  }
  return { battles: records.length, turns, digests: records.map((r) => r.digest), records, unfinished };
}

/** Replays a recorded battle from createBattle with its recorded actions; returns the per-turn digests. */
export function replay(rec: FuzzBattleRecord, content: ContentIndex, fromTurn = 0, fromState: BattleState | null = null): readonly string[] {
  let state = fromState ?? buildBattle(rec.seed, content).state;
  const out: string[] = fromState === null ? [digestBattleState(state)] : [];
  for (let i = fromTurn; i < rec.actions.length; i++) {
    state = resolveTurn(state, rec.actions[i]!, content).state;
    out.push(digestBattleState(state));
  }
  return out;
}
