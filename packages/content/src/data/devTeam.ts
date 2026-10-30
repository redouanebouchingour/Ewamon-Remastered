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
        'Red1 (Redouane), the frontender of the four HvA students who built the first Ewamon in 2022 for the EWA project. ' +
        'You drew every Ewamon yourself in pixel art: Darkone is you (Redone, plus your favourite mythical), Moflame you made to roast Mohaned. ' +
        'Proud, playful, the biggest Pokémon fan of the team',
      lines: [
        'Ewa! Welcome to the EWA room. Hogeschool van Amsterdam, Enterprise Web Application. They said: build a board game. We said: what about Pokémon?',
        'Every Ewamon in here I drew myself, pixel by pixel. Darkone is me: Redone, plus my favourite mythical. Darkone better quality, by the way. Check the channel.',
        'Moflame? Based on Mohaned. We flame him so much he literally caught fire. Yaschamp is Yasin, Resilian is Yasser backwards.',
        'Frontend, HTML, CSS, the wiki, the docs, the starter page after you register. All me. The border text on the homepage too. Do not touch it.',
        'Five months of this. Best project I ever did, because all four of us actually loved it.',
      ],
    }),
    seat({
      key: 'mohaned', name: 'Internet Friend', model: 'ewa_mohaned', heightM: 1.918, side: -1, end: 1, pet: 'moflame',
      persona:
        'Mohaned, called Internet Friend, the database and backend guy of the four HvA students who built the first Ewamon in 2022. ' +
        'You did the database, JWT tokens and deployment. The team roasts you all the time and Red1 turned you into Moflame. ' +
        'Calm, a bit sarcastic, secretly proud',
      lines: [
        'Hey. Database guy. Every Ewamon you own is a row I connected to a user. You are welcome.',
        'JWT tokens, access and refresh. Username and email checks on register. Deployment. Nobody sees it, everybody needs it.',
        'Red1 made Moflame out of me. A fire dog. Because they flame me. Very funny. It is still a starter though, so who is laughing now?',
        'Search for a player who does not exist and you get my alert. Small thing. Still proud of it.',
      ],
    }),
    seat({
      key: 'yasser', name: 'King Smali', model: 'ewa_yasser', heightM: 1.96, side: -1, end: -1, pet: 'resilian',
      persona:
        'Yasser, called King Smali, the feature builder of the four HvA students who built the first Ewamon in 2022. ' +
        'You built the shop, the wallet, unique Ewamon in the store and profile picture uploads. Red1 made you into Resilian, your name backwards as a bug. ' +
        'Confident, funny, a big Pokémon fan',
      lines: [
        'Welcome, welcome. King Smali. I build features. The shop? Mine. The wallet? Also mine.',
        'Buy a unique Ewamon in the store, upload a profile picture, win money after a battle. All features by the King.',
        'Resilian is me. Ressay: Yasser backwards. Red1 turned me into a flying bug and honestly? It goes hard.',
        'Me and Red1 are the real Pokémon fans of this team. The other two just pretend.',
      ],
    }),
    seat({
      key: 'yasin', name: 'Mr Ching', model: 'ewa_yasin', heightM: 1.888, side: 1, end: -1, pet: 'yaschamp',
      persona:
        'Yasin, called Mr Ching, the team lead of the four HvA students who built the first Ewamon in 2022. ' +
        'You built the whole turn-based battle system and most of the hard backend. Red1 made you into Yaschamp, the Moroccan boxer. ' +
        'Calm leader, tired from late nights, determined',
      lines: [
        'Mr Ching. Team lead. I built the battle system: turn based, two players, invite links. The whole engine.',
        'Yaschamp is me. Boxer, Moroccan, champion. Look at those gloves. That is a real one.',
        'First deadline we stayed up till 5am on Discord. Everyone waiting on me to finish the battle. We did not make it. Wallah, it was so close.',
        'So we went for the redo deadline. And we nailed it. Presented it, 8 out of 10. Not bad for four guys and a Pokémon dream.',
        'Devops too. If the server is down, it is not me. It is probably Mohaned.',
      ],
    }),
  ],
  // a night on Discord before the first deadline (the 5/12 task split, Red1's @here, the battle that would not finish)
  banter: [
    { by: RED1, text: '@here darkone better quality, check it' },
    { by: YASIN, text: 'Clean. Now the battle needs a second player' },
    { by: MOHANED, text: 'JWT is in. Who broke register again?' },
    { by: RED1, text: 'Not me. I was on the border text for the homepage' },
    { by: YASSER, text: 'Shop is live. You can buy Ewamon now. Wallet works' },
    { by: MOHANED, text: 'Bro why is Moflame literally me' },
    { by: RED1, text: 'Because we flame you. It is in the name' },
    { by: YASSER, text: 'And Resilian? My name backwards? A bug?' },
    { by: RED1, text: 'A flying bug KING. Wallah you are welcome' },
    { by: MOHANED, text: 'Ewa, it is 4am. Ching, is the battle done?' },
    { by: YASIN, text: 'Turns work. Damage works. Nog één bug, I swear' },
    { by: YASSER, text: 'We are not making this deadline, are we' },
    { by: YASIN, text: 'Then we nail the redo' },
    { by: RED1, text: 'Redo deadline. 8/10. Write it down' },
    { by: YASIN, text: 'Yaschamp says: one more round' },
  ],
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
      'A sticky note in the corner: HvA · EWA project · Ewamon. Java, Spring Boot, Angular, PostgreSQL. We built it because we loved it.',
    ],
  },
};

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

/** The desk set and the four in world coordinates for a pocket placed at `at` (client SceneDirector, render sandbox). */
export function devTeamModels(at: Pick<InteriorPlacement, 'x' | 'z' | 'yaw'>): readonly DevTeamModel[] {
  const d = DEV_TEAM.desk;
  const [dx, dz] = toWorld(at, d.lx, d.lz);
  return [
    { id: DEV_TEAM_DESK_ID, model: d.model, x: dx, z: dz, yaw: d.yaw + at.yaw, heightM: d.heightM, bubbleM: d.heightM, glow: true },
    ...DEV_TEAM.members.map((m) => {
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
