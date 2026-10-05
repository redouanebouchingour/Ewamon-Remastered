/**
 * Interior templates: the hall every town building opens into (shop, healer, houses, the gym, Solenne's league
 * hall). Authored in each hall's LOCAL frame — origin at the floor centre, the door in the middle of the +z wall,
 * x across, z along the hall — and placed in the zone by `planInteriors` (`../interiors.ts`).
 *
 * Gym halls are 20 × 34 m: a foyer by the door, a puzzle band, then the leader's chamber behind a gated wall at
 * z = −2 with the arena at (0, −9.5) and the leader waiting at (0, −13.7), facing the door. Each gym has 2–3 gym
 * trainers beside per-player gates (`trainer:<id>:beaten`) and one gimmick built from gates + switches + walls; the
 * leader's gate needs every trainer and every puzzle flag. The league hall is 20 × 62 m: a foyer (nurse + guide) and
 * four 14 m chambers in sequence, each gate opening on the previous Warden's `elite:*` flag.
 *
 * Gym trainers fight with the gym leader's own (non-legendary) species a few levels lower, so no gym adds a species
 * to its zone's bind set.
 */
import type {
  InteriorDef,
  InteriorGate,
  InteriorItem,
  InteriorNpc,
  InteriorProp,
  InteriorRoom,
  InteriorSwitch,
  InteriorSwitchKind,
  InteriorTheme,
  InteriorTrainer,
  InteriorWall,
  InteriorWallStyle,
  InteriorGateStyle,
  LeagueTrainer,
  LocalPoint,
  LocalRect,
  ZoneId,
} from '../types';
import { LEGENDARY_IDS, MYTHICAL_IDS } from './statics';

// ─── flags ───────────────────────────────────────────────────────────────────

/** Same spelling as the server's `trainerBeatenFlag`. */
export function interiorTrainerFlag(trainerId: string): string {
  return `trainer:${trainerId}:beaten`;
}
/** `switch:<zone>:<switch id>` — the server writes it on a successful `interact { kind: 'switch' }`. */
export function switchFlag(zoneId: ZoneId, switchId: string): string {
  return `switch:${zoneId}:${switchId}`;
}

// ─── sizes ───────────────────────────────────────────────────────────────────

export const GYM_HALL = Object.freeze({
  w: 20,
  d: 34,
  arena: { lx: 0, lz: -9.5 },
  leaderAt: { lx: 0, lz: -13.7 },
  leaderWallZ: -2,
});
export const LEAGUE_HALL = Object.freeze({ w: 20, d: 62, chamber: 14, foyer: 6 });
export const SHOP_HALL = Object.freeze({ w: 10, d: 8 });
export const HOUSE_S = Object.freeze({ w: 8, d: 7 });
export const HOUSE_M = Object.freeze({ w: 9, d: 8 });

// ─── small builders ──────────────────────────────────────────────────────────

const wall = (
  lx: number,
  lz: number,
  hw: number,
  hd: number,
  style: InteriorWallStyle = 'wall',
): InteriorWall => ({ lx, lz, hw, hd, style });
const rect = (lx: number, lz: number, hw: number, hd: number): LocalRect => ({ lx, lz, hw, hd });
const pt = (lx: number, lz: number): LocalPoint => ({ lx, lz });
const prop = (kind: string, lx: number, lz: number, yaw = 0, scale = 1): InteriorProp => ({
  kind,
  lx,
  lz,
  yaw,
  scale,
});

interface Ctx {
  readonly zoneId: ZoneId;
  readonly id: string;
}
const T = (c: Ctx, local: string): string => interiorTrainerFlag(`${c.id}.${local}`);
const S = (c: Ctx, local: string): string => switchFlag(c.zoneId, `${c.id}.${local}`);
function sw(
  c: Ctx,
  local: string,
  kind: InteriorSwitchKind,
  lx: number,
  lz: number,
  requires: readonly string[],
  label: string,
  opts: { readonly sets?: boolean; readonly warpTo?: LocalPoint } = {},
): InteriorSwitch {
  return {
    id: `${c.id}.${local}`,
    kind,
    lx,
    lz,
    sets: opts.sets === false ? null : S(c, local),
    requires,
    warpTo: opts.warpTo ?? null,
    label,
  };
}
const gate = (
  id: string,
  r: LocalRect,
  opensWhen: readonly string[],
  style: InteriorGateStyle,
): InteriorGate => ({ id, rect: r, opensWhen, style });

/** The leader's wall at z = −2 with its 3 m gate in the middle. */
function leaderWall(style: InteriorWallStyle): InteriorWall[] {
  const z = GYM_HALL.leaderWallZ;
  return [wall(-5.75, z, 4.25, 0.3, style), wall(5.75, z, 4.25, 0.3, style)];
}
function leaderGate(c: Ctx, flags: readonly string[], style: InteriorGateStyle): InteriorGate {
  return gate(`${c.id}.gate.leader`, rect(0, GYM_HALL.leaderWallZ, 1.5, 0.3), flags, style);
}
/** A cross wall at z with a centred gap of half width `gap` (the gate fills it). */
function crossWall(z: number, gap: number, style: InteriorWallStyle, hd = 0.3): InteriorWall[] {
  const hw = (10 - gap) / 2;
  return [wall(-(gap + hw), z, hw, hd, style), wall(gap + hw, z, hw, hd, style)];
}

// ─── gym trainers ────────────────────────────────────────────────────────────

const NOT_LEGENDARY = (s: string): boolean =>
  !LEGENDARY_IDS.includes(s) && !MYTHICAL_IDS.includes(s);

interface TrainerSpec {
  readonly local: string;
  readonly name: string;
  readonly look: string;
  readonly lx: number;
  readonly lz: number;
  readonly facing: number;
  readonly lines: readonly string[];
}

/** Gym trainer k of n: the leader's non-legendary species, k + 1 of them (at most 3), a few levels under the leader's lowest. */
function gymTrainers(
  c: Ctx,
  leader: LeagueTrainer,
  specs: readonly TrainerSpec[],
): InteriorTrainer[] {
  const pool = leader.team.map((m) => m.species).filter(NOT_LEGENDARY);
  const low = Math.min(...leader.team.map((m) => m.level));
  return specs.map((s, k) => {
    const size = Math.min(3, k + 1, pool.length);
    const team = Array.from({ length: size }, (_, j) => ({
      species: pool[(k + j) % pool.length]!,
      level: Math.max(3, low - (specs.length - k) - 1 + j),
    }));
    return {
      id: `${c.id}.${s.local}`,
      name: s.name,
      lx: s.lx,
      lz: s.lz,
      facing: s.facing,
      look: s.look,
      team,
      lines: s.lines,
      reward: Math.round(leader.reward * (0.25 + 0.1 * k)),
    };
  });
}

/** The leader chamber every gym hall shares. */
function gymRoom(leader: LeagueTrainer): InteriorRoom {
  return {
    id: 'arena',
    arena: pt(GYM_HALL.arena.lx, GYM_HALL.arena.lz),
    leader: leader.id,
    leaderAt: pt(GYM_HALL.leaderAt.lx, GYM_HALL.leaderAt.lz),
    bounds: rect(0, -9.5, 10, 7.5),
  };
}

interface GymDesign {
  readonly theme: InteriorTheme;
  readonly walls: InteriorWall[];
  readonly gates: InteriorGate[];
  readonly switches: InteriorSwitch[];
  readonly trainers: InteriorTrainer[];
  readonly props: InteriorProp[];
}

/** Banners, pillars and braziers along the leader chamber, shared by every theme (the theme picks the colours). */
function chamberDressing(): InteriorProp[] {
  return [
    prop('pillar', -8.6, -4),
    prop('pillar', 8.6, -4),
    prop('pillar', -8.6, -15.2),
    prop('pillar', 8.6, -15.2),
    prop('banner', -4.5, -16.7),
    prop('banner', 4.5, -16.7),
    prop('brazier', -3, -15.6),
    prop('brazier', 3, -15.6),
    prop('spectators', -9.2, -9.5, Math.PI / 2),
    prop('spectators', 9.2, -9.5, -Math.PI / 2),
  ];
}
function foyerDressing(): InteriorProp[] {
  return [prop('statue', -7.8, 15.2), prop('statue', 7.8, 15.2), prop('rug', 0, 14.5, 0, 1.2)];
}

/** Grass — Mirevale: a hedge maze (serpentine) with two root-stones in its dead ends. */
function grassGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Gardener Fen',
      look: 'casual3_male',
      lx: 2.8,
      lz: 11.6,
      facing: 0,
      lines: ['The grove remembers every footstep. Let me see yours.'],
    },
    {
      local: 't2',
      name: 'Botanist Ilse',
      look: 'casual2_female',
      lx: 7.4,
      lz: 4.9,
      facing: -Math.PI / 2,
      lines: ['Roots grow toward what they trust. Do yours?'],
    },
  ]);
  return {
    theme: 'grove',
    walls: [
      ...crossWall(10, 1.5, 'hedge'),
      wall(2, 6.5, 8, 0.3, 'hedge'),
      wall(-2, 3, 8, 0.3, 'hedge'),
      ...leaderWall('hedge'),
    ],
    gates: [
      gate(`${c.id}.gate.g1`, rect(0, 10, 1.5, 0.3), [T(c, 't1')], 'hedge'),
      gate(`${c.id}.gate.g2`, rect(8, 3, 2, 0.3), [T(c, 't2')], 'hedge'),
      leaderGate(c, [T(c, 't1'), T(c, 't2'), S(c, 'stone_a'), S(c, 'stone_b')], 'hedge'),
    ],
    switches: [
      sw(c, 'stone_a', 'rootstone', 8.6, 8.2, [T(c, 't1')], 'Wake the root-stone'),
      sw(c, 'stone_b', 'rootstone', -8.6, 4.75, [T(c, 't1')], 'Wake the root-stone'),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('planter', -8.4, 12.5),
      prop('planter', 8.4, 12.5),
      prop('flowerbed', -4, 8.2),
      prop('flowerbed', 0, 4.75),
      prop('flowerbed', 4, 0.6),
    ],
  };
}

/** Fire — Cinderhold: three lanes; each side lane's furnace, lit, helps open the grate of the centre lane. */
function fireGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Stoker Brann',
      look: 'viking_male',
      lx: -6.75,
      lz: 8.3,
      facing: 0,
      lines: ['Feel that heat? That is only the first furnace.'],
    },
    {
      local: 't2',
      name: 'Smelter Oda',
      look: 'cowboy_female',
      lx: 6.75,
      lz: 8.3,
      facing: 0,
      lines: ['Keep the fire fed or it feeds on you.'],
    },
  ]);
  return {
    theme: 'cinder',
    walls: [
      wall(-3.5, 4.5, 0.3, 6.5, 'wall'),
      wall(3.5, 4.5, 0.3, 6.5, 'wall'),
      ...leaderWall('wall'),
    ],
    gates: [
      gate(
        `${c.id}.gate.centre`,
        rect(0, 11, 3.2, 0.3),
        [S(c, 'furnace_w'), S(c, 'furnace_e')],
        'grate',
      ),
      gate(`${c.id}.gate.west`, rect(-6.75, 6, 3.25, 0.3), [T(c, 't1')], 'grate'),
      gate(`${c.id}.gate.east`, rect(6.75, 6, 3.25, 0.3), [T(c, 't2')], 'grate'),
      leaderGate(c, [T(c, 't1'), T(c, 't2'), S(c, 'furnace_w'), S(c, 'furnace_e')], 'grate'),
    ],
    switches: [
      sw(c, 'furnace_w', 'furnace', -6.75, 1, [T(c, 't1')], 'Stoke the furnace'),
      sw(c, 'furnace_e', 'furnace', 6.75, 1, [T(c, 't2')], 'Stoke the furnace'),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('lava_channel', 0, 4.5, 0, 1),
      prop('brazier', -8.8, 12.5),
      prop('brazier', 8.8, 12.5),
    ],
  };
}

/** Water — Saltmourn: two tide channels; each sluice opens on its lever and the trainer guarding it. */
function waterGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Deckhand Wim',
      look: 'pirate_male',
      lx: 7.6,
      lz: 12,
      facing: 0,
      lines: ['The tide waits for no one. Neither do I.'],
    },
    {
      local: 't2',
      name: 'Diver Sel',
      look: 'cowboy_male',
      lx: -7.6,
      lz: 6.6,
      facing: 0,
      lines: ['Hold your breath. This one goes deep.'],
    },
  ]);
  return {
    theme: 'salt',
    walls: [
      wall(-2, 10, 8, 0.5, 'channel'),
      wall(2, 4.5, 8, 0.5, 'channel'),
      ...leaderWall('wall'),
    ],
    gates: [
      gate(`${c.id}.gate.s1`, rect(8, 10, 2, 0.5), [S(c, 'lever_1'), T(c, 't1')], 'sluice'),
      gate(`${c.id}.gate.s2`, rect(-8, 4.5, 2, 0.5), [S(c, 'lever_2'), T(c, 't2')], 'sluice'),
      leaderGate(
        c,
        [T(c, 't1'), T(c, 't2'), S(c, 'lever_1'), S(c, 'lever_2'), S(c, 'lever_3')],
        'sluice',
      ),
    ],
    switches: [
      sw(c, 'lever_1', 'lever', -8.6, 12.2, [], 'Pull the sluice lever'),
      sw(c, 'lever_2', 'lever', 8.6, 6.4, [S(c, 'lever_1'), T(c, 't1')], 'Pull the sluice lever'),
      sw(c, 'lever_3', 'lever', 8.6, 1.2, [S(c, 'lever_2'), T(c, 't2')], 'Drain the last channel'),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('anchor', -8.6, 15.6),
      prop('barrel', 8.8, 15.4),
    ],
  };
}

/** Electric — Stormrook: four breakers thrown in order light the path to the leader. */
function electricGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Lineman Pike',
      look: 'casual_male',
      lx: 2.8,
      lz: 10.6,
      facing: 0,
      lines: ['Mind the wires. They bite.'],
    },
    {
      local: 't2',
      name: 'Engineer Tova',
      look: 'casual2_female',
      lx: 0,
      lz: 3.5,
      facing: 0,
      lines: ['Wrong order and the whole grid trips. Did you count?'],
    },
  ]);
  return {
    theme: 'storm',
    walls: [
      ...crossWall(9, 1.5, 'iron'),
      wall(-4, 3.5, 0.6, 0.6, 'iron'),
      wall(4, 3.5, 0.6, 0.6, 'iron'),
      ...leaderWall('iron'),
    ],
    gates: [
      gate(`${c.id}.gate.g1`, rect(0, 9, 1.5, 0.3), [T(c, 't1')], 'barrier'),
      leaderGate(
        c,
        [
          T(c, 't1'),
          T(c, 't2'),
          S(c, 'breaker_1'),
          S(c, 'breaker_2'),
          S(c, 'breaker_3'),
          S(c, 'breaker_4'),
        ],
        'barrier',
      ),
    ],
    switches: [
      sw(c, 'breaker_1', 'breaker', -8.6, 6.2, [T(c, 't1')], 'Throw the breaker'),
      sw(c, 'breaker_2', 'breaker', 8.6, 6.2, [S(c, 'breaker_1')], 'Throw the breaker'),
      sw(c, 'breaker_3', 'breaker', 8.6, 0, [S(c, 'breaker_2')], 'Throw the breaker'),
      sw(c, 'breaker_4', 'breaker', -8.6, 0, [S(c, 'breaker_3')], 'Throw the breaker'),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('coil', -4, 3.5),
      prop('coil', 4, 3.5),
      prop('light_path', 0, 3.2, 0, 1),
    ],
  };
}

/** Rock — Marrowdig: a boulder maze; a keystone in the last dead end. */
function rockGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Miner Dag',
      look: 'cowboy_male',
      lx: 6.8,
      lz: 12.8,
      facing: 0,
      lines: ['Every tunnel ends somewhere. Most end in a wall.'],
    },
    {
      local: 't2',
      name: 'Quarrier Hesk',
      look: 'viking_male',
      lx: 6.8,
      lz: 5,
      facing: 0,
      lines: ['Stone does not move for you. You move around it.'],
    },
  ]);
  return {
    theme: 'marrow',
    walls: [
      wall(-3, 11, 7, 0.5, 'boulder'),
      wall(3, 7, 7, 0.5, 'boulder'),
      wall(-3, 3, 7, 0.5, 'boulder'),
      ...leaderWall('boulder'),
    ],
    gates: [
      gate(`${c.id}.gate.g1`, rect(7, 11, 3, 0.5), [T(c, 't1')], 'boulder'),
      gate(`${c.id}.gate.g2`, rect(7, 3, 3, 0.5), [T(c, 't2')], 'boulder'),
      leaderGate(c, [T(c, 't1'), T(c, 't2'), S(c, 'keystone')], 'boulder'),
    ],
    switches: [sw(c, 'keystone', 'keystone', -8.6, 0.3, [T(c, 't2')], 'Set the keystone')],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('crystal', -8.8, 9),
      prop('crystal', 8.8, 5.2),
      prop('minecart', -8.4, 13.5),
    ],
  };
}

/** Ghost — Vesperveil: sealed cells joined only by teleport tiles; two decoys send you back. */
function ghostGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Medium Orla',
      look: 'old_classy_female',
      lx: -5,
      lz: 12.4,
      facing: 0,
      lines: ['The floor here is a door, if you ask it nicely.'],
    },
    {
      local: 't2',
      name: 'Hexer Vane',
      look: 'ninja_male',
      lx: -3,
      lz: 8.4,
      facing: Math.PI / 2,
      lines: ['You came through the dark on purpose? Brave. Or lost.'],
    },
  ]);
  return {
    theme: 'vesper',
    walls: [
      wall(0, 10, 10, 0.3, 'wall'),
      wall(0, 7, 0.3, 3, 'wall'),
      wall(0, 4, 10, 0.3, 'wall'),
      ...leaderWall('wall'),
    ],
    gates: [
      leaderGate(
        c,
        [T(c, 't1'), T(c, 't2'), S(c, 'tile_1'), S(c, 'tile_2'), S(c, 'tile_3')],
        'rune',
      ),
    ],
    switches: [
      sw(c, 'tile_1', 'tile', 5, 12.4, [T(c, 't1')], 'Step on the rune', { warpTo: pt(-5, 7) }),
      sw(c, 'tile_2', 'tile', -8.6, 5.4, [T(c, 't2')], 'Step on the rune', { warpTo: pt(5, 7) }),
      sw(c, 'decoy_1', 'tile', -2.2, 5.2, [], 'Step on the rune', {
        sets: false,
        warpTo: pt(0, 14.2),
      }),
      sw(c, 'tile_3', 'tile', 8.6, 8.6, [S(c, 'tile_2')], 'Step on the rune', {
        warpTo: pt(0, 0.6),
      }),
      sw(c, 'decoy_2', 'tile', 2.2, 5.2, [], 'Step on the rune', {
        sets: false,
        warpTo: pt(-5, 7),
      }),
      sw(c, 'return', 'tile', -8.6, 0.6, [], 'Step on the rune', {
        sets: false,
        warpTo: pt(0, 14.2),
      }),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('candles', -8.8, 15.6),
      prop('candles', 8.8, 15.6),
      prop('candles', 8.8, 1.8),
      prop('mirror', 9.4, 7),
    ],
  };
}

/** Steel — Forgewall: three anvils struck in order raise two portcullises. */
function steelGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Apprentice Corr',
      look: 'knight_male',
      lx: 3,
      lz: 11,
      facing: 0,
      lines: ['Strike true or do not strike at all.'],
    },
    {
      local: 't2',
      name: 'Smith Hale',
      look: 'soldier_male',
      lx: 8,
      lz: 6.6,
      facing: 0,
      lines: ['Iron remembers the hammer. So will you.'],
    },
    {
      local: 't3',
      name: 'Armourer Brisk',
      look: 'blue_soldier_male',
      lx: 3.5,
      lz: 1.5,
      facing: 0,
      lines: ['The Marshal sees you only if you pass me.'],
    },
  ]);
  return {
    theme: 'forge',
    walls: [...crossWall(9, 1.5, 'iron'), wall(-1.75, 4, 8.25, 0.3, 'iron'), ...leaderWall('iron')],
    gates: [
      gate(`${c.id}.gate.d1`, rect(0, 9, 1.5, 0.3), [T(c, 't1'), S(c, 'anvil_1')], 'portcullis'),
      gate(
        `${c.id}.gate.d2`,
        rect(8.25, 4, 1.75, 0.3),
        [S(c, 'anvil_2'), T(c, 't2')],
        'portcullis',
      ),
      leaderGate(
        c,
        [T(c, 't1'), T(c, 't2'), T(c, 't3'), S(c, 'anvil_1'), S(c, 'anvil_2'), S(c, 'anvil_3')],
        'portcullis',
      ),
    ],
    switches: [
      sw(c, 'anvil_1', 'anvil', -7.5, 11.6, [], 'Strike the anvil'),
      sw(c, 'anvil_2', 'anvil', -7.5, 5.8, [S(c, 'anvil_1'), T(c, 't1')], 'Strike the anvil'),
      sw(c, 'anvil_3', 'anvil', -7.5, 1, [S(c, 'anvil_2'), T(c, 't2')], 'Strike the anvil'),
    ],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('forge', -8.6, 14),
      prop('weapon_rack', 8.8, 14.5),
      prop('weapon_rack', -8.8, 6.6),
    ],
  };
}

/** Dragon — Skyrend: a bridge over the clouds, three trainers holding three gates. */
function dragonGym(c: Ctx, leader: LeagueTrainer): GymDesign {
  const trainers = gymTrainers(c, leader, [
    {
      local: 't1',
      name: 'Wingward Sora',
      look: 'kimono_male',
      lx: 0,
      lz: 11,
      facing: 0,
      lines: ['The bridge is narrow. The fall is not.'],
    },
    {
      local: 't2',
      name: 'Skyreader Lin',
      look: 'casual2_female',
      lx: 0,
      lz: 7,
      facing: 0,
      lines: ['Halfway. Most turn back here.'],
    },
    {
      local: 't3',
      name: 'Drakeherd Oro',
      look: 'old_classy_male',
      lx: 0,
      lz: 3,
      facing: 0,
      lines: ['Sylvane is watching. Make it worth her time.'],
    },
  ]);
  return {
    theme: 'sky',
    walls: [wall(-5.9, 5, 4.1, 7, 'chasm'), wall(5.9, 5, 4.1, 7, 'chasm'), ...leaderWall('wall')],
    gates: [
      gate(`${c.id}.gate.g1`, rect(0, 9.5, 1.8, 0.3), [T(c, 't1')], 'rune'),
      gate(`${c.id}.gate.g2`, rect(0, 5.5, 1.8, 0.3), [T(c, 't2')], 'rune'),
      gate(`${c.id}.gate.g3`, rect(0, 1.5, 1.8, 0.3), [T(c, 't3')], 'rune'),
      leaderGate(c, [T(c, 't1'), T(c, 't2'), T(c, 't3')], 'rune'),
    ],
    switches: [],
    trainers,
    props: [
      ...foyerDressing(),
      ...chamberDressing(),
      prop('bridge', 0, 5, 0, 1),
      prop('cloud', -6, 8),
      prop('cloud', 6, 3),
      prop('cloud', -5, 1),
    ],
  };
}

const GYM_DESIGNS: Readonly<Record<string, (c: Ctx, l: LeagueTrainer) => GymDesign>> = {
  verdant_gym: grassGym,
  blaze_gym: fireGym,
  tidal_gym: waterGym,
  volt_gym: electricGym,
  stone_gym: rockGym,
  phantom_gym: ghostGym,
  iron_gym: steelGym,
  draco_gym: dragonGym,
};

export function gymHall(
  zoneId: ZoneId,
  building: string,
  label: string,
  leader: LeagueTrainer,
): InteriorDef {
  const design = GYM_DESIGNS[leader.id];
  if (design === undefined) throw new RangeError(`no gym design for '${leader.id}'`);
  const c: Ctx = { zoneId, id: building };
  const g = design(c, leader);
  const half = GYM_HALL.d / 2;
  return {
    id: building,
    zoneId,
    building,
    template: 'gym_hall',
    theme: g.theme,
    label,
    w: GYM_HALL.w,
    d: GYM_HALL.d,
    entry: pt(0, half - 2.4),
    exit: pt(0, half - 0.8),
    rooms: [gymRoom(leader)],
    walls: g.walls,
    gates: g.gates,
    switches: g.switches,
    trainers: g.trainers,
    npcs: [
      {
        id: `${building}.guide`,
        name: 'Gym Guide',
        lx: -3.2,
        lz: half - 2.6,
        facing: 0,
        look: 'suit_male',
        role: 'guide',
        lines: [
          `${leader.name} waits at the far end. Beat the trainers and solve the hall, and the last gate opens.`,
        ],
      },
    ],
    items: [],
    props: g.props,
  };
}

// ─── league hall ─────────────────────────────────────────────────────────────

/** The four chambers in fight order: Wardens 1–3, then the Champion. */
export function leagueHall(
  zoneId: ZoneId,
  building: string,
  label: string,
  order: readonly LeagueTrainer[],
): InteriorDef {
  const L = LEAGUE_HALL;
  const half = L.d / 2;
  const c: Ctx = { zoneId, id: building };
  const rooms: InteriorRoom[] = [];
  const walls: InteriorWall[] = [...crossWall(half - L.foyer, 2, 'wall')];
  const gates: InteriorGate[] = [];
  const props: InteriorProp[] = [
    prop('statue', -8, half - 1.8),
    prop('statue', 8, half - 1.8),
    prop('rug', 0, half - 3, 0, 1.4),
  ];
  order.forEach((l, k) => {
    const top = half - L.foyer - k * L.chamber;
    const zc = top - L.chamber / 2;
    rooms.push({
      id: `chamber${k + 1}`,
      arena: pt(0, zc),
      leader: l.id,
      leaderAt: pt(0, zc - 4.2),
      bounds: rect(0, zc, 10, L.chamber / 2),
    });
    const bottom = top - L.chamber;
    if (k < order.length - 1) {
      walls.push(...crossWall(bottom, 2, 'wall'));
      gates.push(
        gate(`${c.id}.gate.c${k + 1}`, rect(0, bottom, 2, 0.3), [...l.setsFlags], 'portcullis'),
      );
    }
    props.push(
      prop('pillar', -8.6, top - 1.6),
      prop('pillar', 8.6, top - 1.6),
      prop('pillar', -8.6, bottom + 1.6),
      prop('pillar', 8.6, bottom + 1.6),
    );
    props.push(
      prop('banner', -4.5, bottom + 0.6),
      prop('banner', 4.5, bottom + 0.6),
      prop('brazier', -3, zc - 6),
      prop('brazier', 3, zc - 6),
    );
  });
  props.push(prop('throne', 0, -half + 1.4));
  return {
    id: building,
    zoneId,
    building,
    template: 'league_hall',
    theme: 'league',
    label,
    w: L.w,
    d: L.d,
    entry: pt(0, half - 2.4),
    exit: pt(0, half - 0.8),
    rooms,
    walls,
    gates,
    switches: [],
    trainers: [],
    npcs: [
      {
        id: `${building}.nurse`,
        name: 'League Nurse',
        lx: -6.5,
        lz: half - 3,
        facing: Math.PI / 2,
        look: 'doctor_female_young',
        role: 'nurse',
        lines: ['Rest here between chambers. Your team will be ready.'],
      },
      {
        id: `${building}.guide`,
        name: 'Herald',
        lx: 6.5,
        lz: half - 3,
        facing: -Math.PI / 2,
        look: 'suit_male',
        role: 'guide',
        lines: ['Three Wardens, then the Champion. Each door opens for those who passed the last.'],
      },
    ],
    items: [],
    props,
  };
}

// ─── shop / healer ───────────────────────────────────────────────────────────

function counterHall(
  zoneId: ZoneId,
  building: string,
  label: string,
  kind: 'shop' | 'healer',
): InteriorDef {
  const { w, d } = SHOP_HALL;
  const half = d / 2;
  const walls: InteriorWall[] = [
    wall(0, -1.2, 2.6, 0.45, 'counter'),
    wall(0, -3.6, 4.6, 0.35, 'wall'),
  ];
  const props: InteriorProp[] = [
    prop('counter', 0, -1.2, 0, 1),
    prop('rug', 0, 1.4, 0, 0.9),
    prop('plant', 4.2, 3.2),
    prop('plant', -4.2, 3.2),
  ];
  if (kind === 'shop')
    props.push(
      prop('shelf', -3, -3.6),
      prop('shelf', 0, -3.6),
      prop('shelf', 3, -3.6),
      prop('crate', 4.2, 1.2),
      prop('barrel', -4.2, 1.2),
    );
  else {
    walls.push(wall(-4.45, 1.2, 0.4, 0.5, 'wall'));
    props.push(
      prop('cabinet', -2.5, -3.6),
      prop('cabinet', 2.5, -3.6),
      prop('pc', -4.45, 1.2, Math.PI / 2),
      prop('bench', 4.2, 1.2, -Math.PI / 2),
    );
  }
  const npc: InteriorNpc =
    kind === 'shop'
      ? {
          id: `${building}.keeper`,
          name: 'Shopkeeper',
          lx: 0,
          lz: -2.4,
          facing: 0,
          look: 'casual_male',
          role: 'shopkeeper',
          lines: ['Welcome! Take a look.'],
        }
      : {
          id: `${building}.nurse`,
          name: 'Healer',
          lx: 0,
          lz: -2.4,
          facing: 0,
          look: 'doctor_female_young',
          role: 'nurse',
          lines: ['Shall I look after your team?'],
        };
  return {
    id: building,
    zoneId,
    building,
    template: kind,
    theme: kind,
    label,
    w,
    d,
    entry: pt(0, half - 1.4),
    exit: pt(0, half - 0.6),
    rooms: [],
    walls,
    gates: [],
    switches: [],
    trainers: [],
    npcs: [npc],
    items: [],
    props,
  };
}
export const shopHall = (zoneId: ZoneId, building: string, label: string): InteriorDef =>
  counterHall(zoneId, building, label, 'shop');
export const healerHall = (zoneId: ZoneId, building: string, label: string): InteriorDef =>
  counterHall(zoneId, building, label, 'healer');

// ─── houses ──────────────────────────────────────────────────────────────────

const RESIDENT_NAMES = [
  'Alder',
  'Briony',
  'Cass',
  'Dell',
  'Edda',
  'Faro',
  'Gwen',
  'Hob',
  'Ines',
  'Jory',
  'Kesh',
  'Linnet',
  'Maddox',
  'Nell',
  'Osric',
  'Pim',
  'Quill',
  'Rosamund',
  'Sten',
  'Tamsin',
  'Ulla',
  'Vic',
  'Wren',
  'Yarrow',
  'Zelda',
  'Bram',
  'Cora',
  'Dunstan',
  'Elsie',
  'Fennick',
] as const;
const RESIDENT_LOOKS = [
  'casual_male',
  'casual_female',
  'casual2_male',
  'casual2_female',
  'casual3_male',
  'cowboy_male',
  'cowboy_female',
  'old_classy_male',
  'old_classy_female',
  'suit_male',
  'kimono_male',
] as const;

/** Town-flavoured small talk, by town. */
const RESIDENT_LINES: Readonly<Partial<Record<ZoneId, readonly string[]>>> = {
  mirevale: [
    'The heart-tree hums at night if you listen.',
    'My gran swore the grove used to be twice as wide.',
    'Mira trains in the hedge hall. You can hear the leaves rustle from here.',
    'Mud on the boots means you have been somewhere, my father said.',
    "Prof. Wynn's lab light is on at all hours. I don't think he sleeps.",
    'The mire route floods every spring. Bring dry socks.',
    'My boy caught his first Ewamon by the old lantern. Cried for a week when it evolved.',
    "Count the rings on a fallen grove-oak sometime. You'll run out of fingers.",
  ],
  cinderhold: [
    'Keep the shutters closed on ash days.',
    'The caldera glows brighter every winter. Nobody says why.',
    'Karn eats his breakfast next to the furnace. Every day.',
    'If your tea is cold, you live in the wrong town.',
    'The Office men took readings at the caldera again. They never say what they read.',
    'Ash on the windowsill, ash in the bread, ash in my hair. Home.',
    'My grandfather forged the first gate hinge in town. Still swings true.',
    'Fire-types sleep curled on the hearthstones. Mind your step at night.',
  ],
  saltmourn: [
    'The harbour used to hold forty boats. Count them now.',
    'Salt gets into everything. Even the bread.',
    'Captain Maren can read the tide by the smell of it.',
    'Fog rolls in at dusk. Stay off the old pier.',
    "Maren's lighthouse never misses a night. Not one in twenty years.",
    "We used to dry fish on every roof. Now it's mostly gulls.",
    'The old harbour is under that water. You can see the chimneys at low tide.',
    'Never whistle on a boat. The sea takes it as an invitation.',
  ],
  stormrook: [
    'The coil tower sings before a storm.',
    'My lamps flicker whenever the grid draws hard.',
    'Zia rewired the whole street in one night once.',
    'Lightning never strikes twice here. It strikes nine times.',
    'The grid hums louder every month. My teeth feel it.',
    'Rain falls sideways here. We built the gutters sideways too.',
    'My cousin works the substation. She glows a little after a double shift.',
    'When the coil tower goes quiet, everyone goes quiet with it.',
  ],
  marrowdig: [
    'Hear that tapping? The mine never sleeps.',
    'My brother found a crystal the size of a fist. Sold it for soup.',
    'Petra can tell a seam by the sound of a pebble.',
    'Mind the low beams. Everyone here has the same bruise.',
    'The mine whistle blows at noon. Set your clock by it.',
    "Deeper seams, smaller lamps. That's the rule down there.",
    "We carve our names in the tunnel walls. Mine's on level four.",
    'Rock-types sun themselves on the spoil heaps. Lazy beasts. Lovely, though.',
  ],
  vesperveil: [
    'Do not answer if someone knocks three times after dark.',
    'The candles here burn blue on quiet nights.',
    'Nyx once told me my future. I am still waiting for it.',
    'Old houses remember. This one remembers too much.',
    "Leave a candle in the window. It's polite to the ones who walk at night.",
    "My mirror shows the room a second late. I've stopped minding.",
    'The fog keeps secrets better than any priest.',
    'Ghost-types steal socks. Only the left one. Nobody knows why.',
  ],
  forgewall: [
    'The gate has not closed in a hundred years.',
    'You can tell a Forgewall smith by the burns on the left hand.',
    'Marshal Rell inspects the walls every dawn.',
    'Iron is honest. People less so.',
    'The siege bells were rung for drills when I was young. Now they ring for real.',
    "Every brick in the wall has a smith's mark. Find mine and I'll buy you a pie.",
    'The furnaces never go cold. Not even on holidays.',
    'Steel-types polish themselves on the anvils at night. You can hear them ring.',
  ],
  skyrend: [
    'The wind up here takes your hat and your manners.',
    'Clouds come through the window some mornings.',
    'Sylvane flies out at dawn. Back by dusk, always.',
    'Breathe slow. The air is thin and the stairs are long.',
    "The stair has nine hundred steps. I've counted them every day for forty years.",
    'Up here the stars are close enough to argue with.',
    'Dragon-types circle the peak at dawn. Best alarm clock there is.',
    'We hang wind-chimes for the ones who fell. There are a lot of chimes.',
  ],
  solenne: [
    'The cathedral bells count the hours and the Office counts the rest.',
    'Everyone in the capital is in a hurry to be somewhere.',
    'They say the Champion has never lost a home match.',
    'Bread is twice the price it was. The Office says it is temporary.',
    'The Ledger is open to anyone. Hardly anyone reads it.',
    'The Wardens walk the cathedral steps at dusk. Nobody stops them to chat.',
    "Market prices are posted every morning. Every morning they're higher.",
    'My grandmother says the city once forgot its own name for a day. She laughs when she says it.',
  ],
};
const HOUSE_ITEMS = [
  'potion',
  'superpotion',
  'repel',
  'revive',
  'escape_rope',
  'full_heal',
  'nugget',
  'rarecandy',
] as const;

/** fnv-1a of a string, for stream-free picks. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function houseHall(
  zoneId: ZoneId,
  building: string,
  label: string,
  size: 's' | 'm',
  townIndex: number,
): InteriorDef {
  const { w, d } = size === 's' ? HOUSE_S : HOUSE_M;
  const hw = w / 2;
  const hd = d / 2;
  const h = hashString(building);
  const mirror = (h & 1) === 1 ? -1 : 1;
  const walls: InteriorWall[] = [
    wall(mirror * (hw - 1.1), -hd + 1.3, 0.9, 1.15, 'wall'), // bed
    wall(mirror * -(hw - 1.4), -hd + 0.6, 1.2, 0.3, 'wall'), // bookshelf
    wall(mirror * 0.6, -0.4, 0.75, 0.55, 'wall'), // table
  ];
  const props: InteriorProp[] = [
    prop('bed', mirror * (hw - 1.1), -hd + 1.3, 0),
    prop('bookshelf', mirror * -(hw - 1.4), -hd + 0.45, 0),
    prop('table', mirror * 0.6, -0.4),
    prop('chair', mirror * 0.6, 0.55, Math.PI),
    prop('rug', 0, 0.8, 0, 0.8),
    prop('plant', mirror * (hw - 0.6), hd - 0.8),
    prop('lamp', mirror * -(hw - 0.6), hd - 1.2),
  ];
  if (size === 'm') {
    walls.push(wall(mirror * -(hw - 0.55), 0.6, 0.35, 0.8, 'wall'));
    props.push(prop('cabinet', mirror * -(hw - 0.55), 0.6, (mirror * Math.PI) / 2));
  }
  const pool = RESIDENT_LINES[zoneId] ?? RESIDENT_LINES.mirevale!;
  // each house of a town starts on its own line and name (house index k; 3 and 7 are coprime with the pool sizes)
  const k = Number(/house(\d+)$/.exec(building)?.[1] ?? 0);
  const nLines = 1 + ((h >>> 3) % 3);
  const lines = Array.from({ length: nLines }, (_, j) => pool[(k + j * 3) % pool.length]!);
  const resident: InteriorNpc = {
    id: `${building}.resident`,
    name: RESIDENT_NAMES[(townIndex * 5 + k * 7) % RESIDENT_NAMES.length]!,
    lx: mirror * -1.6,
    lz: -hd + 2.2,
    facing: 0,
    look: RESIDENT_LOOKS[(h >>> 14) % RESIDENT_LOOKS.length]!,
    role: 'resident',
    lines,
  };
  const items: InteriorItem[] = [];
  if ((h >>> 19) % 3 === 0) {
    const pick = Math.min(HOUSE_ITEMS.length - 1, ((h >>> 21) % 5) + Math.floor(townIndex / 3));
    items.push({
      id: `${building}.item`,
      lx: mirror * (hw - 0.9),
      lz: hd - 2.2,
      item: HOUSE_ITEMS[pick]!,
      qty: 1,
    });
  }
  return {
    id: building,
    zoneId,
    building,
    template: size === 's' ? 'house_s' : 'house_m',
    theme: 'house',
    label,
    w,
    d,
    entry: pt(0, hd - 1.4),
    exit: pt(0, hd - 0.6),
    rooms: [],
    walls,
    gates: [],
    switches: [],
    trainers: [],
    npcs: [resident],
    items,
    props,
  };
}
