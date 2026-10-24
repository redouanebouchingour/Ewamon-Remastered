/**
 * The rumour board (LLM feature 8): a town crier in every town, beside the bounty board's Marshal (the interiors layer,
 * like the board itself: never a `ZoneDef` change, so no zone layout or fixture moves). Paging past the crier's lines
 * opens the Rumours screen for that town; the facts are the server's (`GET /world/rumours/:zoneId`), the words the
 * client's.
 *
 * - In a counter hall (Healer, else Mart) the crier stands left of the counter, across from the Marshal on the right.
 * - In Skyrend's Marshal's Office (a house) the crier stands on the Marshal's side, nearer the door.
 *
 * The board covers the town and the zones one link away (`rumourZones`): their raids, swarms, ecosystem, camps and
 * nemeses are local news; badges, the league, the market and the cup are the whole region's.
 */
import type { InteriorDef, InteriorNpc, ZoneId } from '../types';
import { BOUNTY_MARSHAL_AT, BOUNTY_OFFICES, bountyMarshalId } from './bounties';
import { ZONES } from './zones';

/**
 * In a counter hall: left of the counter, across from the Marshal, a little deeper than him so a player who walks up
 * to the crier is nearer to it than to the Healer's PC on the left wall (the live check found the PC winning from a
 * mirrored spot).
 */
export const CRIER_AT = Object.freeze({ lx: -BOUNTY_MARSHAL_AT.lx - 0.2, lz: BOUNTY_MARSHAL_AT.lz - 0.6 });

/** The crier's lines (before the Rumours screen opens). */
export const CRIER_LINES: readonly string[] = Object.freeze([
  "Hear ye, hear ye! Today's news from the town and the roads around it.",
  'Every word on my board is true. Mostly. Have a read.',
]);

/** The crier's npc id in the hall `building`. */
export function crierId(building: string): string {
  return `${building}.crier`;
}

/** The town whose crier `npcId` is, else null. */
export function crierTown(npcId: string): ZoneId | null {
  for (const [zoneId, building] of Object.entries(BOUNTY_OFFICES).sort()) if (crierId(building) === npcId) return zoneId as ZoneId;
  return null;
}

/** Whether `zoneId` keeps a rumour board (every town). */
export function hasRumourBoard(zoneId: string): boolean {
  return BOUNTY_OFFICES[zoneId] !== undefined;
}

/** The interiors layer: the town's office hall (the bounty board's) gets the crier; walls, props and footprint unchanged. */
export function withTownCrier(def: InteriorDef): InteriorDef {
  if (BOUNTY_OFFICES[def.zoneId] !== def.id) return def;
  const crier = (lx: number, lz: number): InteriorNpc => ({
    id: crierId(def.id),
    name: 'Town Crier',
    lx,
    lz,
    facing: 0,
    look: 'old_classy_male',
    role: 'crier',
    lines: CRIER_LINES,
  });
  if (def.template === 'healer' || def.template === 'shop') return { ...def, npcs: [...def.npcs, crier(CRIER_AT.lx, CRIER_AT.lz)] };
  const marshal = def.npcs.find((n) => n.id === bountyMarshalId(def.id));
  if (marshal === undefined) return def;
  const lx = Math.round(marshal.lx * 1.4 * 100) / 100;
  return { ...def, npcs: [...def.npcs, crier(lx, Math.round((def.d / 2 - 2.6) * 100) / 100)] };
}

const zoneById = new Map(ZONES.map((z) => [z.id, z]));

/** The zones a town's board talks about: the town, then the zones one link away (sorted, no repeats). */
export function rumourZones(town: ZoneId): readonly ZoneId[] {
  const z = zoneById.get(town);
  if (z === undefined) return [];
  const near = Object.values(z.links)
    .sort()
    .filter((x): x is ZoneId => x !== undefined && x !== town);
  return [town, ...near.filter((x, i) => near.indexOf(x) === i)];
}
