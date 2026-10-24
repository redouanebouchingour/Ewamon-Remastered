/**
 * A recurring rival (content rival.ts, LLM feature 7): when the rival may show itself, the roll that brings it to a
 * route, where it steps out, the team it brings and the view the client gets. Pure: the zone room and the routes pass
 * the world seed, the clock, the heightfield and the player's facts; the end of the battle writes the record
 * (battleSession `persistTurn`).
 *
 * The rules (`RIVAL=on`): a route (never a town, a story zone or an interior), the player holds a badge, no story beat
 * waits in this zone, the player is not in a battle, a trade, a crossing or a trainer's hold, and the cooldown since
 * the last meeting is over. Then a roll seeded by the world seed, the player, the meeting count, the zone and the hour
 * brings the rival with `RIVAL_CHANCE`; it shows itself after the player has walked a seeded `RIVAL_WALK_M` there.
 * `RIVAL=always` (live checks) skips the roll and the cooldown and comes after `RIVAL_WALK_ALWAYS_M`.
 */
import {
  RIVAL_CHANCE,
  RIVAL_COOLDOWN_MS,
  RIVAL_MIN_BADGES,
  RIVAL_SPAWN_M,
  RIVAL_WALK_ALWAYS_M,
  RIVAL_WALK_M,
  STARTER_ROOTS,
  evolutionRoot,
  isWalkable,
  rivalArc,
  rivalIdentity,
  rivalLevelLead,
  rivalTeamSize,
  signatureSpecies,
} from '@ewa/content';
import type { Heightfield, RectSolid, ZoneDef, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { CreatureInstance } from '@ewa/core';
import type { Rival, RivalIdentityRow } from '@ewa/persist';
import type { RivalTeamMember, RivalView } from '@ewa/protocol';
import { lineOfSight } from '../rooms/encounters';
import { pickSlot, zoneSlots } from './villagers';

export type RivalMode = 'on' | 'off' | 'always';

/** Why the rival does not come now (null: it may). */
export type RivalRefusal = 'off' | 'notRoute' | 'interior' | 'badges' | 'storyBeat' | 'busy' | 'cooldown';

export interface RivalGateInput {
  readonly mode: RivalMode;
  readonly zoneKind: ZoneDef['kind'];
  readonly inInterior: boolean;
  readonly badges: number;
  /** a story beat waits for the player in this zone */
  readonly beatPending: boolean;
  /** in a battle, a trade, a crossing, a trainer's hold or a raid */
  readonly busy: boolean;
  /** the end of the rival's cooldown (null: never met) */
  readonly nextAt: number | null;
  readonly now: number;
}

/** The gates, in order; `always` keeps every gate but the cooldown. */
export function rivalRefusal(g: RivalGateInput): RivalRefusal | null {
  if (g.mode === 'off') return 'off';
  if (g.zoneKind !== 'route') return 'notRoute';
  if (g.inInterior) return 'interior';
  if (g.badges < RIVAL_MIN_BADGES) return 'badges';
  if (g.beatPending) return 'storyBeat';
  if (g.busy) return 'busy';
  if (g.mode !== 'always' && g.nextAt !== null && g.now < g.nextAt) return 'cooldown';
  return null;
}

/**
 * The roll on entering a route: null (not this time) or the metres the player walks before the rival shows itself.
 * Seeded by the world seed, the player, the meetings so far, the zone and the hour, so a reload in the same hour rolls
 * the same, and a new meeting or a new hour rolls again.
 */
export function rivalRoll(mode: RivalMode, worldSeed: string, playerId: string, meetings: number, zoneId: string, now: number): number | null {
  if (mode === 'off') return null;
  if (mode === 'always') return RIVAL_WALK_ALWAYS_M;
  const rng = createRng(`${worldSeed}:${playerId}:rival:${meetings}:${zoneId}:${Math.floor(now / 3_600_000)}`);
  if (rng.next() >= RIVAL_CHANCE) return null;
  const [lo, hi] = RIVAL_WALK_M;
  return lo + rng.next() * (hi - lo);
}

/** The rival's cooldown after a meeting (none with `always`). */
export function rivalCooldownMs(mode: RivalMode): number {
  return mode === 'always' ? 0 : RIVAL_COOLDOWN_MS;
}

/** The player's own starter line: the first creature of a starter line they did not catch (null: none). */
export function playerStarter(records: readonly Pick<CreatureInstance, 'speciesId' | 'caughtAt'>[]): string | null {
  const lines = records.map((r) => ({ root: evolutionRoot(r.speciesId), gift: r.caughtAt === null })).filter((r) => STARTER_ROOTS.includes(r.root));
  return (lines.find((r) => r.gift) ?? lines[0])?.root ?? null;
}

/** The identity a new rival is created with (stored at once, so the world seed never renames it later). */
export function newRivalIdentity(worldSeed: string, playerId: string, starter: string | null): RivalIdentityRow {
  return rivalIdentity(`${worldSeed}:${playerId}:rival`, starter);
}

/**
 * The team the rival brings now: its signature line at the player's badges first, then species from this zone's land
 * slots (no repeats, never the signature's line, never an alpha slot), `rivalTeamSize(badges)` in all. The signature
 * stands `rivalLevelLead` above the player's strongest, the others 1 to 3 below it. Deterministic for a rival, a
 * meeting count, a zone and a badge count.
 */
export function rivalTeam(rival: Pick<Rival, 'playerId' | 'name' | 'signature' | 'meetings' | 'playerWins' | 'rivalWins'>, badges: number, topLevel: number, zoneId: ZoneId): RivalTeamMember[] {
  const rng = createRng(`rival:${rival.playerId}:${rival.name}:${rival.meetings}:${zoneId}:${badges}`);
  const clamp = (n: number): number => Math.max(2, Math.min(100, Math.round(n)));
  const top = clamp(topLevel + rivalLevelLead(rival));
  const team: RivalTeamMember[] = [{ speciesId: signatureSpecies(rival.signature, badges), level: top }];
  const size = rivalTeamSize(badges);
  const slots = zoneSlots(zoneId).filter((s) => s.tier !== 'alpha' && evolutionRoot(s.species) !== rival.signature);
  for (let guard = 0; team.length < size && guard < 40 && slots.length > 0; guard++) {
    const sp = pickSlot(slots, rng).species;
    if (team.some((t) => t.speciesId === sp)) continue;
    team.push({ speciesId: sp, level: clamp(top - 1 - rng.int(3)) });
  }
  return team;
}

/** The view of the rival the client gets (`rival` message, GET /rival). */
export function rivalView(r: Rival, badges: number, team: readonly RivalTeamMember[]): RivalView {
  return {
    name: r.name,
    look: r.look,
    temperament: r.temperament as RivalView['temperament'],
    signature: r.signature,
    arc: rivalArc(badges, r),
    record: { playerWins: r.playerWins, rivalWins: r.rivalWins, draws: r.draws, meetings: r.meetings },
    last:
      r.lastResult === null || r.lastZone === null || r.lastMetAt === null
        ? null
        : { result: r.lastResult, zoneId: r.lastZone, at: r.lastMetAt.toISOString(), words: r.lastWords },
    team: team.map((t) => ({ speciesId: t.speciesId, level: t.level })),
  };
}

/**
 * Where the rival steps out: `RIVAL_SPAWN_M` from the player, ahead of them first and then round both sides, on
 * walkable ground with a clear line to them (like a trainer who saw them). Null when nowhere fits.
 */
export function rivalSpawnPoint(h: Heightfield, closedGates: readonly RectSolid[], px: number, pz: number, angle: number, inInterior: (x: number, z: number) => boolean): { x: number; z: number } | null {
  for (const dist of [RIVAL_SPAWN_M, RIVAL_SPAWN_M * 0.7]) {
    for (let k = 0; k < 12; k++) {
      // 0, +30°, -30°, +60°, -60°, ... round to behind the player
      const turn = (Math.ceil(k / 2) * Math.PI) / 6 * (k % 2 === 0 ? 1 : -1);
      const a = angle + turn;
      const x = px + Math.sin(a) * dist;
      const z = pz + Math.cos(a) * dist;
      if (!isWalkable(h, x, z) || inInterior(x, z)) continue;
      if (!lineOfSight(h, closedGates, x, z, px, pz)) continue;
      return { x, z };
    }
  }
  return null;
}

/** The parting words as they are stored: one line, no em-dash, no control characters. */
export function cleanWords(text: string, max: number): string {
  return [...text]
    .map((c) => (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f ? ' ' : c))
    .join('')
    .replace(/\s*[\u2014\u2015]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
