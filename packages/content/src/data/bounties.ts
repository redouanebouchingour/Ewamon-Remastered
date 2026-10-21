/**
 * The bounty board: wanted posters in every town's Healer hall (the interiors layer: a Marshal by a board, never a
 * `ZoneDef` change). Three kinds of poster:
 *
 * - **Game bounties** on ghost trainers (ghosts.ts) that keep beating people: every `BOUNTY_PERIOD_MS` the board posts
 *   one on each ghost that beat at least `GAME_BOUNTY_MIN_WINS` different trainers since its last bounty was claimed
 *   (within the ghost's `GHOST_DAYS`), worth `gameBountyReward(wins)` (125 a head, at most 5,000: "beaten 40 people,
 *   5,000 bounty"). Paid by the board. Open to everyone; it stays up until claimed or the ghost fades.
 * - **Player bounties** on a ghost: a trainer pays the reward plus the board's cut (`bountyFee`, a quarter) into escrow.
 *   Only a party holding a Badlander-line creature may post (the outlaws know where the ghosts walk). Never on your own
 *   ghost; at most `BOUNTY_OPEN_MAX` open posts at a time and one per ghost; `PLAYER_BOUNTY_MIN`..`PLAYER_BOUNTY_MAX`.
 *   It expires after `BOUNTY_POST_HOURS` (or when the ghost fades, if sooner) and the whole escrow goes back.
 * - **Nemesis bounties** (nemesis.ts): a nemesis is one trainer's alone, so its poster is personal: only its trainer
 *   sees it ("Wanted by you"), from rank `NEMESIS_BOUNTY_MIN_RANK`, worth `nemesisBounty(rank)`, paid by the board when
 *   they knock it out or catch it.
 *
 * Claiming: beating the target in the normal fight (a ghost in the tall grass, a nemesis ambush) claims every open
 * bounty on it the claimer may take, once each: never your own post, at most `BOUNTY_CLAIMS_PER_DAY` claims a day
 * (the rest stay up for someone else). A party holding a Lawlander-line creature takes `lawlanderBonus` more (+25%):
 * on a player bounty that is exactly the board's cut, so no money is made by passing a bounty between friends; without
 * a Lawlander the cut is the board's. The claim nudges the party lead's honor up by `BOUNTY_HONOR` (honor.ts bounds;
 * only a species that keeps the ledger, never in the tower) and writes "Brought in <target>" in its history. Posting
 * one is honor-neutral.
 *
 * Pure: the server keeps the posters and decides, the client shows the same words.
 */
import type { InteriorDef, InteriorNpc, InteriorProp } from '../types';

/** Game bounties are posted on this schedule (UTC, from the epoch): 00:00, 06:00, 12:00, 18:00. */
export const BOUNTY_PERIOD_MS = 6 * 3_600_000;
/** A ghost needs this many different trainers beaten (since its last bounty was claimed) to be posted by the board. */
export const GAME_BOUNTY_MIN_WINS = 5;
export const GAME_BOUNTY_PER_WIN = 125;
export const GAME_BOUNTY_MAX = 5_000;
/** What a trainer may put on a ghost. */
export const PLAYER_BOUNTY_MIN = 500;
export const PLAYER_BOUNTY_MAX = 10_000;
/** A player's post stays up this long (less when the ghost fades first). */
export const BOUNTY_POST_HOURS = 72;
/** Open posts per trainer at a time. */
export const BOUNTY_OPEN_MAX = 3;
/** Claims per trainer in any 24 hours (every kind together); beyond it a bounty stays up for someone else. */
export const BOUNTY_CLAIMS_PER_DAY = 3;
/** The board's cut on a player's post and the Lawlander bonus on any claim: a quarter of the reward. */
export const BOUNTY_CUT = 0.25;
/** A nemesis gets a poster from this rank (it beat or escaped its trainer at least twice). */
export const NEMESIS_BOUNTY_MIN_RANK = 2;
export const NEMESIS_BOUNTY_PER_RANK = 400;
/**
 * A wanted ghost steps out of its zone's tall grass more often than other ghosts (ghosts.ts `GHOST_CHANCE` 1/10): this
 * share of the encounters there, before the ordinary ghost roll.
 */
export const WANTED_GHOST_CHANCE = 1 / 4;
/** The honor a claim gives the party lead (only a species that keeps the ledger). */
export const BOUNTY_HONOR = 1;

/** The lines whose holder may post (Badlander) and whose holder takes the bonus (Lawlander): dustcub's two branches. */
export const BADLANDER_LINE: readonly string[] = Object.freeze(['badlander']);
export const LAWLANDER_LINE: readonly string[] = Object.freeze(['lawlander']);

export type BountyKind = 'game' | 'player' | 'nemesis';

/** True when a party (its species ids, fainted ones too: the creature is held, not fighting) holds one of `line`. */
export function holdsLine(partySpecies: readonly string[], line: readonly string[]): boolean {
  return partySpecies.some((s) => line.includes(s));
}

/** A game bounty on a ghost that beat `wins` different trainers (0 below the minimum). */
export function gameBountyReward(wins: number): number {
  if (wins < GAME_BOUNTY_MIN_WINS) return 0;
  return Math.min(GAME_BOUNTY_MAX, Math.floor(wins) * GAME_BOUNTY_PER_WIN);
}

/** The board's cut on a player's post, held in escrow with the reward. */
export function bountyFee(reward: number): number {
  return Math.ceil(reward * BOUNTY_CUT);
}

/** What a Lawlander party takes on top of `reward` (on a player's post: exactly the escrowed cut). */
export function lawlanderBonus(reward: number): number {
  return bountyFee(reward);
}

/** The payout of one claim. */
export function bountyPayout(reward: number, lawlander: boolean): number {
  return reward + (lawlander ? lawlanderBonus(reward) : 0);
}

/** A nemesis's bounty by its rank (0 below `NEMESIS_BOUNTY_MIN_RANK`). */
export function nemesisBounty(rank: number): number {
  return rank < NEMESIS_BOUNTY_MIN_RANK ? 0 : Math.floor(rank) * NEMESIS_BOUNTY_PER_RANK;
}

/** The posting period `nowMs` falls in: game bounties go up at `startsAt`, the next ones at `endsAt`. */
export function bountyPeriod(nowMs: number): { readonly index: number; readonly startsAt: number; readonly endsAt: number } {
  const index = Math.floor(nowMs / BOUNTY_PERIOD_MS);
  return { index, startsAt: index * BOUNTY_PERIOD_MS, endsAt: (index + 1) * BOUNTY_PERIOD_MS };
}

/** When a player's post comes down: `BOUNTY_POST_HOURS` from now, or when the ghost fades if that is sooner. */
export function postExpiry(nowMs: number, ghostFadesAt: number): number {
  return Math.min(nowMs + BOUNTY_POST_HOURS * 3_600_000, ghostFadesAt);
}

export type BountyRefusal = 'noBadlander' | 'ownGhost' | 'noGhost' | 'tooLow' | 'tooHigh' | 'tooMany' | 'alreadyPosted' | 'notAtBoard';

/** Why a trainer cannot post this bounty (null: they can). The money is checked when it is taken. */
export function postRefusal(p: {
  readonly partySpecies: readonly string[];
  readonly reward: number;
  readonly ownGhost: boolean;
  readonly ghostAlive: boolean;
  readonly openPosts: number;
  readonly postedOnTarget: boolean;
}): BountyRefusal | null {
  if (!holdsLine(p.partySpecies, BADLANDER_LINE)) return 'noBadlander';
  if (p.ownGhost) return 'ownGhost';
  if (!p.ghostAlive) return 'noGhost';
  if (!Number.isInteger(p.reward) || p.reward < PLAYER_BOUNTY_MIN) return 'tooLow';
  if (p.reward > PLAYER_BOUNTY_MAX) return 'tooHigh';
  if (p.postedOnTarget) return 'alreadyPosted';
  if (p.openPosts >= BOUNTY_OPEN_MAX) return 'tooMany';
  return null;
}

/** What the Marshal says about a refused post. */
export const BOUNTY_REFUSAL_TEXT: Readonly<Record<BountyRefusal, string>> = Object.freeze({
  noBadlander: 'Only a trainer running with a Badlander can post a bounty. The outlaws know where the ghosts walk.',
  ownGhost: 'A bounty on your own ghost? The board will not take it.',
  noGhost: 'That ghost has faded. There is nobody to bring in.',
  tooLow: `The board takes nothing under ${PLAYER_BOUNTY_MIN.toLocaleString('en-US')}.`,
  tooHigh: `The board takes nothing over ${PLAYER_BOUNTY_MAX.toLocaleString('en-US')}.`,
  tooMany: `You have ${BOUNTY_OPEN_MAX} posters up already. Wait for one to come down.`,
  alreadyPosted: 'You already have a poster up on that ghost.',
  notAtBoard: 'Post it at a bounty board, in any town Healer.',
});

// ─── the board (interiors layer) ─────────────────────────────────────────────

/**
 * Where each town keeps its board: the Healer hall, else the Mart (Stormrook, Marrowdig), else (Skyrend, which has
 * neither) its first house, which becomes the Marshal's Office. A content test checks every town has exactly one.
 */
export const BOUNTY_OFFICES: Readonly<Record<string, string>> = Object.freeze({
  mirevale: 'mirevale.healer',
  cinderhold: 'cinderhold.healer',
  saltmourn: 'saltmourn.healer',
  stormrook: 'stormrook.shop',
  marrowdig: 'marrowdig.shop',
  vesperveil: 'vesperveil.healer',
  forgewall: 'forgewall.healer',
  skyrend: 'skyrend.house0',
  solenne: 'solenne.healer',
});

/** In a Healer or Mart hall: the Marshal right of the counter and the board on the right wall behind him. */
export const BOUNTY_MARSHAL_AT = Object.freeze({ lx: 3.6, lz: -1.8 });
export const BOUNTY_BOARD_AT = Object.freeze({ lx: 4.45, lz: -2.7, yaw: -Math.PI / 2 });

/** The Marshal's npc id in the hall `building`. */
export function bountyMarshalId(building: string): string {
  return `${building}.marshal`;
}

/** The Marshal's lines (the interior NPC's dialogue before the Wanted board opens). */
export const BOUNTY_MARSHAL_LINES: readonly string[] = Object.freeze([
  "Marshal's office. Every ghost on that board has been beating honest trainers.",
  'Bring one in and the bounty is yours. Run with a Lawlander and the board pays a quarter more.',
]);

/** A house's back wall between the bed and the bookshelf (Skyrend's office). */
function houseBoard(def: InteriorDef): InteriorProp {
  const bed = def.props.find((q) => q.kind === 'bed');
  const shelf = def.props.find((q) => q.kind === 'bookshelf');
  const a = bed === undefined ? 0 : bed.lx - Math.sign(bed.lx) * 0.9;
  const b = shelf === undefined ? 0 : shelf.lx - Math.sign(shelf.lx) * 1.2;
  return { kind: 'banner', lx: Math.round(((a + b) / 2) * 100) / 100, lz: -def.d / 2 + 0.25, yaw: 0, scale: 0.8 };
}

/**
 * The interiors layer: the town's office hall (`BOUNTY_OFFICES`) gets the Marshal and the board, the hall, its walls
 * and its footprint unchanged. In a counter hall he stands beside the counter; in a house he is its resident.
 */
export function withBountyBoard(def: InteriorDef): InteriorDef {
  if (BOUNTY_OFFICES[def.zoneId] !== def.id) return def;
  const marshal = (at: { readonly lx: number; readonly lz: number }, facing: number): InteriorNpc => ({
    id: bountyMarshalId(def.id),
    name: 'Marshal',
    lx: at.lx,
    lz: at.lz,
    facing,
    look: 'cowboy_male',
    role: 'bounty',
    lines: BOUNTY_MARSHAL_LINES,
  });
  if (def.template === 'healer' || def.template === 'shop') {
    const board: InteriorProp = { kind: 'banner', lx: BOUNTY_BOARD_AT.lx, lz: BOUNTY_BOARD_AT.lz, yaw: BOUNTY_BOARD_AT.yaw, scale: 0.8 };
    return { ...def, npcs: [...def.npcs, marshal(BOUNTY_MARSHAL_AT, 0)], props: [...def.props, board] };
  }
  const resident = def.npcs.find((n) => n.role === 'resident');
  if (resident === undefined) return def;
  return {
    ...def,
    label: "the Marshal's Office",
    npcs: def.npcs.map((n) => (n === resident ? marshal(n, n.facing) : n)),
    props: [...def.props, houseBoard(def)],
  };
}

/** The zone a board stands in, for the server's "post at a board" check: every town has one (`BOUNTY_OFFICES`). */
export function hasBountyBoard(zone: { readonly id: string }): boolean {
  return BOUNTY_OFFICES[zone.id] !== undefined;
}
