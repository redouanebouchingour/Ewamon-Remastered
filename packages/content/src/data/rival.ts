/**
 * A recurring rival (LLM feature 7): one rival per player, a trainer with a stable identity (a name, a look, a
 * temperament and a signature line from the starters, the one strong against the player's own starter) who turns up
 * now and then on a route once the player holds a badge, walks up like a trainer who spotted them, battles them with a
 * team scaled to them and keeps a running record. Its arc follows the record and the badges: cocky early, frustrated
 * once the player is ahead, respectful near the end.
 *
 * Pure: the server draws the identity once (seeded by the world seed and the player, then stored, so a new world seed
 * never renames it), decides when the rival appears and records each meeting; the client shows the same arc and words.
 * Nothing here gates the story or moves a `ZoneDef`.
 */
import { createRng } from '@ewa/core';
import { SPECIES } from './species';

/** The rival never appears before the player holds this many badges. */
export const RIVAL_MIN_BADGES = 1;
/** After a meeting the rival stays away at least this long (real time). */
export const RIVAL_COOLDOWN_MS = 90 * 60_000;
/** The chance that entering a route (with the cooldown over) brings the rival there. */
export const RIVAL_CHANCE = 0.35;
/** Once the rival is on the route, it shows itself after the player has walked this many metres there. */
export const RIVAL_WALK_M: readonly [number, number] = [18, 40];
/** `RIVAL=always` (live checks): the rival shows itself after this many metres, on every route entry. */
export const RIVAL_WALK_ALWAYS_M = 4;
/** Where the rival steps out: this far from the player (m), with a clear line to them. */
export const RIVAL_SPAWN_M = 9;
/** The rival's own last words (written by the client's model or its templates) are at most this long. */
export const RIVAL_WORDS_MAX = 200;
/** Last words are taken only this long after the meeting they close. */
export const RIVAL_WORDS_WINDOW_MS = 15 * 60_000;

export const RIVAL_NAMES: readonly string[] = Object.freeze(['Corin', 'Vesna', 'Tarek', 'Juno', 'Ravi', 'Mika', 'Dax', 'Lyra', 'Orrin', 'Iska', 'Kai', 'Zara', 'Milo', 'Rhea']);
/** Young trainers' looks (render look stems, `LOOKS`). */
export const RIVAL_LOOKS: readonly string[] = Object.freeze(['casual2_female', 'casual2_male', 'casual3_male', 'casual_female', 'casual_male', 'cowboy_female', 'cowboy_male', 'ninja_male']);

export const RIVAL_TEMPERAMENTS = ['brash', 'cool', 'showy', 'grim', 'cheerful', 'proud'] as const;
export type RivalTemperament = (typeof RIVAL_TEMPERAMENTS)[number];
/** How a temperament is described to the model (and the profile). */
export const RIVAL_TEMPERAMENT_TEXT: Readonly<Record<RivalTemperament, string>> = Object.freeze({
  brash: 'loud and brash',
  cool: 'cool and dry',
  showy: 'a showoff who loves an audience',
  grim: 'serious and blunt',
  cheerful: 'cheerful and teasing',
  proud: 'proud and formal',
});

export const RIVAL_ARCS = ['cocky', 'frustrated', 'respectful'] as const;
/** cocky early, frustrated once the player is ahead in the record, respectful near the end */
export type RivalArc = (typeof RIVAL_ARCS)[number];
/** From this many badges on, the rival respects the player whatever the record. */
export const RIVAL_RESPECT_BADGES = 6;

/** The three starters, and the one a rival picks against each (its type is strong against the player's). */
export const RIVAL_COUNTER: Readonly<Record<string, string>> = Object.freeze({ bramblecub: 'cindercap', glimfin: 'bramblecub', cindercap: 'glimfin' });
const STARTERS: readonly string[] = Object.freeze(['bramblecub', 'glimfin', 'cindercap']);

export interface RivalIdentity {
  readonly name: string;
  readonly look: string;
  readonly temperament: RivalTemperament;
  /** the root of its signature line (a starter) */
  readonly signature: string;
}

export interface RivalRecord {
  /** meetings the player won */
  readonly playerWins: number;
  /** meetings the rival won */
  readonly rivalWins: number;
}

/**
 * The rival's identity, from `seed` (the server passes `${worldSeed}:${playerId}:rival`). Its signature line is the
 * starter strong against `playerStarter` (the player's first starter-line creature), else one drawn from the seed.
 */
export function rivalIdentity(seed: string, playerStarter: string | null): RivalIdentity {
  const rng = createRng(seed);
  const name = RIVAL_NAMES[rng.int(RIVAL_NAMES.length)]!;
  const look = RIVAL_LOOKS[rng.int(RIVAL_LOOKS.length)]!;
  const temperament = RIVAL_TEMPERAMENTS[rng.int(RIVAL_TEMPERAMENTS.length)]!;
  const drawn = STARTERS[rng.int(STARTERS.length)]!;
  const signature = playerStarter !== null && RIVAL_COUNTER[playerStarter] !== undefined ? RIVAL_COUNTER[playerStarter]! : drawn;
  return { name, look, temperament, signature };
}

/** Where the rival is in its arc, from the player's badges and the record. */
export function rivalArc(badges: number, r: RivalRecord): RivalArc {
  if (badges >= RIVAL_RESPECT_BADGES || (badges >= 4 && r.playerWins >= 3)) return 'respectful';
  if (r.playerWins > r.rivalWins) return 'frustrated';
  return 'cocky';
}

/** How far the signature line has evolved: one stage at 3 badges, the last at 6. */
export function signatureStage(badges: number): 0 | 1 | 2 {
  return badges >= 6 ? 2 : badges >= 3 ? 1 : 0;
}

const byId = new Map(SPECIES.map((s) => [s.id, s]));

/** The signature line's species at the player's badges (its evolutions in order, as far as the stage reaches). */
export function signatureSpecies(root: string, badges: number): string {
  let id = root;
  for (let i = 0; i < signatureStage(badges); i++) {
    const ev = byId.get(id)?.evolution ?? null;
    if (ev === null || !('into' in ev)) break;
    id = ev.into;
  }
  return id;
}

/** How many creatures the rival brings: 2 at the first badge, one more every two badges, at most 6. */
export function rivalTeamSize(badges: number): number {
  return Math.max(2, Math.min(6, 1 + Math.ceil(badges / 2)));
}

/**
 * How many levels above the player's strongest the rival's signature creature stands: 2 when the rival is ahead in
 * the record, 1 when it is even, 0 when the player is ahead (its other creatures are 1 to 3 below that).
 */
export function rivalLevelLead(r: RivalRecord): number {
  return r.rivalWins > r.playerWins ? 2 : r.rivalWins === r.playerWins ? 1 : 0;
}

/** The money a win over the rival pays: like a route trainer of its level. */
export function rivalReward(level: number): number {
  return Math.max(200, Math.round(level) * 50);
}

const PREFIX = 'rival:';

/** The rival's battle trainer id (its name; one rival per player, so the name says enough on a history row). */
export function rivalTrainerId(name: string): string {
  return `${PREFIX}${name}`;
}

export function isRivalTrainer(trainerId: string | null | undefined): boolean {
  return typeof trainerId === 'string' && trainerId.startsWith(PREFIX);
}

/** The rival's name behind its trainer id (null for any other trainer). */
export function rivalNameOf(trainerId: string): string | null {
  return isRivalTrainer(trainerId) ? trainerId.slice(PREFIX.length) : null;
}
