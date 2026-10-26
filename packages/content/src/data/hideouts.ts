/**
 * Hideouts: a building of its own that the zone plan does not lay out (a separate layer, like the pockets and the Cut /
 * Strength obstacles), with a hall behind its door. Today there is one: Vesperveil's Sunken Crypt, where the legendary
 * Astaroth waits after the Champion (LEGENDARY_STATICS `interior`).
 *
 * - The building stands at an authored spot (`x`, `z`, door = local +z after `yaw`) on level, walkable ground the plan
 *   left clear. It is drawn as a `crypt` building (render `BuildingSpec`: the grand build in bare stone), stamped unwalkable after the obstacles
 *   (`stampHideouts`), and never feeds the layout RNG, so the zone's plan, its other pockets and every other zone stay
 *   byte-identical.
 * - Its hall is placed by `planInteriors` after the town's own pockets (last in scan order, so theirs do not move), clear
 *   of the building itself, and reached through the usual `<id>.in` / `<id>.out` door warps.
 *
 * The Sunken Crypt (inspired by the devils of Black Clover): a foyer where the last warden keeps watch, an anti-magic
 * seal that opens once the Champion is beaten, then the throne chamber, a five-leaf clover sigil under its arena and the
 * demon lord standing before an empty throne.
 */
import type { PlanBuilding, RoofKind } from '../plan';
import { toWorld } from '../plan';
import type { InteriorDef, InteriorProp, InteriorWall, LocalPoint, ZoneId } from '../types';
import { POSTGAME_FLAG } from './league';

export interface HideoutDef {
  /** the building id, also its hall's id (`<zone>.<name>`) */
  readonly id: string;
  readonly zoneId: ZoneId;
  readonly label: string;
  /** building centre and yaw (its door is local +z) */
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** footprint along local x (w) and local z (d) */
  readonly w: number;
  readonly d: number;
  readonly roof: RoofKind;
}

export const SUNKEN_CRYPT = 'vesperveil.crypt';

export const HIDEOUTS: readonly HideoutDef[] = [
  // the far west corner of the graveyard plateau, behind the gravetender; the door looks east over the graves
  { id: SUNKEN_CRYPT, zoneId: 'vesperveil', label: 'the Sunken Crypt', x: -50, z: 35, yaw: Math.PI / 2, w: 7, d: 6, roof: 'slate' },
];

export function hideoutsFor(zoneId: ZoneId): readonly HideoutDef[] {
  return HIDEOUTS.filter((h) => h.zoneId === zoneId);
}

/** Its exterior as a plan building (render draws it; never part of `ZonePlan.buildings`). */
export function hideoutBuilding(h: HideoutDef): PlanBuilding {
  return { id: h.id, kind: 'crypt', x: h.x, z: h.z, yaw: h.yaw, w: h.w, d: h.d, floors: 1, roof: h.roof, seed: seedOf(h.id) };
}

/** Where `<id>.in` sits and `<id>.out` lands: 1.4 m out from the middle of the door wall. */
export function hideoutDoor(h: HideoutDef): { readonly x: number; readonly z: number } {
  const [x, z] = toWorld(h, 0, h.d / 2 + 1.4);
  return { x, z };
}

/** The world AABB of the building (its yaw is a multiple of π/2). */
export function hideoutBounds(h: HideoutDef): { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number } {
  const side = Math.abs(Math.round(h.yaw / (Math.PI / 2))) % 2 === 1;
  return { x: h.x, z: h.z, hw: (side ? h.d : h.w) / 2, hd: (side ? h.w : h.d) / 2 };
}

/** protocol MOVEMENT.radius: the stamp grows the building by the capsule, like the plan's own footprints. */
const CAPSULE_M = 0.35;

/** Sets `walkable = 0` under every hideout building of the zone (grown by the capsule). In place. */
export function stampHideouts(
  h: { readonly res: number; readonly step: number; readonly originX: number; readonly originZ: number; readonly walkable: Uint8Array },
  zoneId: ZoneId,
): void {
  for (const hd of hideoutsFor(zoneId)) {
    const b = hideoutBounds(hd);
    const c0 = Math.max(0, Math.ceil((b.x - b.hw - CAPSULE_M - h.originX) / h.step));
    const c1 = Math.min(h.res - 1, Math.floor((b.x + b.hw + CAPSULE_M - h.originX) / h.step));
    const r0 = Math.max(0, Math.ceil((b.z - b.hd - CAPSULE_M - h.originZ) / h.step));
    const r1 = Math.min(h.res - 1, Math.floor((b.z + b.hd + CAPSULE_M - h.originZ) / h.step));
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) h.walkable[row * h.res + col] = 0;
  }
}

function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// ─── the Sunken Crypt's hall ─────────────────────────────────────────────────

/** 14 × 22 m: a foyer (lz 11 to 5), the seal wall at lz 5, the throne chamber behind it. */
export const CRYPT_HALL = Object.freeze({ w: 14, d: 22, sealZ: 5, sealGap: 1.5, arena: { lx: 0, lz: -2 } });
/** Where Astaroth stands: the arena's far slot (content interiors `ARENA_SLOT_M`), before the throne. */
export const CRYPT_STATIC_AT: LocalPoint = { lx: 0, lz: CRYPT_HALL.arena.lz - 4.45 };

const prop = (kind: string, lx: number, lz: number, yaw = 0, scale = 1): InteriorProp => ({ kind, lx, lz, yaw, scale });
const solid = (lx: number, lz: number, hw: number, hd: number): InteriorWall => ({ lx, lz, hw, hd, style: 'wall' });

/** The hall behind a hideout's door, or null for an id that is not one. */
export function hideoutHall(h: HideoutDef): InteriorDef | null {
  if (h.id !== SUNKEN_CRYPT) return null;
  const { w, d, sealZ, sealGap, arena } = CRYPT_HALL;
  const hw = w / 2;
  const hd = d / 2;
  const seg = (hw - sealGap) / 2;
  const pillars: [number, number][] = [];
  // four pillars in the chamber's corners, every solid ≥ ARENA_CLEARANCE_M (6.5 m) from the arena
  for (const z of [3.5, -8.5]) for (const s of [-1, 1]) pillars.push([s * 6, z]);
  return {
    id: h.id,
    zoneId: h.zoneId,
    building: h.id,
    template: 'crypt',
    theme: 'abyss',
    label: h.label,
    w,
    d,
    entry: { lx: 0, lz: hd - 2.4 },
    exit: { lx: 0, lz: hd - 0.8 },
    rooms: [{ id: 'throne', arena, leader: null, leaderAt: null, bounds: { lx: 0, lz: (sealZ - hd) / 2, hw, hd: (sealZ + hd) / 2 } }],
    walls: [
      // the seal wall either side of its gate
      solid(-(sealGap + seg), sealZ, seg, 0.3),
      solid(sealGap + seg, sealZ, seg, 0.3),
      // the throne, the chamber's pillars, braziers and weapon racks, the foyer's statue and bookshelf
      solid(0, -hd + 1.4, 1.6, 1),
      ...pillars.map(([x, z]) => solid(x, z, 0.45, 0.45)),
      solid(-3.6, -hd + 1.8, 0.35, 0.35),
      solid(3.6, -hd + 1.8, 0.35, 0.35),
      solid(-hw + 0.45, -6.2, 0.3, 0.8),
      solid(hw - 0.45, -6.2, 0.3, 0.8),
      solid(-hw + 1, sealZ + 3.6, 0.6, 0.6),
      solid(hw - 0.45, hd - 3.2, 0.3, 0.65),
    ],
    gates: [{ id: `${h.id}.seal`, rect: { lx: 0, lz: sealZ, hw: sealGap, hd: 0.3 }, opensWhen: [POSTGAME_FLAG], style: 'rune' }],
    switches: [],
    trainers: [],
    npcs: [
      {
        id: `${h.id}.warden`,
        name: 'Morwen, last warden of the seal',
        lx: -3.6,
        lz: hd - 4,
        facing: 0,
        look: 'old_classy_female',
        role: 'guide',
        lines: [
          'You found the stair. Most of Vesperveil walks past this crypt every day and never sees it.',
          'The seal is anti-magic, the one thing he cannot cut. Every warden before me held it. I am the last.',
          'Two blades: one that breaks magic, one that drinks the soul. He has stood before that empty throne since before the town had a name.',
          'Only someone the League already kneels to may pass the seal. Wake him and he will not ask your name.',
        ],
      },
    ],
    items: [],
    props: [
      prop('clover_sigil', arena.lx, arena.lz),
      prop('throne', 0, -hd + 1.4),
      ...pillars.map(([x, z]) => prop('pillar', x, z)),
      prop('brazier', -3.6, -hd + 1.8),
      prop('brazier', 3.6, -hd + 1.8),
      prop('banner', -5.2, -hd + 0.6),
      prop('banner', 5.2, -hd + 0.6),
      prop('weapon_rack', -hw + 0.6, -6.2, Math.PI / 2),
      prop('weapon_rack', hw - 0.6, -6.2, -Math.PI / 2),
      prop('candles', -hw + 1.2, hd - 1.4),
      prop('candles', hw - 1.2, hd - 1.4),
      prop('candles', -hw + 1.2, sealZ + 1.6),
      prop('candles', hw - 1.2, sealZ + 1.6),
      prop('bookshelf', hw - 0.45, hd - 3.2, -Math.PI / 2),
      prop('statue', -hw + 1, sealZ + 3.6),
    ],
  };
}
