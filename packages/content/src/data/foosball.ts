/**
 * The Mire Route foosball club (addition 2026-10-28): six villagers playing table football on the dirt patch north of
 * the road, a few steps east of the bluff trail. Each is a trainer you talk to (their lines, then paging past the last
 * one starts the battle; Escape walks away) and a rigged OpenSCAD model (`tools/creature-models --npc`, served from
 * `/npc-models/`) playing the table in a loop.
 *
 * A separate layer on purpose, like the interiors and obstacles: `ZoneDef.trainers` feed the layout RNG and the
 * heightfield, so the club never touches `ZONES` and the zone stays byte-identical. Every system that looks a trainer
 * up by id asks `foosballTrainers(zoneId)` beside the zone's own. They never walk up to the player (no trainer sight):
 * they are busy. Never a story gate.
 *
 * Placement is authored in the table's frame (centimetres, the scad's: long axis +X, team A's grips on −Y, team B's on
 * +Y) and turned into world coordinates here. The table's +X runs north to south (world +z), its +Y west to east.
 */
import type { TrainerDef, ZoneId } from '../types';

/** A rigged model of the club (a person or the table): its `/npc-models/` id, where it stands, how tall it is. */
export interface FoosballModel {
  readonly model: string;
  readonly x: number;
  readonly z: number;
  /** world yaw (radians, three's rotation.y) of the model, whose front is +Z */
  readonly yaw: number;
  /** the model's height in metres (the GLB is normalised to 1 m) */
  readonly heightM: number;
}

export interface FoosballPlayer extends FoosballModel {
  readonly trainer: TrainerDef;
  /** said after the player beats them */
  readonly defeat: string;
}

export interface FoosballClub {
  readonly zoneId: ZoneId;
  readonly table: FoosballModel;
  readonly players: readonly FoosballPlayer[];
  /** the table and the six round it, grown by the 0.35 m capsule: the client's movement blocker (content `RectSolid` shape) */
  readonly solid: { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number };
}

/** The dirt patch's centre (measured in the render sandbox against the user's screenshot). */
const TABLE = { x: -73.7, z: -4.8 } as const;
/** A person's origin stands this far (cm) from the table's long axis: the grips are 58 cm out, held 24 cm ahead. */
const STAND_CM = 82;

/** Table frame (cm) -> world (m). */
const world = (tx: number, ty: number): { x: number; z: number } => ({
  x: Math.round((TABLE.x + ty / 100) * 1000) / 1000,
  z: Math.round((TABLE.z + tx / 100) * 1000) / 1000,
});

interface Seat {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly heightM: number;
  /** team A plays from the west (table −Y), team B from the east */
  readonly team: 'A' | 'B';
  /** the person's x along the table (cm) */
  readonly at: number;
  readonly look: string;
  readonly party: readonly (readonly [string, number])[];
  readonly lines: readonly string[];
  readonly defeat: string;
  readonly reward: number;
}

const seat = (s: Seat): FoosballPlayer => {
  const p = world(s.at, s.team === 'A' ? -STAND_CM : STAND_CM);
  return {
    model: s.model,
    x: p.x,
    z: p.z,
    // team A faces east (+x), team B west
    yaw: s.team === 'A' ? Math.PI / 2 : -Math.PI / 2,
    heightM: s.heightM,
    defeat: s.defeat,
    trainer: {
      id: s.id,
      name: s.name,
      x: p.x,
      z: p.z,
      look: s.look,
      team: s.party.map(([species, level]) => ({ species, level })),
      lines: s.lines,
      reward: s.reward,
      rematchDays: 3,
    },
  };
};

export const FOOSBALL_CLUB: FoosballClub = {
  zoneId: 'mire_route',
  table: { model: 'foosball_table', ...world(0, 0), yaw: -Math.PI / 2, heightM: 0.956 },
  players: [
    // ── team A (red, from the west): keeper + defence, midfield, attack ──
    seat({
      id: 'mire_route.foosball_mercedes', name: 'Mr Mercedes', model: 'fb_mr_mercedes', heightM: 1.957, team: 'A', at: -60, look: 'knight_male',
      party: [['snapling', 6], ['pebfist', 6]], reward: 300,
      lines: [
        'Have you ever seen a goal from the keeper? A REAL one, all the way across the table? No? Stay a minute.',
        'Everyone says the keeper is for keeping. Wrong. The keeper is for SCORING. Watch this wind-up...',
        'Hit the post. Hit the post again. The next one goes in. The next one ALWAYS goes in.',
        'Tell you what: battle me with your Ewamon. Every win counts as a keeper goal in my book. Ready?',
      ],
      defeat: 'Off the post again. Fine. FINE. The next keeper goal is mine, mark my words.',
    }),
    seat({
      id: 'mire_route.foosball_klaas', name: 'Klaas Faak', model: 'fb_klaas_faak', heightM: 1.921, team: 'A', at: -20, look: 'casual2_male',
      party: [['puffinch', 5], ['seedrift', 6]], reward: 290,
      lines: [
        'I have been waiting ALL DAY for this. ALL. DAY. Since breakfast: table football? Table football? Table football?',
        "They kept saying 'later, Klaas'. Well, later is NOW! Look at me, I'm playing! I'm actually playing!",
        'Midfield is where the magic happens. Five little men and one Klaas. Best day of my life.',
        "I'm so pumped I could battle the whole route. Starting with you! Come on, come on, come on!",
      ],
      defeat: "Lost, but who cares? I'm PLAYING TABLE FOOTBALL! Best. Day. Ever.",
    }),
    seat({
      id: 'mire_route.foosball_mogu', name: 'Mr Mogu Mogu', model: 'fb_mogu_mogu', heightM: 1.861, team: 'A', at: 40, look: 'casual3_male',
      party: [['smellduck', 6], ['kindlegrub', 6]], reward: 310,
      lines: [
        'Ever played table football on a full stomach? Best way. I had a pickled herring and peanut butter sandwich before kick-off.',
        'I once drank a whole litre of Mogu Mogu in one day. Lychee AND grape. Then I had two dinners. I could eat a third right now.',
        'My shot is like my appetite: nobody stops it. Watch the attack rod. Spin, slide, BAM.',
        "Beat my Ewamon and I'll let you have a sip of my Mogu Mogu. The bits at the bottom. Deal?",
      ],
      defeat: 'Beaten on an empty stomach. Well, a half-empty one. Pass me a snack.',
    }),
    // ── team B (blue, from the east): attack, midfield, defence + keeper ──
    seat({
      id: 'mire_route.foosball_klinker', name: 'King Klinker', model: 'fb_king_klinker', heightM: 1.898, team: 'B', at: -40, look: 'knight_golden_male',
      party: [['joeyjab', 7], ['glimp', 5]], reward: 330,
      lines: [
        'Hey abi! What are you doing in the forest? You came to watch the King play, yes?',
        "Abi, look at this rod work. It's all in the wrist, abi. One, two, pass, SHOT!",
        '...They scored again. WRAAAAAAAAAH! Abi, this match is DIFFICULT.',
        'Abi. You and me. Ewamon. Right now. The King needs a win somewhere today!',
      ],
      defeat: 'WRAAAAAAAAAAAAAAH! Abi... good battle. Now let me get back to my rod.',
    }),
    seat({
      id: 'mire_route.foosball_motor', name: 'Mr Motor', model: 'fb_mr_motor', heightM: 1.929, team: 'B', at: 20, look: 'casual_male',
      party: [['ampmite', 6], ['pebblit', 6]], reward: 300,
      lines: [
        'Vroom. Rode the motor here. Rode it round the hedge twice first. Vroom.',
        "You know what's good after a ride? Eggs with cottage cheese. You know what's good before a ride? Eggs with cottage cheese.",
        'Table football is like the motor. Twist the grip, full throttle. Brrrrrr, BAM.',
        'Ride, eggs, cottage cheese, ride. Today: table football and an Ewamon battle. Full throttle. You in?',
      ],
      defeat: 'Stalled. Need eggs. With cottage cheese. Then a long ride.',
    }),
    seat({
      id: 'mire_route.foosball_kaas', name: 'Mr Kaas Croissant', model: 'fb_kaas_croissant', heightM: 1.84, team: 'B', at: 60, look: 'suit_male',
      party: [['dreambud', 6], ['mufflo', 5]], reward: 290,
      lines: [
        'Shhh. Not so loud. My head is still at the weekend. What a weekend.',
        'Met so many girls. So, so many. Lost my phone with all their numbers. Found a croissant in my pocket, though.',
        'Yes, I can see over the table. Just about. Defence is all reflexes, and my reflexes are still asleep.',
        "Fine, fine. One Ewamon battle. A quick one. Then I'm lying down under this table.",
      ],
      defeat: "Ugh. Louder than my hangover, you. Wake me when it's my turn to defend.",
    }),
  ],
  // the table (1.8 x 0.86 m, its long axis along world z) and the people round it (0.82 m out), grown by the capsule
  solid: { ...world(0, 0), hw: 1.3, hd: 1.25, yaw: 0 },
};

/** The club's trainers in `zoneId` ([] elsewhere): looked up by id beside `ZoneDef.trainers`. */
export function foosballTrainers(zoneId: ZoneId): readonly TrainerDef[] {
  return zoneId === FOOSBALL_CLUB.zoneId ? FOOSBALL_TRAINERS : [];
}

/** The club in `zoneId`, or null. */
export function foosballClubIn(zoneId: ZoneId): FoosballClub | null {
  return zoneId === FOOSBALL_CLUB.zoneId ? FOOSBALL_CLUB : null;
}

/** The club member behind trainer `id`, or null. */
export function foosballPlayer(id: string): FoosballPlayer | null {
  return FOOSBALL_CLUB.players.find((p) => p.trainer.id === id) ?? null;
}

const FOOSBALL_TRAINERS: readonly TrainerDef[] = FOOSBALL_CLUB.players.map((p) => p.trainer);
