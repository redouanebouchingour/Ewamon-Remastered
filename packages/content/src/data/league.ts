/**
 * §3.3 LEAGUE — 8 gyms, 3 Wardens (elite), Champion `zeon`. Ids, names, teams (with legacy nicknames) and
 * rewards are legacy league.js verbatim; titles, `pre`/`post` lines follow story-bible.md §4.4–§4.6
 * (each gym leader's concession line — the one with "recollection" — is post[1]). Team abilities/held items are
 * null (the server projects species.abilities[0]); no legacy team carried an item.
 * `mid` (Phase B7, client banner only) is new writing in each character's voice: `halfHp` when the team's total HP
 * first falls to half, `lastStand` when the last creature enters — no creature is named, since the replacement order
 * is the battle AI's, not the team list's.
 */
import type { BadgeDef, LeagueTeamMember, LeagueTrainer } from '../types';

const m = (species: string, level: number, nickname: string): LeagueTeamMember => ({
  species,
  level,
  nickname,
  ability: null,
  heldItem: null,
});

export const LEAGUE: readonly LeagueTrainer[] = [
  {
    id: 'verdant_gym',
    stage: 'gym',
    order: 1,
    name: 'Mira Thornwell',
    title: 'Grove-Keeper of Mirevale',
    look: 'casual_female',
    type: 'Grass',
    badge: 'bloom',
    zoneId: 'mirevale',
    pre: [
      "Mira Thornwell, Grove-Keeper. You've read the stone. Two-thirds. Now I find out if you're real too.",
      'Roots first. Show me roots that held.',
    ],
    post: [
      'The Bloom Badge. Roots that held.',
      "You held them like they were yours to keep. Maybe that's all a recollection needs.",
      'East. The Office keeps a station at Cinderhold. Ask them about the light.',
    ],
    mid: {
      halfHp: "Half my grove's down and the roots still hold. Don't get comfortable.",
      lastStand: 'Last root in the ground. Hold, like I taught you to.',
    },
    team: [m('bramblecub', 11, 'Thornling'), m('smellduck', 12, 'Petalquack'), m('briarbear', 14, 'Mossclaw')],
    reward: 800,
    setsFlags: [],
  },
  {
    id: 'blaze_gym',
    stage: 'gym',
    order: 2,
    name: 'Karn Emberlitt',
    title: 'Ash-Forge Master',
    look: 'viking_male',
    type: 'Fire',
    badge: 'ember',
    zoneId: 'cinderhold',
    pre: [
      "Karn Emberlitt. This forge was my father's. I keep it lit and I keep it honest.",
      "You want to fight about the light? Good. That's what the forge is for.",
    ],
    post: [
      'The Ember Badge. Hot enough.',
      "The Office would call that a recollection. I'd call it a partner. Might be the same thing said twice.",
      'Saltmourn next. Maren reads waves. He also reads charts, and one of them is wrong.',
    ],
    mid: {
      halfHp: "Forge is running hot. Good. Means you're worth the coal.",
      lastStand: 'Last ember in the forge. Burn honest, partner.',
    },
    team: [m('cindercap', 15, 'Kindlecap'), m('moflame', 16, 'Embermane'), m('pyrecap', 18, 'Torchveil')],
    reward: 1100,
    setsFlags: [],
  },
  {
    id: 'tidal_gym',
    stage: 'gym',
    order: 3,
    name: 'Captain Maren',
    title: 'Harbourmaster of Saltmourn',
    look: 'pirate_male',
    type: 'Water',
    badge: 'current',
    zoneId: 'saltmourn',
    pre: ['Maren. Harbourmaster, and gym when the tide allows.', "Read the wave, then own it. The Current Badge goes to those who don't drown."],
    post: [
      'The Current Badge. You rode it.',
      "Read the wave and you'll know it isn't water. It's a recollection of water. Same rules. Wetter.",
      "Stormrook next. Zia Volt keeps the grid. She'll have numbers. She always has numbers.",
    ],
    mid: {
      halfHp: "Tide's turning. Half my crew's in the brine. Read the next wave carefully.",
      lastStand: "Last wave I've got. It's the big one. Hold your breath.",
    },
    team: [m('glimfin', 19, 'Ripplefin'), m('tidespine', 20, 'Tidecrest'), m('voltide', 22, 'Breaker')],
    reward: 1500,
    setsFlags: [],
  },
  {
    id: 'volt_gym',
    stage: 'gym',
    order: 4,
    name: 'Zia Volt',
    title: 'Storm-Grid Keeper',
    look: 'casual2_female',
    type: 'Electric',
    badge: 'circuit',
    zoneId: 'stormrook',
    pre: ['Zia. Fast hands, faster voltage. Keep up if you can.', "Circuit Badge's on the line. Don't blink."],
    post: [
      'The Circuit Badge. Overclocked and outclassed — me, this time.',
      "You out-ran a current. That's not speed, that's a recollection that's sure of itself.",
      "Forty per cent of my night output goes east to a telescope. Go and look at the pylons. Then we'll both stop pretending.",
    ],
    mid: {
      halfHp: "Fifty per cent capacity. I've run the grid on less. Keep up.",
      lastStand: "One unit left on the grid. Redline it. Everything you've got!",
    },
    team: [m('ampmite', 24, 'Buzzscale'), m('raidori', 25, 'Ampclaw'), m('luxtrik', 26, 'Neon Bolt'), m('flowbot', 27, 'Overclock')],
    reward: 1900,
    setsFlags: [],
  },
  {
    id: 'stone_gym',
    stage: 'gym',
    order: 5,
    name: 'Petra Stonewright',
    title: 'Mine-Boss of Marrowdig',
    look: 'cowboy_female',
    type: 'Rock',
    badge: 'fault',
    zoneId: 'marrowdig',
    pre: ["Petra Stonewright. You'll want the pit. Everyone with a device wants the pit.", 'Break yourself on the wall, or climb it. Your choice.'],
    post: [
      'The Fault Badge. Solid.',
      'A recollection of stone still breaks your hand. Ask mine.',
      'Now hold out your hand. There is a lease I want you to read to me.',
    ],
    mid: {
      halfHp: "Half the wall's down. The half that's left is the load-bearing half.",
      lastStand: 'Last stone standing. Go on, then. Climb it.',
    },
    team: [m('pebblit', 28, 'Pebblehorn'), m('lithokrysm', 29, 'Shardlord'), m('thornback', 31, 'Basaltusk'), m('prismolith', 32, 'Prismwall')],
    reward: 2300,
    setsFlags: [],
  },
  {
    id: 'phantom_gym',
    stage: 'gym',
    order: 6,
    name: 'Nyx Hollow',
    title: 'Medium of Vesperveil',
    look: 'old_classy_female',
    type: 'Ghost',
    badge: 'wraith',
    zoneId: 'vesperveil',
    pre: ["Nyx Hollow. It's loud tonight. They're reading again, a mile east.", 'A clean mind still loses to a haunted field. Mind the whispers.'],
    post: [
      'The Wraith Badge. You kept your head in a haunted field.',
      "A recollection's only a ghost that decided to stay.",
      "The cliff road east goes to the Observatory. They'll let you in. They'll let anyone in. That's the frightening part.",
    ],
    mid: {
      halfHp: 'The whispers are getting louder. Half of them are mine. Listen.',
      lastStand: 'The last voice in the field. It will not go quietly.',
    },
    team: [m('nerohat', 32, 'Velvet Hex'), m('miscarmen', 33, 'Haunted Veil'), m('nettlewisp', 34, 'Phantom Nett'), m('fedoraith', 35, 'Last Bow'), m('mismagmen', 37, 'Mindveil')],
    reward: 2700,
    setsFlags: [],
  },
  {
    id: 'iron_gym',
    stage: 'gym',
    order: 7,
    name: 'Marshal Rell',
    title: 'Warden of Forgewall',
    look: 'knight_male',
    type: 'Steel',
    badge: 'anvil',
    zoneId: 'forgewall',
    pre: ["Rell. Soft teams don't leave this room. Show me plating.", 'The Anvil Badge is forged, not given.'],
    post: [
      'The Anvil Badge. Tempered.',
      "Plating's a recollection of being hit and not moving. Yours has it.",
      "Skyrend. Sylvane keeps the Wardens' shrine. Wynn says they've waited forty years for someone to get this far.",
    ],
    mid: {
      halfHp: "Dented. Not breached. Plating holds until it doesn't.",
      lastStand: "Last plate on the anvil. Strike true or don't strike.",
    },
    team: [m('scraphog', 36, 'Iron Tusker'), m('alloylark', 37, 'Sky Rivet'), m('rivetalon', 39, 'Spike Wing'), m('trenchtusk', 40, 'Earthplate'), m('acier', 42, 'Zangrift')],
    reward: 3200,
    setsFlags: [],
  },
  {
    // Phase D6: fights 2-on-2
    doubles: true,
    id: 'draco_gym',
    stage: 'gym',
    order: 8,
    name: 'Sylvane',
    title: 'Keeper of the Sky-Shrine',
    look: 'kimono_male',
    type: 'Dragon',
    badge: 'ascend',
    zoneId: 'skyrend',
    pre: ['Sylvane. Keeper of the shrine, not a Warden; they sit in Solenne.', "The Ascend Badge is my judgement that you're a holder worth handing the rest to. Come and be judged."],
    post: [
      'The Ascend Badge. The sky answered you.',
      'Every recollection up here is older than my shrine. You made them answer anyway.',
      'Solenne is open to you now. So is the shrine above the Ascent. Count what you meet on the way.',
    ],
    mid: {
      halfHp: "Half the sky has spoken for you. The judgement isn't finished.",
      lastStand: "The shrine's last word. Hear it before you answer.",
    },
    team: [m('serpyre', 39, 'Drake Fang'), m('budwing', 40, 'Skybud'), m('bloomdrake', 42, 'Canopymaw'), m('glacinid', 44, 'Rimefang'), m('pyrothal', 46, 'Solwyrm')],
    reward: 4000,
    setsFlags: [],
  },
  {
    id: 'veil',
    stage: 'elite',
    order: 1,
    name: 'Warden Veil',
    title: 'Warden of the Sky-Shrine',
    look: 'ninja_male',
    type: 'Ghost',
    badge: null,
    zoneId: 'solenne',
    pre: ["I have read every line the Provision ever wrote. Show me one it can't.", 'Fourteen hundred pages. Every settled place. Every Seam closed. Begin.'],
    post: ['Recorded. You are a line the ledger does not have a column for.', 'Aurelia keeps the count of what is left. Go and add to it.'],
    mid: {
      halfHp: 'Half the ledger, struck through. The Provision has a column for that.',
      lastStand: 'The final page. Write something it cannot.',
    },
    team: [m('mismagmen', 48, 'Veilwhisper'), m('fedoraith', 49, 'Final Bow'), m('voidraith', 50, 'Nullshade'), m('toxshade', 51, 'Blightveil'), m('bankaiser', 54, 'Bankaiser')],
    reward: 6000,
    setsFlags: ['elite:veil:beaten'],
  },
  {
    // Phase D6: fights 2-on-2
    doubles: true,
    id: 'aurelia',
    stage: 'elite',
    order: 2,
    name: 'Warden Aurelia',
    title: 'Warden of the Sky-Shrine',
    look: 'doctor_female_young',
    type: 'Fairy',
    badge: null,
    zoneId: 'solenne',
    pre: ["I keep the count of what's left. You've been adding to it. Let's see how much.", 'The intact zones, the unspent Seams, the hospital\'s real stock. Show me you are worth keeping.'],
    post: ['Counted. Whole. I will write you into the second book.', 'Kirei keeps the record of the records. Twelve devices. Go and be the loudest.'],
    mid: {
      halfHp: 'Half my count, spent. I am recounting you instead.',
      lastStand: 'The last of my count. Make it a number worth keeping.',
    },
    team: [m('glimmereen', 48, 'Lightmote'), m('cirrileap', 49, 'Skyleap'), m('starwhim', 50, 'Wishfall'), m('gemknight', 51, 'Prismguard'), m('voltaura', 54, 'Voltaura')],
    reward: 7000,
    setsFlags: ['elite:aurelia:beaten'],
  },
  {
    id: 'kirei',
    stage: 'elite',
    order: 3,
    name: 'Warden Kirei',
    title: 'Warden of the Sky-Shrine',
    look: 'old_classy_female',
    type: 'Psychic',
    badge: null,
    zoneId: 'solenne',
    pre: ["Twelve Attestors. Yours is the loudest. Let's find out if it's the truest.", 'I keep the count of the counts. Show me yours can stand being read.'],
    post: ['True. Loud and true. That has not happened in nineteen years.', 'Zeon holds the name. Go through, and be told.'],
    mid: {
      halfHp: 'Loud, yes. Half my record agrees. Now be true for the other half.',
      lastStand: 'The last count. Read it, and let it read you.',
    },
    team: [m('nebucloak', 48, 'Duskveil'), m('auroracle', 49, 'Foreseer'), m('archonosis', 51, 'Mindarch'), m('mismagmen', 52, 'Echoeye'), m('galaxion', 55, 'Galaxion')],
    reward: 8000,
    setsFlags: ['elite:kirei:beaten'],
  },
  {
    id: 'zeon',
    stage: 'champion',
    order: 1,
    name: 'Champion Zeon',
    title: 'Champion of Ewa',
    look: 'knight_golden_male',
    type: 'Dragon',
    badge: null,
    zoneId: 'solenne',
    pre: [
      "Zeon. Nineteen years I've held this room by out-holding everyone who came for it.",
      "You've been to enough Seams to deserve what I hold and you haven't spent one. Show me the rest.",
    ],
    post: ["…Held. Every one of them. You didn't spend a single one.", 'Lean in. There is something you have earned being told.'],
    mid: {
      halfHp: 'Half my room, gone. Nineteen years and I have never had to say that.',
      lastStand: 'The last thing I hold. Take it, if you can.',
    },
    team: [m('florasage', 55, 'Verdant Sage'), m('blizzraak', 55, 'Rimecaller'), m('abyssrake', 56, 'Deepfang'), m('rexaloft', 57, 'Skytyrant'), m('pyrothal', 58, 'Solwyrm'), m('zenryu', 60, 'Zenryu')],
    reward: 20000,
    setsFlags: ['champion:zeon:beaten'],
  },
];

export const BADGES: readonly BadgeDef[] = [
  { id: 'bloom', name: 'Bloom Badge', type: 'Grass', gym: 'verdant_gym' },
  { id: 'ember', name: 'Ember Badge', type: 'Fire', gym: 'blaze_gym' },
  { id: 'current', name: 'Current Badge', type: 'Water', gym: 'tidal_gym' },
  { id: 'circuit', name: 'Circuit Badge', type: 'Electric', gym: 'volt_gym' },
  { id: 'fault', name: 'Fault Badge', type: 'Rock', gym: 'stone_gym' },
  { id: 'wraith', name: 'Wraith Badge', type: 'Ghost', gym: 'phantom_gym' },
  { id: 'anvil', name: 'Anvil Badge', type: 'Steel', gym: 'iron_gym' },
  { id: 'ascend', name: 'Ascend Badge', type: 'Dragon', gym: 'draco_gym' },
];

/**
 * A league interaction listed here is refused (server `leagueRefusal`, client `gymPlan`) until the player holds the
 * flag: the leader's pre-fight beat in the leader's town must have played first.
 *
 * - `verdant_gym` — story-bible §6.1 / §5.4 / §11.1 name it: "content gates the gym interaction on `saw_thinning`
 *   so beat 3 precedes the fight".
 * - The other rows apply the same rule to every leader whose §5.3 beat is written as the fight's preamble (the beat
 *   ends by sending the player to the gym, or the leader's `pre` presupposes it) and which zone entry alone does not
 *   make eligible, so a player could otherwise fight first and hear the preamble after the badge (M3 progression
 *   audit, server IMPLEMENTATION-NOTES Part 6): b6 `forge_gratitude` ("…come to the gym"; it needs b5 on Ash Route,
 *   which lies past Cinderhold, so the player returns), b8 `drowned_harbour` (Maren introduces himself as
 *   harbourmaster *and* gym; b9 needs its flag), b10 `grid_numbers` ("…then come back and beat me"), b13
 *   `the_seam` ("Beat me at the gym…"; already first by §30.4.8 step 1, gated for symmetry), b15 `grove_gone`
 *   (Nyx's `pre` — "They're reading again" — follows it; b16 needs its flag), b21 `the_requisition` (Rell's gate
 *   stand precedes the Anvil Badge in the bible's play order; §7.2 galaxion row), b24 `star_counts` ("Come and be
 *   judged."), and b30 `wardens_charge` ("Go through Veil, Aurelia, me, and then Zeon — and be told.") for the three
 *   Wardens and the Champion (§4.6.2: the Spire precedes the title).
 */
export const LEAGUE_STORY_GATES: Readonly<Record<string, string>> = {
  verdant_gym: 'saw_thinning',
  blaze_gym: 'heard_grey_year',
  tidal_gym: 'saw_old_harbour',
  volt_gym: 'saw_grid_draw',
  stone_gym: 'saw_seam',
  phantom_gym: 'grove_harvested',
  iron_gym: 'saw_requisition',
  draco_gym: 'saw_star_counts',
  veil: 'wardens_met',
  aurelia: 'wardens_met',
  kirei: 'wardens_met',
  zeon: 'wardens_met',
};
