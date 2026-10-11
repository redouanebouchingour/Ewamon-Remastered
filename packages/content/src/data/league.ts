/**
 * §3.3 LEAGUE — 8 gyms, 3 Wardens (elite), Champion `zeon`. Ids, names, teams (with legacy nicknames) and
 * rewards are legacy league.js verbatim; titles, `pre`/`post` lines follow story-bible.md §4.4–§4.6
 * (each gym leader's concession line — the one with "recollection" — is post[1]). Team abilities/held items are
 * null (the server projects species.abilities[0]); no legacy team carried an item.
 * `mid` (Phase B7, client banner only) is new writing in each character's voice: `halfHp` when the team's total HP
 * first falls to half, `lastStand` when the last creature enters — no creature is named, since the replacement order
 * is the battle AI's, not the team list's.
 */
import type { BadgeDef, LeagueRematch, LeagueTeamMember, LeagueTrainer } from '../types';

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
    bands: ['majin'],
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
    bands: ['tenjin'],
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
    bands: ['majin'],
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

// ─── Phase D14: post-game rematches ──────────────────────────────────────────

/** Rematches (and the battle tower) unlock with this flag — the champion's win; never a story gate. */
export const POSTGAME_FLAG = 'champion:zeon:beaten';
/** A rematch pays the trainer's reward × this (rounded). */
export const LEAGUE_REMATCH_REWARD_MULTIPLIER = 1.5;
/** Days between two rematch wins against the same trainer (the `league:<id>:rematchAt` flag's set time). */
export const LEAGUE_REMATCH_COOLDOWN_DAYS = 1;
/** Rematch levels (inclusive). */
export const LEAGUE_REMATCH_LEVELS = Object.freeze({ min: 65, max: 75 });

/** `league:<id>:rematchAt` — written (cleared and re-set, so its set time moves) by every won rematch. */
export function leagueRematchFlag(leagueId: string): string {
  return `league:${leagueId}:rematchAt`;
}

/**
 * One rematch per league trainer: the same type flavour at Lv 65–75 — originals evolved, a few new faces of the
 * trainer's type, the ace last. A legendary appears only where the original team carries that legendary (Sylvane's
 * glacinid, the Wardens' bankaiser / voltaura / galaxion, Zeon's zenryu). Lines are new writing in each voice.
 */
export const LEAGUE_REMATCH: readonly LeagueRematch[] = [
  {
    leagueId: 'verdant_gym',
    team: [m('bloomduck', 66, 'Petalquack'), m('briarvaunt', 66, 'Bramblewisp'), m('verdatide', 67, 'Mossbrook'), m('clementar', 67, 'Rootkeeper'), m('bloomsprite', 68, 'Grovelight'), m('thornback', 70, 'Mossclaw')],
    pre: ["The Champion, back at my grove. The roots grew while you were away. Let's see if they hold you now."],
    post: ['Still roots that held. Come back when the grove has grown again.'],
    reward: 1200,
  },
  {
    leagueId: 'blaze_gym',
    team: [m('caldermole', 67, 'Ashdigger'), m('magmolith', 68, 'Forgestone'), m('ignispectre', 68, 'Coalghost'), m('solpyre', 69, 'Skyforge'), m('infernomorel', 70, 'Torchveil'), m('moblaze', 72, 'Embermane')],
    pre: ["I banked the forge for this. A Champion's fire against mine. Burn honest, partner."],
    post: ["Hot enough, still. The forge stays lit for you. Tomorrow, if you're game."],
    reward: 1650,
  },
  {
    leagueId: 'tidal_gym',
    team: [m('frofloe', 67, 'Rimewake'), m('ripshell', 68, 'Keelbreaker'), m('wraithtide', 68, 'Fogbell'), m('kygra', 69, 'Ripplefin'), m('tsunamite', 70, 'Tidecrest'), m('abysspark', 72, 'Breaker')],
    pre: ['The tide came back in, and so did you. This time I brought the whole crew. Read the wave.'],
    post: ['You rode it again. The harbour will be here tomorrow. So will I.'],
    reward: 2250,
  },
  {
    leagueId: 'volt_gym',
    team: [m('ironcarab', 67, 'Buzzscale'), m('luxtrik', 67, 'Neon Bolt'), m('thundrix', 68, 'Stormwire'), m('abysspark', 68, 'Gridtide'), m('raidori', 70, 'Ampclaw'), m('flowbot', 72, 'Overclock')],
    pre: ["I re-ran the numbers on you. Every line says I lose. I've rewired the grid anyway. Keep up."],
    post: ["Overclocked and outclassed, twice now. I'll have new numbers by tomorrow."],
    reward: 2850,
  },
  {
    leagueId: 'stone_gym',
    team: [m('chrysotox', 67, 'Slagbiter'), m('resilithorn', 68, 'Quarrythorn'), m('magmolith', 68, 'Ironcore'), m('tsunamite', 68, 'Cliffbreaker'), m('thornback', 70, 'Basaltusk'), m('prismolith', 72, 'Prismwall')],
    pre: ['The pit went deeper since you left. So did my team. Climb it again.'],
    post: ['Solid. Still solid. Come back when the wall grows back.'],
    reward: 3450,
  },
  {
    leagueId: 'phantom_gym',
    team: [m('briarvaunt', 67, 'Phantom Nett'), m('ignispectre', 68, 'Velvet Hex'), m('voidraith', 68, 'Haunted Veil'), m('necrogeist', 69, 'Graveveil'), m('fedoraith', 70, 'Last Bow'), m('mismagmen', 72, 'Mindveil')],
    pre: ['The field is quieter since you held your name. Some of them followed you home. Mind them.'],
    post: ['Head still clear in a haunted field. The whispers will be louder tomorrow.'],
    reward: 4050,
  },
  {
    leagueId: 'iron_gym',
    team: [m('ironcarab', 67, 'Rivetshell'), m('glaciarm', 68, 'Frostplate'), m('gemknight', 68, 'Ward Plate'), m('trenchtusk', 69, 'Earthplate'), m('rivetalon', 70, 'Spike Wing'), m('acier', 72, 'Zangrift')],
    pre: ['A Champion at my anvil. Good. Soft teams still do not leave this room. Show me plating.'],
    post: ['Tempered, again. The anvil will be hot tomorrow.'],
    reward: 4800,
  },
  {
    leagueId: 'draco_gym',
    team: [m('rexaloft', 68, 'Skybud'), m('abyssrake', 69, 'Deepcoil'), m('florasage', 70, 'Canopymaw'), m('blizzraak', 70, 'Frostmaw'), m('pyrothal', 72, 'Solwyrm'), m('glacinid', 73, 'Rimefang')],
    pre: ['The shrine judged you once and named you holder. Now the sky wants to judge a Champion. Come.'],
    post: ['The sky answered you again. It does not tire of it. Neither do I.'],
    reward: 6000,
  },
  {
    leagueId: 'veil',
    team: [m('mismagmen', 70, 'Veilwhisper'), m('fedoraith', 70, 'Final Bow'), m('voidraith', 71, 'Nullshade'), m('toxshade', 71, 'Blightveil'), m('necrogeist', 72, 'Gravepage'), m('bankaiser', 74, 'Bankaiser')],
    pre: ['The ledger grew a column for you. I have been writing in it. Let us see if it reads true.'],
    post: ['Recorded, again. The column grows longer. Come back and lengthen it.'],
    reward: 9000,
  },
  {
    leagueId: 'aurelia',
    team: [m('glimmereen', 70, 'Lightmote'), m('cirrileap', 70, 'Skyleap'), m('starwhim', 71, 'Wishfall'), m('gemknight', 71, 'Prismguard'), m('velvetomb', 72, 'Duskbloom'), m('voltaura', 74, 'Voltaura')],
    pre: ['I recounted. Your number went up. Mine did too. Let us add them together.'],
    post: ['Counted, whole, again. The second book has room for tomorrow.'],
    reward: 10500,
  },
  {
    leagueId: 'kirei',
    team: [m('auroracle', 70, 'Foreseer'), m('starwhim', 70, 'Dreamcount'), m('mismagmen', 71, 'Echoeye'), m('archonosis', 72, 'Mindarch'), m('galaxion', 75, 'Galaxion')],
    pre: ['Still the loudest of the twelve. Let us find out if it is still the truest.'],
    post: ['True, again. Loud and true. I will be here to read it tomorrow.'],
    reward: 12000,
  },
  {
    leagueId: 'zeon',
    team: [m('florasage', 72, 'Verdant Sage'), m('blizzraak', 72, 'Rimecaller'), m('abyssrake', 73, 'Deepfang'), m('rexaloft', 73, 'Skytyrant'), m('pyrothal', 74, 'Solwyrm'), m('zenryu', 75, 'Zenryu')],
    pre: ['You hold the room now. I trained a year in a day. Take it from me again, if you can.'],
    post: ['Held, again. Every one of them. Come back tomorrow and I will hold harder.'],
    reward: 30000,
  },
];
