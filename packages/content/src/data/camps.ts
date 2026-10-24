/**
 * Camp bases (SPEC §3.19): every route's travellers' camp (the zone sculpts' tent and campfire) can be claimed by one
 * trainer, decorated with trophies they earned elsewhere, and is guarded while they are away by a snapshot of their
 * party fighting as an AI trainer (the ghosts' path: healed copies, nothing of the owner's is written).
 *
 * - **Claiming**: one camp per trainer, one owner per camp. A free camp is claimed at its campfire; a held camp is
 *   raided. A raider who beats the guard of a camp whose owner has been away `CAMP_INACTIVE_DAYS` or more takes the
 *   camp over (when they hold none). The owner may rename it (a banner of at most `CAMP_NAME_MAX` characters, filtered
 *   like chat) and abandon it.
 * - **Trophies**: up to `CAMP_TROPHY_SLOTS` of the owner's own: a nemesis scar (a nemesis they beat or caught), a
 *   legendary caught, a medal (the Champion's, or a ranked tier from Silver up), an achievement, a bounty brought in.
 *   Drawn round the campfire with the zone's own props (`campSlots`), seen by everyone in the zone.
 * - **Raids**: walking up to someone else's camp while its owner is offline and challenging the guard. A win takes
 *   `campRaidCut` of the owner's money (2 %, at most `CAMP_RAID_CAP`), once per raider and camp in any 24 hours, paid
 *   in the battle's own transaction with an audit row; the raider's party lead loses `CAMP_RAID_HONOR` honor (a species
 *   that keeps the ledger) and the raid is a dark deed in the zone's world honor (`CAMP_RAID_SHADOW`). A loss takes
 *   nothing. The owner reads the camp log when they come back.
 * - **Factions**: a guard that holds earns its owner's side `CAMP_HELD_POINTS`, at most `CAMP_HELD_PER_DAY` a day.
 * - Never during a Nuzlocke or Hardcore run (neither claiming nor raiding, and an owner on a run is not raided), never
 *   in the tower or the arena (camps stand on routes only). Nothing here gates the story or moves a `ZoneDef`.
 *
 * Pure: the server keeps the camps and decides, the client shows the same words and draws the same slots.
 */
import { DIG_SPOTS } from './fieldPowers';
import { SCULPTS } from './sculpts';
import type { ZoneId } from '../types';

/** Trophy slots round a camp's fire. */
export const CAMP_TROPHY_SLOTS = 3;
/** The banner name's length. */
export const CAMP_NAME_MAX = 24;
/** The server's reach to a camp (m from its campfire); the client prompts from a little closer. */
export const CAMP_RANGE_M = 5;
export const CAMP_PROMPT_M = 4;
/** A raid's cut of the owner's money, and its cap. */
export const CAMP_RAID_SHARE = 0.02;
export const CAMP_RAID_CAP = 1_000;
/** A raider takes a cut from the same camp at most once in this window (after a win). */
export const CAMP_RAID_COOLDOWN_MS = 86_400_000;
/** An owner away this long loses the camp to a raider who beats its guard (and holds none). */
export const CAMP_INACTIVE_DAYS = 14;
/** A guard whose best creature is more than this many levels below the raider's lead is not worth a raid. */
export const CAMP_LEVEL_SPAN = 12;
/** The raider's lead's honor on a won raid (a species that keeps the ledger). */
export const CAMP_RAID_HONOR = -1;
/** Shadow points a won raid adds to the zone's season tally (worldHonor.ts). */
export const CAMP_RAID_SHADOW = 3;
/** Faction points a guard that holds earns its owner's side, and how many such points a day. */
export const CAMP_HELD_POINTS = 1;
export const CAMP_HELD_PER_DAY = 3;

export const TROPHY_KINDS = ['scar', 'legend', 'medal', 'achievement', 'bounty'] as const;
export type TrophyKind = (typeof TROPHY_KINDS)[number];

export const TROPHY_KIND_LABEL: Readonly<Record<TrophyKind, string>> = Object.freeze({
  scar: 'Nemesis scar',
  legend: 'Legendary catch',
  medal: 'Medal',
  achievement: 'Achievement',
  bounty: 'Bounty brought in',
});

/** A trophy as stored on a camp and shown: `id` is `<kind>:<ref>` (unique per owner). */
export interface Trophy {
  readonly id: string;
  readonly kind: TrophyKind;
  readonly label: string;
}

export function trophyId(kind: TrophyKind, ref: string): string {
  return `${kind}:${ref}`;
}

/** The kind of a trophy id, or null for anything else. */
export function trophyKindOf(id: string): TrophyKind | null {
  const k = id.slice(0, id.indexOf(':'));
  return (TROPHY_KINDS as readonly string[]).includes(k) ? (k as TrophyKind) : null;
}

/** What a raid takes from an owner holding `money` (2 %, at most the cap; nothing from an empty purse). */
export function campRaidCut(money: number): number {
  if (!Number.isFinite(money) || money <= 0) return 0;
  return Math.min(CAMP_RAID_CAP, Math.floor(money * CAMP_RAID_SHARE));
}

/** The banner a fresh camp flies. */
export function defaultCampName(owner: string): string {
  return `${owner}'s camp`.slice(0, CAMP_NAME_MAX);
}

/** Whether an owner last seen at `lastSeenMs` has been away long enough to lose the camp to a raider. */
export function campInactive(lastSeenMs: number | null, nowMs: number): boolean {
  return lastSeenMs !== null && nowMs - lastSeenMs >= CAMP_INACTIVE_DAYS * 86_400_000;
}

// ─── the guard ───────────────────────────────────────────────────────────────

const GUARD_PREFIX = 'campguard:';

/** The trainer id a camp's guard fights under (its owner's username: public, unique). */
export function campGuardTrainerId(owner: string): string {
  return `${GUARD_PREFIX}${owner}`;
}

/** The owner behind a camp guard's trainer id (null for any other trainer). */
export function campGuardOwner(trainerId: string): string | null {
  return trainerId.startsWith(GUARD_PREFIX) ? trainerId.slice(GUARD_PREFIX.length) : null;
}

// ─── refusals ────────────────────────────────────────────────────────────────

export type CampRefusal =
  | 'campsOff'
  | 'noCampHere'
  | 'campFar'
  | 'campTaken'
  | 'haveCamp'
  | 'noCamp'
  | 'inRun'
  | 'noParty'
  | 'ownCamp'
  | 'campFree'
  | 'ownerHome'
  | 'ownerInRun'
  | 'raidedToday'
  | 'guardTooWeak'
  | 'badTrophy';

/** The words for each refusal (the client's error copy and the server's toasts). */
export const CAMP_REFUSAL_TEXT: Readonly<Record<CampRefusal, string>> = Object.freeze({
  campsOff: 'The camps are quiet today. Nobody is claiming or raiding.',
  noCampHere: "There is no travellers' camp here. Every route has one.",
  campFar: 'Walk up to the campfire first.',
  campTaken: 'Someone already holds this camp. Beat their guard to win a cut of their money.',
  haveCamp: 'You already hold a camp. Abandon it first.',
  noCamp: 'You hold no camp.',
  inRun: 'Not during a Nuzlocke or Hardcore run.',
  noParty: 'You need a creature able to fight.',
  ownCamp: 'This is your own camp.',
  campFree: 'Nobody holds this camp. Claim it instead.',
  ownerHome: 'Its owner is in the world. Their guard only fights while they are away.',
  ownerInRun: 'Its owner is on a challenge run. Their camp rests until it ends.',
  raidedToday: 'You already raided this camp today.',
  guardTooWeak: 'Its guard is far below your level. There is nothing to win here.',
  badTrophy: 'That is not a trophy you have earned.',
});

/** Why a claim is refused, or null. `here`: the camp of the zone the trainer stands in (null: none there). */
export function claimRefusal(p: {
  readonly enabled: boolean;
  readonly campHere: boolean;
  readonly near: boolean;
  readonly heldBy: string | null;
  readonly me: string;
  readonly holdsOne: boolean;
  readonly inRun: boolean;
  readonly canFight: boolean;
}): CampRefusal | null {
  if (!p.enabled) return 'campsOff';
  if (!p.campHere) return 'noCampHere';
  if (p.heldBy === p.me) return 'ownCamp';
  if (p.heldBy !== null) return 'campTaken';
  if (p.holdsOne) return 'haveCamp';
  if (p.inRun) return 'inRun';
  if (!p.canFight) return 'noParty';
  if (!p.near) return 'campFar';
  return null;
}

/** Why a raid is refused, or null. */
export function raidRefusal(p: {
  readonly enabled: boolean;
  readonly campHere: boolean;
  readonly near: boolean;
  readonly heldBy: string | null;
  readonly me: string;
  readonly inRun: boolean;
  readonly canFight: boolean;
  readonly ownerOnline: boolean;
  readonly ownerInRun: boolean;
  readonly wonToday: boolean;
  readonly guardTop: number;
  readonly leadLevel: number;
}): CampRefusal | null {
  if (!p.enabled) return 'campsOff';
  if (!p.campHere) return 'noCampHere';
  if (p.heldBy === null) return 'campFree';
  if (p.heldBy === p.me) return 'ownCamp';
  if (p.inRun) return 'inRun';
  if (!p.canFight) return 'noParty';
  if (!p.near) return 'campFar';
  if (p.ownerOnline) return 'ownerHome';
  if (p.ownerInRun) return 'ownerInRun';
  if (p.wonToday) return 'raidedToday';
  if (p.guardTop < p.leadLevel - CAMP_LEVEL_SPAN) return 'guardTooWeak';
  return null;
}

// ─── the camp log ────────────────────────────────────────────────────────────

export interface CampLogEntry {
  readonly raider: string;
  /** the raider won */
  readonly won: boolean;
  readonly cut: number;
  readonly tookOver: boolean;
}

/** One line of the owner's camp log. */
export function campLogLine(e: CampLogEntry): string {
  if (!e.won) return `Your guard held against ${e.raider}.`;
  if (e.tookOver) return `${e.raider} beat your guard and took your camp${e.cut > 0 ? `, and ${e.cut.toLocaleString('en-US')} with it` : ''}.`;
  if (e.cut <= 0) return `${e.raider} raided your camp but found nothing to take.`;
  return `${e.raider} raided your camp and took ${e.cut.toLocaleString('en-US')}.`;
}

/** What the owner hears on coming back: the first entries as lines, then how many more (oldest first). */
export function campWelcome(entries: readonly CampLogEntry[], max = 3): string[] {
  const lines = entries.slice(0, max).map(campLogLine);
  const more = entries.length - lines.length;
  if (more > 0) lines.push(`Your camp saw ${more} more raid${more === 1 ? '' : 's'} while you were away. Read the camp log.`);
  return lines;
}

/** The raider's toast after a won raid. */
export function raidWonText(owner: string, cut: number, tookOver: boolean): string {
  const took = cut > 0 ? `took ${cut.toLocaleString('en-US')} from ${owner}` : `found nothing to take from ${owner}`;
  return `You raided the camp and ${took}.${tookOver ? ' Its owner is long gone: the camp is yours now.' : ''} Your lead's honor suffers.`;
}

// ─── where the camps stand ───────────────────────────────────────────────────

export interface CampSlot {
  readonly x: number;
  readonly z: number;
  /** facing the fire */
  readonly yaw: number;
}

export interface CampDef {
  readonly zoneId: ZoneId;
  /** the campfire (the camp's interact point) */
  readonly fire: { readonly x: number; readonly z: number };
  /** the tent the camp grew round */
  readonly tent: { readonly x: number; readonly z: number };
  /** the banner pole (its name) */
  readonly banner: CampSlot;
  /** the trophy slots, in order */
  readonly slots: readonly CampSlot[];
}

/** Trophy slots and the banner: round the fire at this radius, at these angles from the side away from the tent. */
export const CAMP_SLOT_RADIUS = 3;
const SLOT_ANGLES_DEG = [60, -60, 105] as const;
const BANNER_ANGLE_DEG = -150;

function slotAt(fx: number, fz: number, base: number, deg: number): CampSlot {
  const a = base + (deg * Math.PI) / 180;
  const x = Math.round((fx + Math.cos(a) * CAMP_SLOT_RADIUS) * 100) / 100;
  const z = Math.round((fz + Math.sin(a) * CAMP_SLOT_RADIUS) * 100) / 100;
  // yaw so that local +z faces the fire (three's rotation.y convention: +z → (sin yaw, cos yaw))
  const yaw = Math.round(Math.atan2(fx - x, fz - z) * 1000) / 1000;
  return { x, z, yaw };
}

function buildCamp(zoneId: ZoneId): CampDef | null {
  const props = SCULPTS[zoneId]?.props ?? [];
  const fire = props.find((p) => p.kind === 'campfire');
  if (fire === undefined) return null;
  let tent: { x: number; z: number } | null = null;
  for (const p of props) {
    if (p.kind !== 'tent') continue;
    if (tent === null || Math.hypot(p.x - fire.x, p.z - fire.z) < Math.hypot(tent.x - fire.x, tent.z - fire.z)) tent = { x: p.x, z: p.z };
  }
  if (tent === null) return null;
  // the side away from the tent: the dig spot's side when there is one (followers' layer), else straight away
  const dig = DIG_SPOTS[zoneId]?.[0];
  const away = dig !== undefined ? Math.atan2(dig.z - fire.z, dig.x - fire.x) : Math.atan2(fire.z - tent.z, fire.x - tent.x);
  return {
    zoneId,
    fire: { x: fire.x, z: fire.z },
    tent,
    banner: slotAt(fire.x, fire.z, away, BANNER_ANGLE_DEG),
    slots: SLOT_ANGLES_DEG.map((d) => slotAt(fire.x, fire.z, away, d)),
  };
}

const CAMP_CACHE = new Map<ZoneId, CampDef | null>();

/** The travellers' camp of a zone (every route has one), or null. */
export function campOf(zoneId: ZoneId): CampDef | null {
  if (!CAMP_CACHE.has(zoneId)) CAMP_CACHE.set(zoneId, buildCamp(zoneId));
  return CAMP_CACHE.get(zoneId)!;
}

/** Every zone with a camp, by id. */
export function campZones(): ZoneId[] {
  const ids = Object.keys(SCULPTS).sort() as ZoneId[];
  return ids.filter((z) => campOf(z) !== null);
}

/** Whether (x, z) is within `range` of a camp's fire. */
export function nearCamp(camp: Pick<CampDef, 'fire'>, x: number, z: number, range: number = CAMP_RANGE_M): boolean {
  return Math.hypot(camp.fire.x - x, camp.fire.z - z) <= range;
}
