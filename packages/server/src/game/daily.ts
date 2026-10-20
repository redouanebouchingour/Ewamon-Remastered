/**
 * The daily challenge (protocol arena.ts `DailyRes`): one puzzle a UTC day, the same for everyone. Both teams come from
 * the day alone (`dailyPuzzle`: three distinct species each from the tower's third pool, level `DAILY_LEVEL`, a seeded
 * ability, their level-up moves; the first seeded pairing that core's trainer AI, playing the player's side, can win,
 * so every daily is winnable and has a `par`), and the battle runs on the day's own seed (`dailySeed`), so the same choices always
 * play out the same for every player. Pure over (dayKey, content).
 */
import { ARENA_DAILY, TOWER } from '@ewa/content';
import { chooseNpcAction, createBattle, createRng, projectBattler, resolveTurn } from '@ewa/core';
import type { BattleEvent, BattleState, ContentIndex, CreateBattleOpts, CreatureInstance } from '@ewa/core';
import { ARENA_LEVEL, DAILY_FIRST_DAY, DAILY_TEAM_SIZE } from '@ewa/protocol';
import { newCreature, withSyntheticId } from './creatures';

/** The daily's teams fight at the arena level (protocol `arenaLevel('daily')`, which the arena strip shows). */
export const DAILY_LEVEL = ARENA_LEVEL;
/** The AI side of every daily (content `ARENA_DAILY`: the client names and dresses it from there). */
export const DAILY_TRAINER = { id: ARENA_DAILY.trainerId, name: ARENA_DAILY.name } as const;

const DAY_MS = 86_400_000;

/** #1 on `DAILY_FIRST_DAY`, counting UTC days. */
export function dailyNumber(dayKey: string): number {
  return Math.round((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${DAILY_FIRST_DAY}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The ISO time the day after `dayKey` starts. */
export function dailyEndsAt(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + DAY_MS).toISOString();
}

/** The battle seed of the day (createBattle `seed`): every player's daily runs on the same rng. */
export function dailySeed(dayKey: string): string {
  return `daily:${dayKey}`;
}

/** One candidate pairing of the day: the player's team (`daily:me:<i>`) and the AI's (`daily:foe:<i>`), disjoint species. */
function teamsFor(seed: string, content: ContentIndex): { readonly team: CreatureInstance[]; readonly foe: CreatureInstance[] } {
  const rng = createRng(seed);
  const pool = rng.shuffle(TOWER.pools[2]!);
  const make = (i: number, tag: string): CreatureInstance => {
    const sp = content.species(pool[i]!);
    const ability = sp.abilities[rng.int(sp.abilities.length)]!;
    return withSyntheticId(newCreature(content, sp.id, DAILY_LEVEL, { ability }), `daily:${tag}:${i % DAILY_TEAM_SIZE}`);
  };
  const team: CreatureInstance[] = [];
  const foe: CreatureInstance[] = [];
  for (let i = 0; i < DAILY_TEAM_SIZE; i++) team.push(make(i, 'me'));
  for (let i = DAILY_TEAM_SIZE; i < DAILY_TEAM_SIZE * 2; i++) foe.push(make(i, 'foe'));
  return { team, foe };
}

/** The daily battle's sides as the server opens them (the trainer id of the player side is the player's). */
export function dailySides(team: readonly CreatureInstance[], foe: readonly CreatureInstance[], playerId: string, content: ContentIndex): CreateBattleOpts['sides'] {
  return [
    { kind: 'player', party: team.map((c) => projectBattler(c, content)), active: 0, trainerId: playerId, canFlee: false, canCatch: false },
    { kind: 'npc', party: foe.map((c) => projectBattler(c, content)), active: 0, trainerId: DAILY_TRAINER.id, canFlee: false, canCatch: false },
  ];
}

/**
 * The turns a reference player needs to win a pairing on the day's seed, or null when it loses: the player side is
 * played by core's own trainer AI (`chooseNpcAction`, on its own rng), the AI side as in the real battle (null, the
 * battle's rng). So a winning line exists, and copying the reference's choices reaches `par` exactly.
 */
function referencePar(team: readonly CreatureInstance[], foe: readonly CreatureInstance[], dayKey: string, content: ContentIndex): number | null {
  const pick = createRng(`daily:${dayKey}:reference`);
  let st = createBattle({ id: 'daily', format: 'trainer', zoneId: 'mirevale', terrain: 'none', seed: createRng(dailySeed(dayKey)).snapshot(), sides: dailySides(team, foe, 'reference', content) }, content).state;
  for (let i = 0; i < 200 && st.ended === null; i++) {
    const mine = st.sides[0].mustSwitch || !st.sides[1].mustSwitch ? chooseNpcAction(st, 0, content, pick) : null;
    st = resolveTurn(st, [mine, null], content).state;
  }
  return st.ended !== null && st.ended.winner === 0 ? st.turn : null;
}

export interface DailyPuzzle {
  readonly team: CreatureInstance[];
  readonly foe: CreatureInstance[];
  /** the reference win's turn count (null only if no candidate of the day could be won, which the tests rule out) */
  readonly par: number | null;
}

/** How many candidate pairings a day tries before it gives up on a winnable one. */
const DAILY_CANDIDATES = 40;
const cache = new Map<string, DailyPuzzle>();

/** The day's puzzle: the first candidate pairing (seeded by the day) that the reference player can win. */
export function dailyPuzzle(dayKey: string, content: ContentIndex): DailyPuzzle {
  const hit = cache.get(dayKey);
  if (hit !== undefined) return hit;
  let found: DailyPuzzle | null = null;
  for (let k = 0; k < DAILY_CANDIDATES && found === null; k++) {
    const t = teamsFor(`daily:${dayKey}:teams:${k}`, content);
    const par = referencePar(t.team, t.foe, dayKey, content);
    if (par !== null) found = { ...t, par };
  }
  const puzzle = found ?? { ...teamsFor(`daily:${dayKey}:teams:0`, content), par: null };
  if (cache.size > 8) cache.clear();
  cache.set(dayKey, puzzle);
  return puzzle;
}

/**
 * The spoiler-free strip of a daily: one mark per turn from `seat`'s side: `K` a foe fainted, `L` one of yours did,
 * `X` both, `.` neither. A replacement step (no new turn) adds its faints to the turn before it.
 */
export function dailyMarks(steps: readonly { readonly state: BattleState; readonly events: readonly BattleEvent[] }[], seat: 0 | 1, startTurn = 0): string {
  const marks: { k: boolean; l: boolean }[] = [];
  let turn = startTurn;
  for (const s of steps) {
    if (s.state.turn > turn || marks.length === 0) marks.push({ k: false, l: false });
    turn = s.state.turn;
    const m = marks[marks.length - 1]!;
    for (const e of s.events) {
      if (e.t !== 'faint') continue;
      if (e.who.side === seat) m.l = true;
      else m.k = true;
    }
  }
  return marks.map((m) => (m.k && m.l ? 'X' : m.k ? 'K' : m.l ? 'L' : '.')).join('');
}
