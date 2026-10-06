/**
 * Phase D6 — the doubles fuzz driver (test/doubles.test.ts). Same construction discipline as test/fuzz.ts (pure over
 * (seed, content)): per seed a random format among trainer / league / pvp, two random 2..6-creature parties (the
 * first two standing), `slots: 2`. Player sides are driven by chooseNpcDoubles over a forked rng with sprinkled
 * explicit targets (foe or ally), voluntary switches and items, so every doubles path reaches resolveTurn; NPC sides
 * pass null. A curated spread list is laid over the legacy fixture (`withSpread`), so spread moves occur.
 */
import type { Action, BattleFormat, BattleState, ContentIndex, FieldRef, MoveDef, Rng, Side, SideChoice } from '../src/index';
import {
  canonicalJson,
  chooseNpcDoubles,
  createBattle,
  createRng,
  digestBattleState,
  projectBattler,
  requiredPositions,
  resolveTurn,
  validateSideChoice,
} from '../src/index';
import { HELD_CANDIDATES, checkInvariants, digestOf, heldItemIds, randomCreature } from './fuzz';

export const DOUBLES_FORMATS: readonly BattleFormat[] = ['trainer', 'league', 'pvp'];
const BATTLE_ITEMS: readonly string[] = ['potion', 'superpotion', 'hyper_potion', 'full_restore', 'revive', 'full_heal'];

/** The spread reach the fuzz lays over the legacy fixture (a mirror of content's curated list, by legacy move id). */
export const FUZZ_SPREAD: Readonly<Record<string, 'foes' | 'all'>> = {
  'Rock Slide': 'foes',
  'Heat Wave': 'foes',
  Blizzard: 'foes',
  'Dazzling Gleam': 'foes',
  Snarl: 'foes',
  Twister: 'foes',
  'Powder Snow': 'foes',
  Growl: 'foes',
  'String Shot': 'foes',
  Earthquake: 'all',
  Discharge: 'all',
  Bulldoze: 'all',
  'Petal Blizzard': 'all',
};

/** A ContentIndex whose moves carry `spread` per `table` (every other lookup delegates). */
export function withSpread(content: ContentIndex, table: Readonly<Record<string, 'foes' | 'all'>> = FUZZ_SPREAD): ContentIndex {
  const cache = new Map<string, MoveDef>();
  return {
    species: (id) => content.species(id),
    move: (id) => {
      const hit = cache.get(id);
      if (hit !== undefined) return hit;
      const m = content.move(id);
      const s = table[id];
      const out: MoveDef = s === undefined ? m : { ...m, spread: s };
      cache.set(id, out);
      return out;
    },
    ability: (id) => content.ability(id),
    item: (id) => content.item(id),
    orb: (id) => content.orb(id),
    typeChart: content.typeChart,
    allSpecies: () => content.allSpecies(),
  };
}

export interface DoublesSetup {
  readonly format: BattleFormat;
  readonly state: BattleState;
  readonly driver: Rng;
}

export function buildDoubles(seed: number, content: ContentIndex): DoublesSetup {
  const rng = createRng(`doubles:${seed}`);
  const all = content.allSpecies();
  const held = heldItemIds(content, HELD_CANDIDATES);
  const format = rng.pick(DOUBLES_FORMATS);
  const party = (tag: string) => {
    const n = 2 + rng.int(5);
    const out = [];
    for (let i = 0; i < n; i++) out.push(projectBattler(randomCreature(rng, rng.pick(all), held, content, `${tag}${i}`), content));
    for (let i = 0; i < 2; i++) if (out[i]!.creature.hp <= 0) out[i] = { ...out[i]!, creature: { ...out[i]!.creature, hp: 1 } };
    return out;
  };
  const p0 = party('a');
  const p1 = party('b');
  const kind1: Side['kind'] = format === 'pvp' ? 'player' : 'npc';
  const driver = rng.fork();
  const created = createBattle(
    {
      id: `dfuzz-${seed}`,
      format,
      zoneId: 'mirevale',
      terrain: 'grove',
      seed: rng.int(2147483647),
      slots: 2,
      sides: [
        { kind: 'player', party: p0, active: 0, trainerId: 'player-a', canFlee: false, canCatch: false },
        { kind: kind1, party: p1, active: 0, trainerId: kind1 === 'player' ? 'player-b' : 'npc-b', canFlee: false, canCatch: false },
      ],
    },
    content,
  );
  return { format, state: created.state, driver };
}

/** One side's choice for a player side: the doubles policy, then sprinkled alternatives that keep it legal. */
export function pickDoubles(state: BattleState, side: 0 | 1, content: ContentIndex, driver: Rng): SideChoice {
  const base = chooseNpcDoubles(state, side, content, driver);
  const replacement = state.sides[0].mustSwitch || state.sides[1].mustSwitch;
  if (replacement) return base;
  const out: [Action | null, Action | null] = [base[0], base[1]];
  for (const p of requiredPositions(state, side)) {
    const a = out[p];
    const roll = driver.int(100);
    let alt: Action | null = null;
    if (a !== null && a.kind === 'move' && roll < 25) {
      const t: FieldRef = { side: driver.int(2) as 0 | 1, pos: driver.int(2) as 0 | 1 };
      alt = { kind: 'move', move: a.move, target: t };
    } else if (roll < 31) {
      alt = { kind: 'switch', to: driver.int(state.sides[side].party.length) };
    } else if (roll < 34) {
      alt = { kind: 'item', item: driver.pick(BATTLE_ITEMS), target: driver.int(state.sides[side].party.length) };
    } else if (roll === 34) {
      alt = { kind: 'forfeit' };
    }
    if (alt === null) continue;
    const trial: [Action | null, Action | null] = [out[0], out[1]];
    trial[p] = alt;
    if (validateSideChoice(state, side, trial, content) === null) out[p] = alt;
  }
  return out;
}

export interface DoublesRecord {
  readonly seed: number;
  readonly format: BattleFormat;
  readonly turns: number;
  readonly outcome: string;
  readonly turnDigests: readonly string[];
  readonly actions: readonly (readonly [SideChoice, SideChoice])[];
  readonly digest: string;
}

export function runDoubles(seed: number, content: ContentIndex, maxTurns: number): DoublesRecord {
  const setup = buildDoubles(seed, content);
  let state = setup.state;
  const turnDigests: string[] = [digestBattleState(state)];
  const actions: (readonly [SideChoice, SideChoice])[] = [];
  let calls = 0;
  while (state.ended === null && calls < maxTurns) {
    const acts: [SideChoice, SideChoice] = [null, null];
    for (const side of [0, 1] as const) {
      if (state.sides[side].kind !== 'player') continue;
      if (requiredPositions(state, side).length === 0) continue;
      acts[side] = pickDoubles(state, side, content, setup.driver);
      const err = validateSideChoice(state, side, acts[side], content);
      if (err !== null) throw new Error(`doubles seed ${seed} turn ${state.turn}: side ${side} ${canonicalJson(acts[side])} invalid: ${canonicalJson(err)}`);
    }
    const res = resolveTurn(state, acts, content);
    const inv = checkInvariants(res.state);
    if (!inv.noNaN || !inv.hpInRange || !inv.stagesInRange || !inv.ppNonNegative) throw new Error(`doubles seed ${seed} turn ${res.state.turn}: ${canonicalJson(inv)}`);
    actions.push(acts);
    state = res.state;
    turnDigests.push(digestBattleState(state));
    calls++;
  }
  return {
    seed,
    format: setup.format,
    turns: state.turn,
    outcome: state.ended === null ? 'unfinished' : canonicalJson(state.ended),
    turnDigests,
    actions,
    digest: digestOf(turnDigests),
  };
}
