/**
 * The four relic shrines (the Harmonic Cycle, postgame): one house hall in each elemental town becomes a shrine with
 * the zone's own dressing. The hall and its footprint are the house's (template, size and door unchanged), so no zone
 * reshuffles; only what stands inside changes, the way the Daycare and the bounty board take over a hall.
 *
 * Inside, from the door: the shrine keeper; a rune gate that opens once the Champion is beaten; the elemental guardian
 * (it fights only after the Champion, `requires`); a second rune gate that opens once the guardian is beaten; the relic
 * on its altar (taken only after the guardian, `requires`). The interact range reaches past a closed gate, so the
 * trainer and the item carry the same flags as the gates in front of them.
 */
import type { InteriorDef, InteriorTheme, ZoneId } from '../types';
import { interiorTrainerFlag } from './interiors';
import { POSTGAME_FLAG } from './league';
import { BADGERMOLE_GEM, SKY_BISON_WHISTLE, SPIRIT_KOI_SCALE, SUN_DRAGON_EMBER } from './relics';

export interface ShrineDef {
  readonly zoneId: ZoneId;
  /** the house hall it takes over (a 9 × 8 m `house_m`) */
  readonly building: string;
  readonly label: string;
  readonly theme: InteriorTheme;
  readonly relic: string;
  readonly keeper: { readonly name: string; readonly look: string; readonly lines: readonly string[] };
  readonly guardian: {
    readonly name: string;
    readonly look: string;
    readonly team: readonly { readonly species: string; readonly level: number }[];
    readonly lines: readonly string[];
    readonly reward: number;
  };
  /** dressing: element props along the walls */
  readonly props: readonly string[];
}

export const SHRINES: readonly ShrineDef[] = [
  {
    zoneId: 'saltmourn',
    building: 'saltmourn.house4',
    label: 'the Tide Shrine',
    theme: 'salt',
    relic: SPIRIT_KOI_SCALE,
    keeper: {
      name: 'Oona, keeper of the Tide Shrine',
      look: 'old_classy_female',
      lines: [
        'Four relics, four shrines. The old masters left one in every town that kept its element close.',
        'The scale waits behind the guardian. It only answers someone the League already answers to.',
      ],
    },
    guardian: {
      name: 'Tide Guardian Maelis',
      look: 'casual_female',
      team: [{ species: 'frofloe', level: 68 }, { species: 'tsunamite', level: 70 }, { species: 'abyssrake', level: 72 }],
      lines: ['Water does not push back. It lets you in, then it decides. Show me you can hold it.'],
      reward: 9000,
    },
    props: ['anchor', 'crystal', 'candles'],
  },
  {
    zoneId: 'marrowdig',
    building: 'marrowdig.house4',
    label: 'the Stone Shrine',
    theme: 'marrow',
    relic: BADGERMOLE_GEM,
    keeper: {
      name: 'Brask, keeper of the Stone Shrine',
      look: 'old_classy_male',
      lines: [
        'The gem hums. Put your hand on the floor and you can feel it in your teeth.',
        'Beat the Champion first. The guardian will not waste a stone on anyone less.',
      ],
    },
    guardian: {
      name: 'Stone Guardian Torvald',
      look: 'casual3_male',
      team: [{ species: 'trenchtusk', level: 68 }, { species: 'geoboxer', level: 70 }, { species: 'prismolith', level: 72 }],
      lines: ['Earth waits. It has waited longer than you have been alive. Let us see who moves first.'],
      reward: 9000,
    },
    props: ['crystal', 'pillar', 'minecart'],
  },
  {
    zoneId: 'cinderhold',
    building: 'cinderhold.house3',
    label: 'the Flame Shrine',
    theme: 'cinder',
    relic: SUN_DRAGON_EMBER,
    keeper: {
      name: 'Ashe, keeper of the Flame Shrine',
      look: 'old_classy_male',
      lines: [
        'That ember has not gone out since before the caldera had a name. Fire is not for burning things down, you know. It is for keeping things alive.',
        'Come back with the Champion behind you. The guardian burns hotter than the Yard.',
      ],
    },
    guardian: {
      name: 'Flame Guardian Ignatia',
      look: 'casual_female',
      team: [{ species: 'magmolith', level: 68 }, { species: 'pyrothal', level: 70 }, { species: 'moblaze', level: 72 }],
      lines: ['Breathe. Fire comes from the breath, not the fist. Now, show me yours.'],
      reward: 9000,
    },
    props: ['brazier', 'brazier', 'candles'],
  },
  {
    zoneId: 'skyrend',
    building: 'skyrend.house4',
    label: 'the Wind Shrine',
    theme: 'sky',
    relic: SKY_BISON_WHISTLE,
    keeper: {
      name: 'Pemma, keeper of the Wind Shrine',
      look: 'old_classy_female',
      lines: [
        'Blow the whistle and something very large and very kind used to come. Now it only catches the draft.',
        'The guardian flies for no one but a Champion. Neither does the whistle.',
      ],
    },
    guardian: {
      name: 'Wind Guardian Tashi',
      look: 'casual3_male',
      team: [{ species: 'thundrix', level: 68 }, { species: 'rexaloft', level: 70 }, { species: 'rivetalon', level: 72 }],
      lines: ['Air is freedom. You cannot hold it, only move with it. Try to keep up.'],
      reward: 9000,
    },
    props: ['cloud', 'banner', 'candles'],
  },
];

/** The relic's pickup flag (`item:<zone>:<item id>`, the server's scheme): quest q14 counts the four. */
export function shrineRelicFlag(s: ShrineDef): string {
  return `item:${s.zoneId}:${s.building}.relic`;
}

/** The guardian's trainer id and beaten flag. */
export function shrineGuardianId(s: ShrineDef): string {
  return `${s.building}.guardian`;
}

const HW = 4.5;
const HD = 4;
/** z of the two rune walls (local frame, the door on +z) and the half width of their gates */
const GATE_Z = [1, -2] as const;
const GAP = 1;

/** The shrine that takes over this hall, or the hall itself when none does. */
export function withShrine(def: InteriorDef): InteriorDef {
  const s = SHRINES.find((x) => x.building === def.building);
  if (s === undefined) return def;
  if (def.template !== 'house_m' || def.w !== HW * 2 || def.d !== HD * 2) throw new Error(`shrine ${s.building}: expects a 9 × 8 house hall`);
  const beaten = interiorTrainerFlag(shrineGuardianId(s));
  const seg = (HW - GAP) / 2;
  const crossWall = (z: number): InteriorDef['walls'] => [
    { lx: -(GAP + seg), lz: z, hw: seg, hd: 0.25, style: 'wall' },
    { lx: GAP + seg, lz: z, hw: seg, hd: 0.25, style: 'wall' },
  ];
  const [a, b, c] = s.props;
  return {
    ...def,
    theme: s.theme,
    label: s.label,
    fightsAtDoor: true,
    walls: [...crossWall(GATE_Z[0]), ...crossWall(GATE_Z[1]), { lx: 0, lz: -HD + 0.45, hw: 0.8, hd: 0.35, style: 'wall' }],
    gates: [
      { id: `${s.building}.gate.outer`, rect: { lx: 0, lz: GATE_Z[0], hw: GAP, hd: 0.25 }, opensWhen: [POSTGAME_FLAG], style: 'rune' },
      { id: `${s.building}.gate.inner`, rect: { lx: 0, lz: GATE_Z[1], hw: GAP, hd: 0.25 }, opensWhen: [beaten], style: 'rune' },
    ],
    switches: [],
    trainers: [
      {
        id: shrineGuardianId(s),
        name: s.guardian.name,
        lx: 0,
        lz: -0.6,
        facing: 0,
        look: s.guardian.look,
        team: s.guardian.team,
        lines: s.guardian.lines,
        reward: s.guardian.reward,
        requires: [POSTGAME_FLAG],
      },
    ],
    npcs: [
      { id: `${s.building}.keeper`, name: s.keeper.name, lx: -2.6, lz: 2.2, facing: 0, look: s.keeper.look, lines: s.keeper.lines, role: 'guide' },
    ],
    items: [{ id: `${s.building}.relic`, lx: 0, lz: -HD + 1.1, item: s.relic, qty: 1, requires: [beaten] }],
    props: [
      { kind: 'statue', lx: 0, lz: -HD + 0.45, yaw: 0, scale: 0.9 },
      { kind: a ?? 'candles', lx: -(HW - 0.7), lz: -HD + 0.8, yaw: 0, scale: 1 },
      { kind: b ?? 'candles', lx: HW - 0.7, lz: -HD + 0.8, yaw: 0, scale: 1 },
      { kind: c ?? 'candles', lx: HW - 0.8, lz: 2.4, yaw: 0, scale: 0.8 },
      { kind: 'rug', lx: 0, lz: 2.6, yaw: 0, scale: 0.8 },
    ],
  };
}
