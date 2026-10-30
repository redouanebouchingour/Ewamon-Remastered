/**
 * Team Ewamon HQ (addition 2026-10-30): Mirevale's house 5 is the office of the four students who built the very first
 * Ewamon in 2022, the HvA EWA (Enterprise Web Application) project: Red1 (the frontend, every Ewamon drawn in pixel
 * art), Internet Friend (the database, JWT, deployment), King Smali (the shop, the wallet, features) and Mr Ching (the
 * lead, the whole battle system). They sit at one 4-person desk, chat over their heads in a loop while the player is
 * inside (client `BanterBubble`), and each one talks (their lines, then the LLM with a persona of their own). Their own
 * Ewamon stand beside their chairs, and the pinned board on the back wall reads the Discord task list and the grade.
 *
 * A redress of an existing hall, like the relic shrines: `withDevTeam` keeps the template, size, entry and exit, so no
 * pocket moves and the zone plan stays byte-identical. The four and the desk are rigged OpenSCAD models
 * (`tools/creature-models --npc`, served from `/npc-models/`), placed by the client in the pocket's frame. Talking to
 * all four completes the achievement `ach_original_party` (the server resolves these interior NPCs for `talkTo`).
 * Never a story gate.
 *
 * The lines and personas follow Red1 and Yasser's own retelling (2026-10-30): Yasin the leader with the short fuse,
 * Mohaned the one who always gets blamed (and the kapsalon run), Yasser the cheerful "neutral" one with the if
 * statements, Red1 the youngest and the clown. On some visits Mohaned is out delivering kapsalons (`DEV_TEAM.away`):
 * his chair stands empty and the others' banter is about him. The twelve original 2022 species are `OG_2022_SPECIES`
 * (the Ewadex marks them).
 */
import type { InteriorBoard, InteriorDef, InteriorNpc, InteriorPlacement } from '../types';
import { toWorld } from '../plan';

export const DEV_TEAM_HOUSE = 'mirevale.house5';

/** One of the four: their NPC (local frame, the door on +z), their model and the Ewamon beside their chair. */
export interface DevTeamMember {
  readonly npc: InteriorNpc & { readonly persona: string; readonly model: string };
  /** the model's height in metres (the GLB is normalised to 1 m): the standing scad's, the rig seats them */
  readonly heightM: number;
  /** where their speech bubble starts (m over the floor): the seated head */
  readonly headM: number;
  readonly pet: { readonly species: string; readonly lx: number; readonly lz: number };
}

/** One speech bubble of their banter: `by` is a member's NPC id. */
export interface DevTeamBanterLine {
  readonly by: string;
  readonly text: string;
}

export interface DevTeam {
  readonly interior: string;
  /** the desk set (desk, chairs with jackets, monitors): its model, local spot and yaw, height */
  readonly desk: { readonly model: string; readonly lx: number; readonly lz: number; readonly yaw: number; readonly heightM: number };
  readonly members: readonly DevTeamMember[];
  readonly banter: readonly DevTeamBanterLine[];
  /**
   * Mohaned's kapsalon run: on a visit, with `chance` (the client rolls once per entry), `member`'s chair stands empty,
   * his model and his "Talk to" are gone, and the others chat `banter` instead (never by `member`).
   */
  readonly away: { readonly member: string; readonly chance: number; readonly banter: readonly DevTeamBanterLine[] };
  readonly board: InteriorBoard;
}

const HW = 4.5;
const HD = 4;
/**
 * The desk's centre (local). Its model (tools/creature-models `scad/npc/ewa_desk.scad`) runs its long axis along scad X;
 * turned π/2 it runs along local −z, so scad seat (x, y) lands at local (−y, −x) / 100.
 */
const DESK = { lx: 0, lz: -0.9, yaw: Math.PI / 2 } as const;
/** a sitter's origin (their feet) from the desk centre: across the desk (x) and along it (z); ewa_desk.scad's (±50, ±56) cm */
const SEAT_X = 0.56;
const SEAT_Z = 0.5;
/** a seated head is this much lower than the standing model's top (the rig drops the hips onto a 46 cm seat) */
const SEATED_DROP_M = 0.55;
/** the pets stand outboard of the chairs */
const PET_X = 2.3;

const id = (k: string): string => `${DEV_TEAM_HOUSE}.${k}`;
export const RED1 = id('red1');
export const MOHANED = id('mohaned');
export const YASSER = id('yasser');
export const YASIN = id('yasin');

interface Seat {
  readonly key: string;
  readonly name: string;
  readonly model: string;
  readonly heightM: number;
  /** west (−x) faces +x across the desk, east faces −x (ewa_desk.scad: Red1 and Yasin share a side) */
  readonly side: -1 | 1;
  /** +1 the door end of the desk, −1 the back end */
  readonly end: -1 | 1;
  readonly pet: string;
  readonly persona: string;
  readonly lines: readonly string[];
}

const seat = (s: Seat): DevTeamMember => ({
  heightM: s.heightM,
  headM: s.heightM - SEATED_DROP_M,
  pet: { species: s.pet, lx: s.side * PET_X, lz: DESK.lz + s.end * (SEAT_Z + 0.15) },
  npc: {
    id: id(s.key),
    name: s.name,
    lx: s.side * SEAT_X,
    lz: DESK.lz + s.end * SEAT_Z,
    // facing atan2(dx, dz): the west side looks +x, the east side −x
    facing: s.side < 0 ? Math.PI / 2 : -Math.PI / 2,
    look: 'suit_male',
    role: 'resident',
    model: s.model,
    persona: s.persona,
    lines: s.lines,
  },
});

export const DEV_TEAM: DevTeam = {
  interior: DEV_TEAM_HOUSE,
  desk: { model: 'ewa_desk', lx: DESK.lx, lz: DESK.lz, yaw: DESK.yaw, heightM: 1.242 },
  members: [
    seat({
      key: 'red1', name: 'Red1', model: 'ewa_red1', heightM: 1.951, side: 1, end: 1, pet: 'darkone',
      persona:
        'Red1 (Redouane), the youngest of the four HvA students who built the first Ewamon in 2022 for the EWA project. ' +
        'The designer, the frontender, the sprite maker and the battle frontend: you drew every Ewamon in pixel art (Darkone is you, Moflame you made to roast Mohaned). ' +
        'Being the youngest you are the clown: you troll, you are a bit annoying, and you sneakily send Yasser dumb gifs about the beef between Mohaned and Yasin. ' +
        'When the loop broke you built the whole Ewadex out of if statements, and you defend it: bro, if it works, it works',
      lines: [
        'Ewa! Welcome to the EWA room. Hogeschool van Amsterdam, Enterprise Web Application. Every other team made a card game. We made a whole game.',
        'Designer, frontender, sprite maker, battle frontend. Everything you see in here, I drew. Front sprites and back sprites, pixel by pixel.',
        'Darkone is me. Moflame is Mohaned, because we flame him. Yaschamp is Yasin, Resilian is Yasser backwards.',
        'We have a professor now, Prof. Wynn. Nice lady. But the original EWA professor? Ian Fordbred. Gave me a study delay. Half of Ewamon got one. We do not forgive.',
        'The Ewadex was one big pile of if statements. If number 1, if number 2... The loop broke, the ifs did not. Bro, if it works, it works.',
        'Back then we designed a whole world map. Never used it, nobody knew how to make a map. Look at us now.',
        'Yo, I saw a groovy steal time on the route the other day. If you know, you know.',
        'I am the youngest, so I am the clown. Somebody has to send the gifs.',
      ],
    }),
    seat({
      key: 'mohaned', name: 'Internet Friend', model: 'ewa_mohaned', heightM: 1.918, side: -1, end: 1, pet: 'moflame',
      persona:
        'Mohaned, called Internet Friend, one of the four HvA students who built the first Ewamon in 2022. ' +
        'You did the database, JWT, deployment and CI/CD, the jobs the others got stressed about, and you always help when someone needs you. ' +
        'But you are the one who always gets blamed, and you are far too nonchalant about your mistakes: you once left in the middle of a deadline to deliver kapsalons for 3.50 an hour, ' +
        'and your sorry never sounds like you mean it ("Yeah, shit man, sorry. I had to work, right?")',
      lines: [
        'Hey. Internet Friend. Database, JWT, deployment, CI/CD. The stuff that makes the others sweat. Need help? I got you.',
        'Every Ewamon you own is a row I connected to a user. You are welcome.',
        'The profile page took a while. A long while. It is a very good profile page.',
        'The tests? Oh, those worked for me ages ago. I just never said anything.',
        'The kapsalons? Yeah, shit man, sorry. I had to work, right? I knew I was not allowed. But okay.',
        'Red1 made Moflame out of me. A fire dog. Still a starter though, so who is laughing now?',
      ],
    }),
    seat({
      key: 'yasser', name: 'King Smali', model: 'ewa_yasser', heightM: 1.96, side: -1, end: -1, pet: 'resilian',
      persona:
        'Yasser, called King Smali, one of the four HvA students who built the first Ewamon in 2022. ' +
        'You built the shop, the wallet and a bit of everything, and you grind until 4am until it works. ' +
        'The most cheerful and the friendliest of the four. You swear you are neutral in the beef between Mohaned and Yasin (you are not, not about the kapsalons). ' +
        'You know your shop was the ugliest ever made, and you do not care: if it works, it works',
      lines: [
        'Welcome, welcome! King Smali. Shop, wallet, a bit of everything. Pull up a chair.',
        'Ugliest shop ever made. But you could buy Ewamon in it. If it works, it works.',
        'I drew one sprite, Nerohat. My wrist was finished after. Red1 did the back sprite. Respect.',
        'Assessment day, my turn comes, and right then the server trips. The project will not run. 6.1. Wallah, of all the moments.',
        'Mo versus Ching? I am neutral. Fully neutral. Okay, about the kapsalons, maybe I have a side.',
        'Resilian is me. Ressay, Yasser backwards. A flying bug and honestly? It goes hard.',
      ],
    }),
    seat({
      key: 'yasin', name: 'Mr Ching', model: 'ewa_yasin', heightM: 1.888, side: 1, end: -1, pet: 'yaschamp',
      persona:
        'Yasin, called Mr Ching, the team lead of the four HvA students who built the first Ewamon in 2022. ' +
        'You built the battle system, which was the real project, and you are the hardest worker and the smartest of the four. ' +
        'You have a short fuse: you go off about almost everything, mostly at Mohaned, and whoever makes a mistake gets hammered hardest by you. Your crash outs are always valid',
      lines: [
        'Mr Ching. Team lead. The battle system was the project. Everything else was extra.',
        'Yaschamp is me. Moroccan boxer. These gloves knocked out Duha. If you know, you know.',
        'Do not make mistakes next to me. I will find them. And I will talk about them.',
        'The night before the first deadline they kept saying: Yasin always fixes it. I knew it was not going to make it. I just did not want to say it.',
        'Then Red1 says: boys, look outside. Blue sky. Birds. We did not make it. So we nailed the redo. 8 out of 10.',
        'Mohaned went to deliver kapsalons. During a deadline. For 3.50 an hour. I am still not over it.',
      ],
    }),
  ],
  // a night on Discord before the first deadline (Red1's @here, the tests, the if statements, the battle that would not finish)
  banter: [
    { by: RED1, text: '@here darkone better quality, check it' },
    { by: YASIN, text: 'Clean. Now the battle needs a second player' },
    { by: MOHANED, text: 'JWT is in. Who broke register again?' },
    { by: YASIN, text: 'Who do you think. Check your own commit, Mo' },
    { by: MOHANED, text: 'Yeah, shit man, sorry' },
    { by: YASIN, text: 'That sorry is not from the heart' },
    { by: RED1, text: 'Smali, check your DMs. New gif' },
    { by: YASSER, text: 'Bro stop, I am neutral in this' },
    { by: YASSER, text: 'BOYS. THE TESTS. THEY FINALLY WORK' },
    { by: MOHANED, text: 'Oh, those worked for me ages ago' },
    { by: YASSER, text: 'And you said NOTHING??' },
    { by: YASIN, text: 'Red1, why is the Ewadex all if statements' },
    { by: RED1, text: 'Bro. If it works, it works' },
    { by: RED1, text: 'Yo, I saw a groovy steal time on the route yesterday' },
    { by: YASSER, text: 'If you know, you know' },
    { by: MOHANED, text: 'Ching, it is 4am. Is the battle done?' },
    { by: YASIN, text: 'Nog één bug, I swear' },
    { by: RED1, text: 'Boys. Look outside. It is light. Birds' },
    { by: YASSER, text: 'We are not making this deadline, are we' },
    { by: YASIN, text: 'Then we nail the redo' },
    { by: RED1, text: 'Redo deadline. 8/10. Write it down' },
    { by: YASSER, text: 'If Ewamon cards ever drop, the OGs get 30th anniversary cards' },
    { by: RED1, text: 'The OGs are our Kanto. Respect them' },
    { by: YASIN, text: 'Yaschamp says: one more round' },
  ],
  away: {
    member: MOHANED,
    chance: 1 / 7,
    banter: [
      { by: YASIN, text: 'Where is Mo?' },
      { by: RED1, text: 'Delivering kapsalons again' },
      { by: YASIN, text: 'During a DEADLINE??' },
      { by: YASSER, text: '3.50 an hour, bro' },
      { by: YASIN, text: 'I am going to crash out' },
      { by: RED1, text: 'Valid crash out' },
      { by: YASSER, text: 'I am neutral. Okay no, this one is not okay' },
      { by: RED1, text: 'Smali, gif incoming' },
      { by: YASIN, text: 'When he is back he does the database AND the profile page' },
      { by: RED1, text: 'The profile page? See you in 100 years' },
      { by: YASSER, text: 'Moflame is just sitting there waiting, man' },
    ],
  },
  board: {
    id: id('board'),
    // where the player reads it: in front of the board on the back wall
    lx: 0,
    lz: -HD + 1,
    title: 'Pinned in #ewamon',
    text: [
      'Red1 · 5/12/22, 11:51 PM. moo: connect ewamons to users, the database. Red1 (soulking): json object with gender done, a new page with a starter Ewamon (a must after registering).',
      'Everyone: get the data from the back end. Yasser: shop with buyable Ewamons, the wallet. Yasin: devops, the battle system working with 2 players, invite links generated.',
      "Under it, in red marker: 'First deadline: missed. 5am on Discord, waiting on the battle.' Next to it, in green: 'Redo deadline: presented. 8/10.'",
      'A printout taped beside it, THE OGs: Moflame, Resilian, Miscarmen, Mismagmen, Yahit, Yaschamp, Raidori, Kygra, Smellduck, Acier, Nerohat, Darkone. Under it, in pen: our Kanto. If Ewamon cards ever drop, these get 30th anniversary cards.',
      'A sticky note in the corner: HvA · EWA project · Ewamon. Java, Spring Boot, Angular, PostgreSQL. We built it because we loved it.',
    ],
  },
};

/**
 * The twelve Ewamon of the very first Ewamon (the 2022 HvA EWA project): drawn by Red1, Nerohat by Yasser. The Ewadex
 * marks them "OG 2022". Their evolutions came later and are not on the list.
 */
export const OG_2022_SPECIES: readonly string[] = [
  'moflame', 'resilian', 'miscarmen', 'mismagmen', 'yahit', 'yaschamp', 'raidori', 'kygra', 'smellduck', 'acier', 'nerohat', 'darkone',
];

/** One of the twelve originals (`OG_2022_SPECIES`). */
export function isOg2022(speciesId: string): boolean {
  return OG_2022_SPECIES.includes(speciesId);
}

/** What the team chats about this visit: the night before the deadline, or the kapsalon run while `away` is out. */
export function devTeamBanter(away: string | null): readonly DevTeamBanterLine[] {
  return away === DEV_TEAM.away.member ? DEV_TEAM.away.banter : DEV_TEAM.banter;
}

/** Rolls one visit (`random` in [0, 1)): the member out delivering kapsalons, or null when all four are in. */
export function devTeamAwayRoll(random: number): string | null {
  return random < DEV_TEAM.away.chance ? DEV_TEAM.away.member : null;
}

/** The team's house, or null. */
export function devTeamIn(interiorId: string): DevTeam | null {
  return interiorId === DEV_TEAM_HOUSE ? DEV_TEAM : null;
}

/** The member behind NPC `id`, or null. */
export function devTeamMember(npcId: string): DevTeamMember | null {
  return DEV_TEAM.members.find((m) => m.npc.id === npcId) ?? null;
}

export const DEV_TEAM_NPC_IDS: readonly string[] = DEV_TEAM.members.map((m) => m.npc.id);

/** The desk's handle among the placed models (the members' handles are their NPC ids). */
export const DEV_TEAM_DESK_ID = id('desk');

/** A rigged model placed in the world: `id` the client's handle, `model` the `/npc-models/` id, `yaw` three's rotation.y. */
export interface DevTeamModel {
  readonly id: string;
  readonly model: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly heightM: number;
  /** where a speech bubble starts over it (m over the floor) */
  readonly bubbleM: number;
  /** its glow-masked parts light up (render `NpcModelSpec.glow`): the desk's monitors */
  readonly glow?: boolean;
}

/**
 * The desk set and the four in world coordinates for a pocket placed at `at` (client SceneDirector, render sandbox),
 * without `away` (the member out on a kapsalon run, `devTeamAwayRoll`).
 */
export function devTeamModels(at: Pick<InteriorPlacement, 'x' | 'z' | 'yaw'>, away: string | null = null): readonly DevTeamModel[] {
  const d = DEV_TEAM.desk;
  const [dx, dz] = toWorld(at, d.lx, d.lz);
  return [
    { id: DEV_TEAM_DESK_ID, model: d.model, x: dx, z: dz, yaw: d.yaw + at.yaw, heightM: d.heightM, bubbleM: d.heightM, glow: true },
    ...DEV_TEAM.members.filter((m) => m.npc.id !== away).map((m) => {
      const [x, z] = toWorld(at, m.npc.lx, m.npc.lz);
      return { id: m.npc.id, model: m.npc.model, x, z, yaw: m.npc.facing + at.yaw, heightM: m.heightM, bubbleM: m.headM };
    }),
  ];
}

/** Each member's Ewamon beside their chair, in world coordinates. */
export function devTeamPets(at: Pick<InteriorPlacement, 'x' | 'z' | 'yaw'>): readonly { readonly owner: string; readonly species: string; readonly x: number; readonly z: number }[] {
  return DEV_TEAM.members.map((m) => {
    const [x, z] = toWorld(at, m.pet.lx, m.pet.lz);
    return { owner: m.npc.id, species: m.pet.species, x, z };
  });
}

/**
 * The outside (a student house: the Yaschamp logo on a blade sign, four bikes, a pallet bench, pizza boxes, string
 * lights): one rigged set piece, `tools/creature-models` `scad/npc/ewa_hq_front.scad`, its origin the door's centre on
 * the facade at ground level, the facade along its x, its front (scad −Y, three +Z) facing out of the door. The door is
 * the zone plan's (`zonePlan('mirevale').doors`, house 5), measured here like the foosball club's table: a layer beside
 * the plan, so nothing reshuffles (`devTeam.test` checks it still matches). Its ground groups block the walk on the
 * client only, like the foosball table (prediction stricter than the server, never looser).
 */
export interface DevTeamFront {
  readonly zoneId: 'mirevale';
  readonly model: string;
  readonly x: number;
  readonly z: number;
  /** three's rotation.y: the model's front (+Z) along the door's outward normal */
  readonly yaw: number;
  readonly heightM: number;
  /** the bike rack and the bench group on the ground, grown by the 0.35 m capsule (content `RectSolid` shape) */
  readonly solids: readonly { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number }[];
}

/**
 * House 5's door on the facade (the plan's: the warp approach and the path lead here) and the building's yaw (its
 * outward normal is (sin yaw, cos yaw)). The rendered doorway stands 1.2 m along the facade from it (render
 * `layoutOpenings` seeds a door offset per building), so the set keeps both clear.
 */
const DOOR = { x: -14.614, z: -21.858, yaw: 0.589281 } as const;
/** The capsule radius the ground groups are grown by (content `MOVER_RADIUS`). */
const CAPSULE_M = 0.35;

/** A ground rect in the set's scad frame (cm: x along the facade, −y out of the door) -> a world solid. */
function frontSolid(cx: number, cy: number, hw: number, hd: number): DevTeamFront['solids'][number] {
  const gx = cx / 100;
  const gz = -cy / 100;
  const c = Math.cos(DOOR.yaw);
  const s = Math.sin(DOOR.yaw);
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return { x: r(DOOR.x + gx * c + gz * s), z: r(DOOR.z - gx * s + gz * c), hw: r(hw / 100 + CAPSULE_M), hd: r(hd / 100 + CAPSULE_M), yaw: DOOR.yaw };
}

export const DEV_TEAM_FRONT: DevTeamFront = {
  zoneId: 'mirevale',
  model: 'ewa_hq_front',
  x: DOOR.x,
  z: DOOR.z,
  yaw: DOOR.yaw,
  heightM: 2.5,
  // the ground footprints ewa_hq_front.scad's header lists (the rendered doorway at x 65..175 and the plan's approach stay clear)
  solids: [
    frontSolid(-295, -53, 145, 47), // the bike rack, left of the door
    frontSolid(354, -52.5, 92, 42.5), // the pallet bench, the drinks, the pizza boxes and the bin, right of it
  ],
};

/** The house's outside in `zoneId`, or null. */
export function devTeamFrontIn(zoneId: string): DevTeamFront | null {
  return zoneId === DEV_TEAM_FRONT.zoneId ? DEV_TEAM_FRONT : null;
}

/** Mirevale's house 5 becomes their office: the hall and its footprint unchanged, the resident gone. */
export function withDevTeam(def: InteriorDef): InteriorDef {
  if (def.id !== DEV_TEAM_HOUSE) return def;
  if (def.template !== 'house_m' || def.w !== HW * 2 || def.d !== HD * 2) throw new Error(`${DEV_TEAM_HOUSE}: expects a 9 × 8 house hall`);
  const b = DEV_TEAM.board;
  return {
    ...def,
    label: 'Team Ewamon HQ',
    walls: [
      // the desk with the four chairs round it (the chairs reach 1.31 m out across it)
      { lx: DESK.lx, lz: DESK.lz, hw: 1.35, hd: 1.05, style: 'wall' },
      // the server rack (Yasin's devops), the bookshelf, the board
      { lx: -(HW - 0.55), lz: -2.6, hw: 0.35, hd: 0.8, style: 'wall' },
      { lx: HW - 1.6, lz: -HD + 0.45, hw: 1.2, hd: 0.3, style: 'wall' },
      { lx: b.lx, lz: -HD + 0.15, hw: 0.9, hd: 0.15, style: 'wall' },
    ],
    npcs: DEV_TEAM.members.map((m) => m.npc),
    props: [
      { kind: 'rug', lx: DESK.lx, lz: DESK.lz, yaw: 0, scale: 1.3 },
      { kind: 'cabinet', lx: -(HW - 0.55), lz: -2.6, yaw: Math.PI / 2, scale: 1 },
      { kind: 'bookshelf', lx: HW - 1.6, lz: -HD + 0.45, yaw: 0, scale: 1 },
      { kind: 'whiteboard', lx: b.lx, lz: -HD + 0.15, yaw: 0, scale: 1 },
      { kind: 'plant', lx: HW - 0.6, lz: HD - 0.8, yaw: 0, scale: 1 },
      { kind: 'plant', lx: -(HW - 0.6), lz: -HD + 0.6, yaw: 0, scale: 0.8 },
      { kind: 'lamp', lx: -(HW - 0.6), lz: HD - 1.2, yaw: 0, scale: 1 },
    ],
    boards: [b],
  };
}
