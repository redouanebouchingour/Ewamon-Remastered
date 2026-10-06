/**
 * §3.1 ZoneDef × 21 — authored from .design/story-bible.md §6 (voices, tablets, set-pieces, harvest per act,
 * story roles) with the legacy world.js AREAS as placement hints. Coordinates are inside the playable interior
 * (town ±64 · route ±104 · story ±84, §3.1) and are cleared to walkable by the heightfield builder (§3.11).
 * NPC ids follow roster-coverage §12.1's `<zoneId>.<role>`; `react` lists most-progressed first (bible §9.9).
 */
import type { GroundItemDef, LoreTabletDef, NpcDef, TrainerDef, ZoneDef, ZoneId } from '../types';
import { SHOP_STOCK_DEFAULT } from './shop';
import { PROGRESSION_STOCK } from './progressionItems';

type React = NpcDef['react'];

const npc = (
  id: string,
  name: string,
  x: number,
  z: number,
  look: string,
  lines: readonly string[],
  o: { when?: string; until?: string; react?: React; tutor?: readonly string[] } = {},
): NpcDef => ({
  id,
  name,
  x,
  z,
  look,
  lines,
  when: o.when ?? null,
  until: o.until ?? null,
  react: o.react ?? [],
  // Phase D2 move tutor: the key exists only on tutors (x/z alone feed the layout)
  ...(o.tutor !== undefined ? { tutor: o.tutor } : {}),
});

const tr = (
  id: string,
  name: string,
  x: number,
  z: number,
  look: string,
  team: readonly (readonly [string, number])[],
  lines: readonly string[],
  reward: number,
  rematchDays: number | null = 3,
): TrainerDef => ({
  id,
  name,
  x,
  z,
  look,
  team: team.map(([species, level]) => ({ species, level })),
  lines,
  reward,
  rematchDays,
});

const it = (id: string, x: number, z: number, item: string, qty = 1): GroundItemDef => ({
  id,
  x,
  z,
  item,
  qty,
});

const lo = (id: string, x: number, z: number, title: string, text: readonly string[]): LoreTabletDef => ({
  id,
  x,
  z,
  title,
  text,
});

const TOWN_SHOP = (extra: readonly string[]): readonly string[] => [...SHOP_STOCK_DEFAULT, ...extra];
/** Phase D2/D3: the town's TMs and evolution stones (data/progressionItems.ts). */
const stockFor = (id: ZoneId): readonly string[] => PROGRESSION_STOCK[id] ?? [];

export const ZONES: readonly ZoneDef[] = [
  // ───────────────────────── 6.1 mirevale ─────────────────────────
  {
    id: 'mirevale',
    name: 'Mirevale',
    kind: 'town',
    biome: 'grove',
    type: 'Grass',
    palette: 'grove_mirevale',
    layoutSeed: 0x4d1e0001,
    signature: 'grove_stone',
    spawn: { x: 0, z: 6 },
    links: { e: 'mire_route' },
    gate: null,
    encounterTable: null,
    npcs: [
      npc('mirevale.wynn', 'Prof. Wynn', 4, -14, 'old_classy_female', [
        "Two-thirds. Mira's meter doesn't lie; it's brass.",
        "If a grey coat asks for your device, show them. We aren't hiding either.",
      ], {
        until: 'act3_started',
        react: [
          { when: 'grove_harvested', lines: ['…Nyx told you gently. Good. She\'s kinder than I am. I was wrong about them and it cost your road.'] },
        ],
      }),
      npc('mirevale.archivist', 'Hessa Dunmore, town archivist', -12, -4, 'old_classy_male', [
        "Three witnessed. That's a record, not a hobby. Come back with three and I'll show you what a record is for.",
      ], {
        react: [
          { when: 'grove_restored', lines: ["First settled Seam to come back in forty-one years, and it's ours. I've started a new ledger. Ours has one column."] },
        ],
      }),
      npc('mirevale.child', 'a child', -6, 10, 'casual3_male', [
        "When I grow up I'll walk all eight badges and put everything in a device!",
      ], {
        react: [{ when: 'grove_harvested', lines: ["The road to school went grey. Mum says it's fine. It's not fine, it's grey."] }],
      }),
      npc('mirevale.gardener', 'the berry-gardener', 14, 12, 'casual_female', [
        'Pick the partner that suits you, not the badge. The badge comes either way.',
        'Bloomsprite in the hedge by the school, some days. Rarer than it was. My mother saw them every spring.',
      ]),
    ],
    trainers: [],
    items: [it('mv1', -18, 8, 'potion'), it('mv2', 20, -22, 'spark_orb', 2), it('mv3', -34, -30, 'crest_orb')],
    lore: [
      lo('lore_mirevale_grovestone', 6, -40, 'The Grove-Stone', [
        'The Wardens did not plant this grove for shade. They grew it as a sieve, to break the noon light into something a town could measure.',
        'Read the stone at noon. It says what the light should be. If the light says less, the stone is not wrong.',
        'A thing that is measured is a thing that is held twice. Measure it.',
      ]),
      lo('lore_mirevale_attestor', 10, -20, 'The Twelfth', [
        'Eleven devices given; eleven roads walked; the count stands at what the count stands at.',
        'The twelfth is for whoever keeps asking about the light.',
        'Register notation, for the reader: species, place, count. Nothing else. The Office uses the same three.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['verdant_orb']),
    healer: true,
    gym: 'verdant_gym',
    storyRole: {
      1: 'Home. Wynn hands over the Attestor; Mira shows the thinning is measurable.',
      2: 'Off-screen: its route is drawn while the player is east (beat 15).',
      3: "Wynn's base for the restoration; Mira's final noon reading.",
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.2 mire_route ─────────────────────────
  {
    id: 'mire_route',
    name: 'Mire Route',
    kind: 'route',
    biome: 'grove',
    type: 'Grass',
    palette: 'grove_mire',
    layoutSeed: 0x4d1e0002,
    signature: 'hedgerow_gap',
    spawn: { x: -92, z: 0 },
    links: { w: 'mirevale', e: 'cinderhold' },
    gate: null,
    encounterTable: 'enc_mire_route',
    npcs: [
      npc('mire_route.sable', 'Sable', -60, 6, 'casual2_male', ["It's a job. It's a good job.", 'Race you to the first badge.'], {
        when: 'met_wynn',
        until: 'saw_assessment',
      }),
      npc('mire_route.forager', 'Odd Pell, forager', -30, 22, 'cowboy_male', [
        'Seedrift by day, snapling after dark. The hedge keeps two rosters.',
      ], {
        react: [
          { when: 'grove_restored', lines: ["Bark's back. I put my hand on it for an hour. Don't tell anyone."] },
          { when: 'grove_harvested', lines: ["I can find the hedge. I can't find the — the — I've picked in it forty years."] },
        ],
      }),
      npc('mire_route.wynn', 'Prof. Wynn', 10, -8, 'old_classy_female', ['Read them out with me.'], {
        when: 'act3_started',
        react: [{ when: 'grove_reremembered', lines: ['Write down the time. I want the hour in the record.'] }],
      }),
      npc('mire_route.walker', 'a route-walker', 40, -30, 'casual_male', [
        'Mossling in the wet ditch, glimp in the dry. Same hedge, two registers.',
      ], {
        react: [
          { when: 'grove_harvested', lines: ["Walked this road since I was six. Today I couldn't have told you its name if you'd paid me. Then I could. Then I couldn't."] },
        ],
      }),
    ],
    trainers: [
      tr('sable_mire', 'Sable', -60, 10, 'casual2_male', [['coalette', 5], ['glimp', 4]], ["Don't sulk when I win."], 300, null),
      tr('mire_route.forager_pim', 'Forager Pim', -20, 40, 'cowboy_female', [['mossling', 4], ['glimp', 4]], ['The hedge hides more than berries. Show me what you found.'], 320),
      tr('mire_route.bug_catcher', 'Bug-Catcher Tev', 50, 20, 'casual3_male', [['seedrift', 5]], ["Caught something in the fen this morning. Let's see yours."], 280),
    ],
    items: [it('mr1', -40, 60, 'potion'), it('mr2', 30, 70, 'crest_orb'), it('mr3', 70, -60, 'revive')],
    lore: [
      lo('lore_mire_seam', 0, 50, 'The Hedge Nobody Cut', [
        'Left uncut for a hundred years because the Wardens asked, and nobody remembers being asked.',
        'Where a thing is left alone long enough, the world remembers it out loud. That is all a Seam is.',
        'If you find this stone grey, someone drew on this road. If you find it green again, someone held it.',
      ]),
      lo('lore_mire_rate', 80, 40, 'Rate Card, Yr 41', [
        'Common 120 · Uncommon 300 · Rare 900 · by the head, at Cinderhold station.',
        'Legendaries: not purchased. Trained stock: by consent only, at double.',
        'The Office thanks Mire Route for its contribution to the relief of Marrowdig.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: 'The first Seam; the rival; the hedgerow the player learns to witness in.',
      2: "Drawn. The player's home route rendered flat while they are away.",
      3: "The first settled Seam in forty-one years to be re-remembered, from the player's own record.",
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.3 cinderhold ─────────────────────────
  {
    id: 'cinderhold',
    name: 'Cinderhold',
    kind: 'town',
    biome: 'cinder',
    type: 'Fire',
    palette: 'cinder_cinderhold',
    layoutSeed: 0x4d1e0003,
    signature: 'grey_year_memorial',
    spawn: { x: -50, z: 0 },
    links: { w: 'mire_route', e: 'ash_route' },
    gate: 'bloom',
    encounterTable: null,
    npcs: [
      npc('cinderhold.yardmaster', 'Brann Sorrel, yardmaster', 16, 14, 'viking_male', [
        "Fennorange in the ash-yard, kindler on the road. Deal with both and I'll call you useful.",
        "The Office station's the clean building. It's always the clean building.",
      ]),
      npc('cinderhold.provisioner_a', 'Clerk Anwen Rusk', -10, -22, 'suit_male', [
        "Office of Provision, Cinderhold station. Rate card's on the wall; ledger copy's on the desk. Read either.",
      ], {
        react: [{ when: 'ledger_read', lines: ['You read the working copy. Then you know more than I do; I only see the purchases.'] }],
      }),
      npc('cinderhold.sable_neighbour', "Sable's neighbour", 24, -10, 'casual_female', [
        "Sable's the one in grey now. Their brother's in Solenne. You don't get to judge that from here.",
      ], {
        react: [{ when: 'sable_turned', lines: ["Sable came home without the coat. Sat on the step an hour. Went back east. Didn't say."] }],
      }),
      npc('cinderhold.smith', 'a smith', -20, 20, 'blue_soldier_male', [
        "Karn's forge is the oldest in town. His father worked it. Everybody knows that.",
      ], {
        react: [{ when: 'act3_started', lines: ["Karn's stopped saying 'oldest in town'. Says 'my forge'. I don't know why that's different. It is."] }],
      }),
    ],
    trainers: [],
    items: [it('ch1', -18, -16, 'superpotion'), it('ch2', 36, 30, 'ember_orb', 2)],
    lore: [
      lo('lore_cinderhold_names', 0, -34, 'The Third Column', [
        'Four thousand one hundred. The Granary Office counted them by district and the count is the only honest thing that year produced.',
        "Below the names: 'and those who were fed, who are not counted here, because they are alive.'",
        "Nobody who reads this wall is asked to be against the Office. The wall is the Office's argument. It is a good one.",
      ]),
      lo('lore_cinderhold_forge', 30, -28, 'The Emberlitt Forge', [
        'Provisioned Yr 19 after the Emberlitt fire. Drawn against Ash Route, first draw.',
        'The forge has always stood here. The plate that says when it was bought is the only thing in Cinderhold that disagrees.',
        'Both are true. Hold both.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['ember_orb']),
    healer: true,
    gym: 'blaze_gym',
    storyRole: {
      1: "The Provision's face at its best: the station, the memorial, Karn's gratitude.",
      2: "Sable's home; Teo's absence.",
      3: 'Karn has read the ledger.',
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.4 ash_route ─────────────────────────
  {
    id: 'ash_route',
    name: 'Ash Route',
    kind: 'route',
    biome: 'cinder',
    type: 'Fire',
    palette: 'cinder_ash',
    layoutSeed: 0x4d1e0004,
    signature: 'cinder_hedge',
    spawn: { x: -92, z: 0 },
    links: { w: 'cinderhold', e: 'saltmourn' },
    gate: 'bloom',
    encounterTable: 'enc_ash_route',
    npcs: [
      npc('ash_route.assessor_reeve', 'Assessor Tamsin Reeve', 0, 14, 'doctor_female_young', [
        "Everything's in the ledger.",
        'Record what you like. We do.',
      ], { when: 'badge:bloom', until: 'saw_assessment' }),
      npc('ash_route.charcoal_burner', 'a charcoal-burner', -40, -30, 'casual3_male', [
        "Hedge was there this morning with birds in it. Now it's — it's hedge-coloured.",
      ], {
        react: [{ when: 'heard_grey_year', lines: ["I'm not against them. My daughter eats. I'd just like to have been asked what the hedge was worth."] }],
      }),
      npc('ash_route.provisioner_b', 'Provisioner Cole', 8, 24, 'suit_male', [
        "Crew's gone back to station. I stay a day in case anyone's upset. Nobody's usually upset. They're usually fed.",
      ], { when: 'saw_assessment' }),
    ],
    trainers: [
      tr('ash_route.kindler', 'Kindler Ysolde', -50, 30, 'casual_female', [['flampling', 9], ['wickling', 9], ['embrock', 10]], [
        'Flampling by day, wickling by night. I light both. Try me.',
        "Hot enough. Go and see the hedge before the Office packs up — it's a thing to have seen.",
      ], 540),
      tr('ash_route.hiker', 'Hiker Born', 50, -40, 'cowboy_male', [['pebfist', 9], ['coalette', 10]], ['These rocks are warm to the touch. They were not, last year.'], 540),
    ],
    items: [it('ar1', 30, 60, 'ember_orb', 2), it('ar2', -30, -60, 'potion', 2), it('ar3', -80, 70, 'superpotion')],
    lore: [
      lo('lore_ash_settled', 4, 4, 'Settled Seam, Yr 41', [
        'Drawn against Ash Route, second draw: flampling ×18, embrock ×14, coalette ×7, moflame ×2.',
        'Provisioned: Cinderhold granary, 200 sacks, winter Yr 41.',
        'Assessor T. Reeve. Witnessed by the twelfth Attestor, who was not asked to consent because consent was not required.',
      ]),
      lo('lore_ash_caldera', 88, -80, 'The Lip', [
        'Something laughed here once, loud enough that the rock remembers it. One laugh. One time.',
        'A memory that only happened once cannot be spent; it holds nothing else up. The Office knows this and has never come here.',
        'Wait until you are the kind of holder a singular memory would answer. Then come back.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: 'The first visible harvest — the player watches a Seam settle.',
      2: 'A flat road the player crosses twice.',
      3: 'Still flat. Sunjaw at the caldera lip after the title (§7).',
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.5 saltmourn ─────────────────────────
  {
    id: 'saltmourn',
    name: 'Saltmourn',
    kind: 'town',
    biome: 'salt',
    type: 'Water',
    palette: 'salt_saltmourn',
    layoutSeed: 0x4d1e0005,
    signature: 'sunk_quay',
    spawn: { x: -50, z: -6 },
    links: { w: 'ash_route', e: 'tide_route' },
    gate: 'ember',
    encounterTable: 'enc_saltmourn',
    npcs: [
      npc('saltmourn.harbourmaster', 'Captain Maren', 30, 40, 'pirate_male', [
        "Every soul in this town will tell you the chart's wrong.",
      ], {
        when: 'badge:ember',
        react: [
          { when: 'harbour_witness', lines: ["You held it. The wraithtide. Then the mudflat's in your device, and I can stop telling people my grandfather was a liar."] },
        ],
      }),
      npc('saltmourn.fishwife', 'a fish-seller', -20, 10, 'casual_female', [
        "Harbour's been here since my great-grandmother. Everyone knows that.",
        "Kygra in the basin some mornings. Rarer than it was. Or I'm older than I was.",
      ]),
      npc('saltmourn.provisioner_a', 'Assessor Wren Tally', -14, -26, 'doctor_female_young', [
        "Office station, Saltmourn. We don't draw here — you don't draw on a purchase. Tide Route, yes. Ask me anything.",
      ], {
        react: [{ when: 'ledger_read', lines: ["You've read the Yr 6 line then. Tide Route, first draw. It's why the marsh is the colour it is. It's also why there's a town."] }],
      }),
      npc('saltmourn.diver', 'a salvage diver', 12, 26, 'casual2_male', [
        "There's a quay down there. Stones, laid. Nobody laid them. I stopped asking.",
      ], {
        react: [{ when: 'harbour_witness', lines: ['You caught the thing that sits on the stones. Does it — does it know what they are?'] }],
      }),
    ],
    trainers: [],
    items: [it('sm1', 18, -18, 'tide_orb', 2), it('sm2', -34, -34, 'hyper_potion')],
    lore: [
      lo('lore_saltmourn_chart', 34, 46, "Grandfather's Chart", [
        'Same coast. Tide-race, mudflat, a fishing stage on stilts. No harbour.',
        'The Office provisioned the harbour Yr 6. The chart is from Yr 2. The chart is the only object in Saltmourn that predates the harbour and disagrees with it.',
        'Hold the chart. Hold the harbour. Notice that you can.',
      ]),
      lo('lore_saltmourn_quay', 40, 14, 'The Drowned Harbour', [
        'We fished from this stage and we were poor and we were here.',
        'Whatever stands above these stones now, someone paid for it, and the payment was not made here.',
        'Water and ghost. The register for a thing that moved and is gone.',
      ]),
    ],
    warps: [{ id: 'saltmourn.hut_door', x: 30, z: 44, toX: -40, toZ: 44, label: "Harbourmaster's hut" }],
    shop: TOWN_SHOP(['tide_orb', ...stockFor('saltmourn')]),
    healer: true,
    gym: 'tidal_gym',
    storyRole: {
      1: 'The provisioned harbour and the chart that shows no harbour; the drowned quay.',
      2: "Maren points the player to Stormrook's numbers.",
      3: "The harbourmaster's chart is entered into the Attestor as the only record of the mudflat.",
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.6 tide_route ─────────────────────────
  {
    id: 'tide_route',
    name: 'Tide Route',
    kind: 'route',
    biome: 'salt',
    type: 'Water',
    palette: 'salt_tide',
    layoutSeed: 0x4d1e0006,
    signature: 'salt_boardwalk',
    spawn: { x: -92, z: 0 },
    links: { w: 'saltmourn', e: 'stormrook' },
    gate: 'ember',
    encounterTable: 'enc_tide_route',
    npcs: [
      npc('tide_route.sable', 'Sable', -30, 8, 'casual2_male', ["It's a coat.", 'Tell me which part of that is wrong.'], {
        when: 'badge:ember',
        until: 'sable_refused',
      }),
      npc('tide_route.marsh_warden', 'the marsh-warden', -60, -30, 'cowboy_male', ["Marsh has always been this grey. It's a marsh."], {
        react: [{ when: 'ledger_read', lines: ["…Yr 6. Thirty-five years I've been telling visitors that. My father would have told them different."] }],
      }),
      npc('tide_route.surfer', 'a surf-hand', 40, 30, 'casual2_female', [
        "Glimfin in the shallows, ripshell under the boards. Kygra out past the stage if the day's bright, and it's never bright.",
      ]),
      npc('tide_route.lamp_lighter', 'the lamp-lighter', 70, -20, 'old_classy_male', [
        "Half these lamps won't take a flame. Wick's fine. Oil's fine. They just — don't hold it.",
      ]),
    ],
    trainers: [
      tr('sable_tide', 'Sable', -30, 12, 'casual2_male', [['coalette', 15], ['glimp', 14], ['mudbub', 13]], ["Wynn's device or the Office's lens. Let's see which one you've been paying attention to."], 700, null),
      tr('tide_route.swimmer', 'Swimmer Cael', 20, -50, 'casual3_male', [['mudbub', 12], ['slushpup', 13]], ["The current's mine to ride. Race it."], 720),
      tr('tide_route.fisher', 'Fisher Dell', 60, 50, 'pirate_male', [['brookrawl', 13], ['tidespine', 14]], ['Reeled in a biter the other day. You will do.'], 760),
    ],
    items: [it('tr1', 30, 70, 'hyper_potion'), it('tr2', -40, -60, 'crest_orb', 2)],
    lore: [
      lo('lore_tide_firstdraw', -10, -40, 'Yr 6', [
        'Drawn against Tide Route, first draw: mudbub ×40, brookrawl ×36, slushpup ×22, glowtent ×11, tidespine ×9.',
        'Provisioned: a harbour at Saltmourn. Let it have been that there was a harbour.',
        'Comptroller O. Marle. First provisioning of a place. The Office notes the marsh dimmed and considers the exchange sound.',
      ]),
      lo('lore_tide_lamps', 80, 20, 'The Half-Dark Boardwalk', [
        'The lamps were made to hold a flame and half of them cannot. The oil is not at fault.',
        'A thinning place forgets small things first: how a wick takes fire, how bark feels, the third verse of a song.',
        'You are walking through a payment. Most people never notice. You have a device that does.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: "Sable in the grey coat; the first defence of the Provision in a friend's mouth.",
      2: null,
      3: null,
    },
    harvestState: 'thinning',
  },

  // ───────────────────────── 6.7 stormrook ─────────────────────────
  {
    id: 'stormrook',
    name: 'Stormrook',
    kind: 'town',
    biome: 'storm',
    type: 'Electric',
    palette: 'storm_stormrook',
    layoutSeed: 0x4d1e0007,
    signature: 'grid_house',
    spawn: { x: -50, z: 0 },
    links: { w: 'tide_route', e: 'galvan_route' },
    gate: 'current',
    encounterTable: null,
    npcs: [
      npc('stormrook.linekeeper', 'Linekeeper Dov Marrat', 20, -16, 'blue_soldier_male', [
        'Ampmite in the substation, darkone on the span after dark. Both chew insulation. Bring me both.',
      ], {
        react: [{ when: 'saw_forgetting', lines: ["You met old Tam at the third pylon. He trained me. He can't say 'junction' any more. He can do one blindfolded."] }],
      }),
      npc('stormrook.provisioner_a', "Bursar's courier Ilse Penn", -10, 22, 'suit_male', [
        'Office courier. I carry the ledger copy west once a month. Heavy book. Nobody reads it.',
      ], {
        react: [{ when: 'ledger_read', lines: ["You did. That's a first for me. Was it — was it what you thought?"] }],
      }),
      npc('stormrook.child', 'a child', 8, 12, 'casual3_male', ["The east line hums at night! Zia says it's a telescope. Telescopes don't hum."]),
      npc('stormrook.meter_reader', 'a meter-reader', 30, 24, 'casual_male', ["Forty per cent, nights. I read the dial. I don't ask what a mirror wants with it."]),
    ],
    trainers: [],
    items: [it('st1', -18, -18, 'revive'), it('st2', 36, -30, 'superpotion', 2)],
    lore: [
      lo('lore_stormrook_thirdline', 40, -6, 'The Third Line, Yr 27', [
        'Provisioned: a pylon line east to the Umbral Observatory, forty-one pylons.',
        'Drawn against Galvan Span, first draw. The linemen who raised the pylons were the ones drawn from; the Office notes this was not intended.',
        'Assessor E. Wynn. Resigned the following spring.',
      ]),
      lo('lore_stormrook_dial', -34, -30, 'The Night Dial', [
        'Power is a memory of motion held in a wire. The Observatory takes forty in every hundred and gives back nothing that can be metered.',
        'A lens that sees needs no power. A lens ground to un-see needs a great deal.',
        'Read the dial. Then read the ledger. The two books agree.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(stockFor('stormrook')),
    healer: true,
    gym: 'volt_gym',
    storyRole: {
      1: null,
      2: "Zia's numbers: 40 % of the grid at night to a telescope that cannot see.",
      3: null,
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.8 galvan_route ─────────────────────────
  {
    id: 'galvan_route',
    name: 'Galvan Span',
    kind: 'route',
    biome: 'storm',
    type: 'Electric',
    palette: 'storm_galvan',
    layoutSeed: 0x4d1e0008,
    signature: 'struck_pylon',
    spawn: { x: -92, z: 0 },
    links: { w: 'stormrook', e: 'marrowdig' },
    gate: 'current',
    encounterTable: 'enc_galvan_route',
    npcs: [
      npc('galvan_route.lineman', 'Tam Ossory, lineman', -20, 30, 'old_classy_male', ['I do the, the. This.'], {
        when: 'saw_grid_draw',
        react: [{ when: 'name_held', lines: ["Junction. It's a junction. I said it this morning and I said it again to make sure. Tell Wynn."] }],
      }),
      npc('galvan_route.span_walker', 'a span-walker', 30, -20, 'casual_male', [
        "Stormchick under the wires by day. Raidori after dark if the storm's up. Don't stand under the third pylon in rain.",
      ]),
      npc('galvan_route.provisioner_b', 'Assessor Pim Corrow', 60, 40, 'suit_male', [
        "We don't draw here any more. Tenure's low; it'd buy nothing. We drew once and got a pylon line for it.",
        'Tam? Good man. Trained half the grid. Yes, we know.',
      ]),
    ],
    trainers: [
      tr('galvan_route.rocker', 'Rocker Jinx', -50, -40, 'casual2_female', [['ampmite', 17], ['stormchick', 18]], ['Crank it up. Loud is a register too.'], 980),
      tr('galvan_route.guard', 'Guard Volt', 40, 60, 'soldier_male', [['gustuff', 18], ['shardling', 19]], ["Span's closed to grey coats. You? Prove it."], 1020),
    ],
    items: [it('gr1', 20, 80, 'superpotion', 2), it('gr2', -70, -70, 'dusk_orb')],
    lore: [
      lo('lore_galvan_struck', -80, 90, 'The Struck Pylon', [
        'One storm, one strike, one memory of nine tails of blue fire. It has never happened again and it will not.',
        "The Office assayed it Yr 29 and recorded 'singular; nil tenure; no purchase possible'.",
        'Come with the Circuit Badge and it will look at you. What it does after is between you and it.',
      ]),
      lo('lore_galvan_hands', -24, 36, 'What the Hands Keep', [
        'A trade is held in two places: the hands and the mouth. The Office drew on the mouth.',
        'Tam Ossory raised eleven of these pylons and cannot name the part he is oiling. His hands have never once been wrong.',
        'If you are drawn on, be drawn on like Tam. Keep working.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: null,
      2: 'The lineman who cannot name his trade; the first person the player watches forgetting.',
      3: 'Raikitsune at the struck pylon (badge gate); Voltaura in the storm\'s eye after the title (§7).',
    },
    harvestState: 'thinning',
  },

  // ───────────────────────── 6.9 marrowdig ─────────────────────────
  {
    id: 'marrowdig',
    name: 'Marrowdig',
    kind: 'town',
    biome: 'marrow',
    type: 'Rock',
    palette: 'marrow_marrowdig',
    layoutSeed: 0x4d1e0009,
    signature: 'pithead',
    spawn: { x: -50, z: 0 },
    links: { w: 'galvan_route', e: 'deepcut_route', s: 'the_rift' },
    gate: 'circuit',
    encounterTable: null,
    npcs: [
      npc('marrowdig.foreman', 'Foreman Aldous Grell', 20, -20, 'viking_male', [
        "Yahit in the lower cut, thirty species between here and the Hollow if you're counting. I'm counting. Count with me.",
        "I was one of the sixty-one. I don't say a word against the Office. I also can't remember how to set a prop. Make of that what you like.",
      ]),
      npc('marrowdig.cutter', 'a cutter', -16, 18, 'cowboy_male', [
        "Twenty years cutting. Went to show the apprentice a face-cut Tuesday and my hands did it and my mouth couldn't.",
      ], {
        react: [{ when: 'read_lease', lines: ["You read the plate. Then you know what they paid for us with. Was it worth it? Don't answer. I don't want to know your answer."] }],
      }),
      npc('marrowdig.provisioner_a', 'Assessor Hal Bray', -8, -28, 'suit_male', [
        "The lease is legal and the miners are alive. I'm sorry about the trade. Trades come back. People don't.",
      ], {
        react: [{ when: 'siege_held', lines: ["Forgewall said no. In the open. I've written it up as such. I don't know what happens to a no."] }],
      }),
      npc('marrowdig.widow_not', "a miner's wife", 28, 22, 'casual_female', [
        "My husband was under that rock for two days and he came up. Whatever they took for it, I'd have given more.",
      ]),
    ],
    trainers: [],
    items: [it('md1', 18, -34, 'hyper_potion'), it('md2', 38, 32, 'revive')],
    lore: [
      lo('lore_marrowdig_lease', 24, -26, 'Lease of the Deep Cut Seam, Yr 38', [
        'Granted to the Office of Provision in perpetuity, in consideration of the recovery of sixty-one.',
        'Drawn against, for the recovery itself: Mire Route, first draw — seedrift ×22, mossling ×31, bloomsprite ×4, smellduck ×19, resilian ×9.',
        "Bursar E. Quill. The Office notes the Seam under Marrowdig will be drawn on hereafter and the town's tenure will fall. The town agreed. The town was not told what tenure was.",
      ]),
      lo('lore_marrowdig_sixtyone', -34, 30, 'The Sixty-One', [
        'Under this stone for two days. Above it now.',
        'Nothing here is against the Office. The Office is why there are names on this stone and not on the other one.',
        'Both stones are true. The Attestor is for people who can hold two stones.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['prism_orb', ...stockFor('marrowdig')]),
    healer: true,
    gym: 'stone_gym',
    storyRole: {
      1: null,
      2: 'Sixty-one lives owed; cutters forgetting how to cut; the lease that carries the Mire Route line.',
      3: null,
    },
    harvestState: 'thinning',
  },

  // ───────────────────────── 6.10 deepcut_route ─────────────────────────
  {
    id: 'deepcut_route',
    name: 'Deepcut',
    kind: 'route',
    biome: 'marrow',
    type: 'Rock',
    palette: 'marrow_deepcut',
    layoutSeed: 0x4d1e000a,
    signature: 'the_cutting',
    spawn: { x: -92, z: 0 },
    links: { w: 'marrowdig', e: 'vesperveil' },
    gate: 'circuit',
    encounterTable: 'enc_deepcut_route',
    npcs: [
      npc('deepcut_route.sable', 'Sable', -70, 6, 'casual2_male', ['No.', 'Fight me or move.'], { when: 'badge:circuit', until: 'sable_turned' }),
      npc('deepcut_route.prospector', 'a prospector', 20, -30, 'cowboy_male', [
        'Pebblit in the scree, lithokrysm where the bands go pink. Rimeidol at night, and it watches you back.',
      ]),
      npc('deepcut_route.gate_guard', 'a Provision gate-guard', 50, 20, 'soldier_male', ["Lease tunnel. Office staff only. It's not a secret; it's a hazard."], {
        react: [{ when: 'ledger_read', lines: ["…You've been to the Observatory. Then you know it's not a hazard. I'll still not open it. I've got a family too."] }],
      }),
      npc('deepcut_route.pyrecap_keeper', 'an old woman with a lantern', -20, 50, 'old_classy_female', [
        "Pyrecap in the warm cut. My grandson's a cindercap-holder; I keep an eye out for the next stage for him. Certainty's a thing you watch happen.",
      ]),
    ],
    trainers: [
      tr('sable_deepcut', 'Sable', -70, 10, 'casual2_male', [['caldermole', 25], ['glimmereen', 23], ['bogmaw', 24]], ["I've got a quota and a brother."], 1200, null),
      tr('deepcut_route.breaker', 'Breaker Hod', 0, -60, 'viking_male', [['pebblit', 22], ['embrock', 23]], ['I break walls. And teams.'], 1200),
      tr('deepcut_route.digger', 'Digger Sten', 60, -30, 'cowboy_male', [['berkest', 23], ['coalette', 24]], ['The deeper we cut, the colder it gets. Wrong, that.'], 1240),
    ],
    items: [it('dr1', 30, 70, 'revive'), it('dr2', -50, -60, 'prism_orb')],
    lore: [
      lo('lore_deepcut_strata', 80, 60, 'Banded Rock', [
        'Each band is a year the ground remembers. Count them and you have a number older than the Office, the Wardens and the town.',
        'Below the last band the miners found something that is not rock and does not have years.',
        'Rock is the register of persistence. What is under it persists differently.',
      ]),
      lo('lore_deepcut_tunnel', 54, 24, 'Lease Tunnel', [
        'Office of Provision. Drawn under lease. Do not enter. Nothing here is hidden from you; it is only kept from you.',
        'The distinction matters to the Office.',
        'Consider whether it matters to you.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: { 1: null, 2: 'Sable refuses to talk and fights.', 3: null },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.11 vesperveil ─────────────────────────
  {
    id: 'vesperveil',
    name: 'Vesperveil',
    kind: 'town',
    biome: 'vesper',
    type: 'Ghost',
    palette: 'vesper_vesperveil',
    layoutSeed: 0x4d1e000b,
    signature: 'medium_parlour',
    spawn: { x: -50, z: 0 },
    links: { w: 'deepcut_route', e: 'hollow_route', n: 'umbral_observatory' },
    gate: 'fault',
    encounterTable: null,
    npcs: [
      npc('vesperveil.medium', 'Nyx Hollow', 40, -30, 'old_classy_female', ['I thought I was ill.'], {
        when: 'badge:fault',
        react: [
          { when: 'new_column', lines: ["They read a new word last night. 'Attested.' Then they stopped, and argued. I've never heard them argue."] },
          { when: 'ledger_read', lines: ["You've stood in the room I hear. Is it — is it a room? I've never been sure it was a room."] },
        ],
      }),
      npc('vesperveil.constable', 'the constable', -10, -20, 'soldier_male', [
        "Cliff road east is Office land. Gate's open. Always is. Most folk don't go because most folk don't want to.",
      ]),
      npc('vesperveil.lantern_maker', 'a lantern-maker', 10, 20, 'casual_male', [
        "Memory's loose here. Always was. Ghosts are just recollections that decided not to be certain. I make lanterns so they can find the way back to the hedge.",
        'I teach a little, too. Three thousand a lesson — the lanterns do not pay for themselves.',
      ], { tutor: ['Shadow Sneak', 'Spectral Burn', 'Night Slash', 'Endeavor'] }),
      npc('vesperveil.gravetender', 'the gravetender', -30, 30, 'old_classy_male', [
        "Nothing's buried here. There's nothing to bury — this is where things that never were come to be almost.",
      ], {
        react: [{ when: 'grove_harvested', lines: ["Your road came through last night. Went past the graves like a draught. Didn't stop. Nothing to stop for."] }],
      }),
    ],
    trainers: [],
    items: [it('vv1', 18, -18, 'dusk_orb', 2), it('vv2', -34, -34, 'full_heal')],
    lore: [
      lo('lore_vesperveil_loose', -36, 34, 'Where Memory Is Loose', [
        'Built at the edge of the thinnest Seam in Ewa, on purpose, by people who wanted to hear it.',
        'A Ghost is the register of absence. Every one you meet here is the world remembering something it is no longer sure of.',
        'The Office chose the cliff beyond for its lens because the Held is thin here and easy to un-see through. Nyx Hollow hears them do it. She was not consulted.',
      ]),
      lo('lore_vesperveil_transcript', 44, -34, 'Night 414', [
        "'Let it have been that.' Every night. I write the form and then the line.",
        'Tonight the line had a place I know in it. I stopped writing.',
        'If you can read register notation: the pages are on the table. Take them to someone who can act. I can only hear.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['phantom_orb', ...stockFor('vesperveil')]),
    healer: true,
    gym: 'phantom_gym',
    storyRole: {
      1: null,
      2: 'Nyx hears the ledger read aloud each night; the Mire Route draw lands here as news.',
      3: null,
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.12 hollow_route ─────────────────────────
  {
    id: 'hollow_route',
    name: 'Hollow Road',
    kind: 'route',
    biome: 'vesper',
    type: 'Ghost',
    palette: 'vesper_hollow',
    layoutSeed: 0x4d1e000c,
    signature: 'marle_hedge',
    spawn: { x: -92, z: 0 },
    links: { w: 'vesperveil', e: 'forgewall' },
    gate: 'fault',
    encounterTable: 'enc_hollow_route',
    npcs: [
      npc('hollow_route.pilgrim', 'a Grey Year pilgrim', 0, 12, 'kimono_male', [
        "I walk here every Fall. My mother was fed from this hedge. I bring flowers. It's the least grey thing I can do for a grey road.",
      ]),
      npc('hollow_route.night_walker', 'a night-walker', -50, -30, 'ninja_male', [
        "Nettlewisp and murkrat after dark; miscarmen if it's late and you're quiet. Malice if you're unlucky. Wraithtide in the black pool — that one's not from here.",
      ]),
      npc('hollow_route.provisioner_a', 'Assessor Neve Odell', 10, 20, 'doctor_female_young', [
        "This is where it started. Tenure's been nil since — you can't draw twice on a road you've emptied. We keep the flowers up.",
      ], {
        react: [{ when: 'escorted_out', lines: ["Reeve let you walk. She'd have told you it was procedure. It wasn't. She likes you."] }],
      }),
      npc('hollow_route.zaptus_watcher', 'a child with a notebook', 50, 40, 'casual3_male', [
        'Zaptus float here in the day. I count them. Fewer than last year. Or I count worse.',
      ]),
    ],
    trainers: [
      tr('hollow_route.medium', 'Medium Sael', -40, 50, 'old_classy_female', [['nettlewisp', 27], ['murkrat', 28]], ['The absent whisper your name. They are not unkind. They are not anything.'], 1500),
      tr('hollow_route.clerk', 'Provision Clerk Osk', 60, -50, 'suit_male', [['umbrit', 28], ['darkone', 29]], ['The Office welcomes readers. Most leave before the second column.'], 1500),
    ],
    items: [it('hr1', 30, 70, 'full_heal', 2), it('hr2', -80, -70, 'phantom_orb')],
    lore: [
      lo('lore_hollow_yr0', 4, 8, 'Yr 0', [
        'Granary Clerk O. Marle, working in the disused Observatory, discovered that a recollection brought under the great lens could be directed.',
        'Drawn against Hollow Road, all hedgerows, over sixty-one nights: nettlewisp ×210, murkrat ×188, zaptus ×95, hexroach ×70, others.',
        'Provisioned: grain, Solenne, two months. 4,100 fed. Let it have been that there was bread.',
      ]),
      lo('lore_hollow_pool', -70, -40, 'The Black Pool', [
        'Water that is the register of water and holds a ghost of a harbour that was never here.',
        "Wraithtide appears in every black water in Ewa because the Held has begun filing it under 'lost' rather than under 'Saltmourn'.",
        'Witness it here and you have witnessed a memory learning to be homeless. Then take it home.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: null,
      2: 'The player crosses the first Seam ever spent, on the way to the room where spending is done.',
      3: null,
    },
    harvestState: 'thinning',
  },

  // ───────────────────────── 6.13 forgewall ─────────────────────────
  {
    id: 'forgewall',
    name: 'Forgewall',
    kind: 'town',
    biome: 'forge',
    type: 'Steel',
    palette: 'forge_forgewall',
    layoutSeed: 0x4d1e000d,
    signature: 'bastion_gate',
    spawn: { x: -50, z: 0 },
    links: { w: 'hollow_route', e: 'siege_route' },
    gate: 'wraith',
    encounterTable: null,
    npcs: [
      npc('forgewall.quartermaster', 'Quartermaster Sef Anvard', -20, 20, 'knight_male', [
        "Three full heals for the wall-watch and an acier from the road, and I'll count you one of ours.",
      ], {
        react: [{ when: 'siege_held', lines: ["They came, they said their piece, they lost in the open. That's a debt paid, not a war won. Rell knows the difference."] }],
      }),
      npc('forgewall.assessor_hollis', 'Assessor Bram Hollis', 0, -10, 'soldier_male', [
        'The notice is valid and the thirty days are up.',
        'That is the whole of my argument and it is a good one.',
      ], { when: 'saw_requisition', until: 'siege_held' }),
      npc('forgewall.wall_watch', 'a wall-watch', 30, -30, 'blue_soldier_male', [
        'Ninety names on our memorial. Small town. Every one of them the Office fed the family of. And we still said no. Both things.',
      ]),
      npc('forgewall.plater', 'an armour-plater', 20, 26, 'viking_male', [
        "Steel's the register of made things. Nothing remembered it; someone forged it. That's why the Office's people carry so much of it — a made thing argues with a memory.",
      ]),
      npc('forgewall.child', 'a child on the wall', 36, -20, 'casual3_male', [
        "I saw it! The Marshal and the one with the device and then Sable came out of our crowd and the grey ones went home!",
      ], { when: 'siege_held' }),
    ],
    trainers: [
      tr('hollis_siege', 'Assessor Bram Hollis', 0, -6, 'soldier_male', [['trenchtusk', 40], ['ironcarab', 39], ['gemknight', 39], ['rivetalon', 41], ['toxshade', 40]], ["The Marshal's declined. So — the old way. Whoever's standing at the end holds the gate."], 3000, null),
    ],
    items: [it('fw1', 18, -18, 'hyper_potion', 2), it('fw2', 38, 34, 'revive', 2)],
    lore: [
      lo('lore_forgewall_requisition', 0, -40, 'Requisition, Yr 41', [
        'The Office of Provision, under charter clause nine, requisitions the Seam beneath the bastion of Forgewall for drawing, effective thirty days from service.',
        'Assay: tenure very high; last drawn never. Estimated purchase: relief of two Grey Years.',
        'Comptroller O. Varn. Served with a bow, received with a refusal. Both in the ledger.',
      ]),
      lo('lore_forgewall_vault', 48, -56, 'The Sealed Vault', [
        'Under the bastion a blade was sealed with an oath. One oath, once. It is the reason the Seam here is so rich: a singular memory holds a great deal around it.',
        'The Office would not draw the oath itself — nil tenure — but would draw everything it holds up.',
        'Come with the Anvil Badge. The oath will look at you and decide whether you are the kind of holder it would answer.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['max_potion', ...stockFor('forgewall')]),
    healer: true,
    gym: 'iron_gym',
    storyRole: {
      1: null,
      2: 'The requisition; the town that refused; the standoff in the courtyard.',
      3: 'Bankaiser in the sealed vault under the bastion (badge gate, §7).',
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.14 siege_route ─────────────────────────
  {
    id: 'siege_route',
    name: 'Siege Road',
    kind: 'route',
    biome: 'forge',
    type: 'Steel',
    palette: 'forge_siege',
    layoutSeed: 0x4d1e000e,
    signature: 'old_siege_line',
    spawn: { x: -92, z: 0 },
    links: { w: 'forgewall', e: 'skyrend' },
    gate: 'wraith',
    encounterTable: 'enc_siege_route',
    npcs: [
      npc('siege_route.sable', 'Sable', -60, 8, 'casual2_male', ["Don't make it a thing.", 'So get this far.'], { when: 'siege_held', until: 'act3_started' }),
      npc('siege_route.scrapper', 'a scrapper', 20, -30, 'viking_male', [
        "Engines from a war. Whose? Nobody knows. Not drawn on — just old enough to have thinned by itself. That happens too. The Office isn't wrong about that.",
      ]),
      npc('siege_route.acier_hunter', 'an acier-hunter', 60, 40, 'knight_male', [
        "Acier in the engine-hulks. Steel and fighting. The rarest made thing on the road and it hits back. Twice I've seen one. Twice.",
      ]),
      npc('siege_route.provisioner_b', 'a Provision courier, resting', -20, 50, 'suit_male', [
        "Carrying Forgewall's no to the Comptroller. First no I've ever carried. It's not heavier. I thought it would be heavier.",
      ], { when: 'siege_held' }),
    ],
    trainers: [
      tr('siege_route.sentinel', 'Sentinel Cor', -30, -50, 'knight_golden_male', [['grubolt', 32], ['coldplate', 33]], ['None pass the wall unproven.'], 2000),
      tr('siege_route.engineer', 'Salvage Engineer Rue', 50, -60, 'cowboy_female', [['scraphog', 33], ['alloylark', 34]], ['Every hulk here fought for something. Show me what yours fight for.'], 2000),
    ],
    items: [it('sr1', 30, 70, 'revive'), it('sr2', -80, -60, 'max_ether')],
    lore: [
      lo('lore_siege_engines', 64, -66, 'The Nameless War', [
        'These engines fought for something. No record says what. No one drew on it; it thinned by itself, the way the Office says everything does.',
        'The Office is right that the world forgets on its own. It is wrong that this means it does not matter how fast.',
        'A war that faded is a war nobody has to have again. A hedge that faded fed no one twice.',
      ]),
      lo('lore_siege_alloylark', 0, 60, 'Rivet and Feather', [
        'Alloylark nest in the engine-barrels by day; the Held remembers birds in the guns and finds nothing strange in it.',
        "Steel is the register of the made; Flying, of the released. A made thing that lets go is the Wardens' oldest emblem.",
        "It is on Sylvane's door at Skyrend. Climb and see.",
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: { 1: null, 2: 'Sable, coatless, walking beside the player without making it a thing.', 3: null },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.15 skyrend ─────────────────────────
  {
    id: 'skyrend',
    name: 'Skyrend Peak',
    kind: 'town',
    biome: 'sky',
    type: 'Dragon',
    palette: 'sky_skyrend',
    layoutSeed: 0x4d1e000f,
    signature: 'sky_shrine_records',
    spawn: { x: -50, z: 0 },
    links: { w: 'siege_route', e: 'ascent_route' },
    gate: 'anvil',
    encounterTable: 'enc_skyrend',
    npcs: [
      npc('skyrend.shrinekeeper', 'Under-keeper Rowan Vane', 20, -20, 'kimono_male', [
        'Serpyre on the Ascent, sixty species in your device, and the Ascend Badge — then the shrine will show you the upper room.',
      ], {
        react: [{ when: 'saw_star_counts', lines: ["You've seen the charts. Most people look at one. You looked at the gap between them."] }],
      }),
      npc('skyrend.astronomer', 'an astronomer', -10, -30, 'old_classy_female', [
        'I have charted the sky since I was a girl. Fewer stars each year. Slow, then faster. The Office says natural. I say: natural, and.',
      ]),
      npc('skyrend.roost_keeper', 'a roost-keeper', 30, 20, 'cowboy_male', [
        'Scalewisp on the cliffs, glacifang after dark. Dragons are the register of things that were certain from the start. Nothing up here was ever a cub.',
        "I'll drill a move into anything that can fly or fight for it. Three thousand, paid up front.",
      ], { tutor: ['Brave Bird', 'Sky Pierce', 'Dragon Rush', 'Double Edge'] }),
      npc('skyrend.pilgrim', 'a Warden pilgrim', -20, 20, 'kimono_male', [
        "The Wardens hold no office and want none. They counted the sky for three hundred years and built twelve devices. That's their whole answer to the Provision. It's a slow answer.",
      ]),
    ],
    trainers: [],
    items: [it('sk1', 18, -18, 'hyper_potion', 2), it('sk2', -34, -34, 'full_heal', 2)],
    lore: [
      lo('lore_skyrend_charts', 24, -26, 'Three Hundred Years', [
        'Chart 1: the sky as it was. Chart 300: the sky as it is. Count the points if you doubt.',
        'The loss is old, slow and natural. The Wardens have never said otherwise, and neither has the Office.',
        'The loss steepens in Yr 0 of the Office. The Wardens have said this. The Office has not.',
      ]),
      lo('lore_skyrend_emblem', 16, -24, 'Rivet and Feather', [
        "A made thing that lets go. The Wardens' mark since before counting.",
        'We hold records, not power. A record is a made thing. It must let go of the thing it records or it becomes a cage.',
        'The Attestor is a record. It holds without owning. That is the difference between it and a ledger.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['mythos_orb', 'max_revive', ...stockFor('skyrend')]),
    healer: true,
    gym: 'draco_gym',
    storyRole: { 1: null, 2: null, 3: 'The star-counts; the Wardens explained; the Ascend Badge as judgement.' },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.16 ascent_route ─────────────────────────
  {
    id: 'ascent_route',
    name: 'The Ascent',
    kind: 'route',
    biome: 'sky',
    type: 'Dragon',
    palette: 'sky_ascent',
    layoutSeed: 0x4d1e0010,
    signature: 'glacier_melt',
    spawn: { x: -92, z: 0 },
    links: { w: 'skyrend', e: 'eclipse_shrine' },
    gate: 'anvil',
    encounterTable: 'enc_ascent_route',
    npcs: [
      npc('ascent_route.guide', 'a mountain guide', -60, 10, 'cowboy_male', [
        "Serpyre high up, budwing in the meadows, blizzhowl after dark. Don't fight a serpyre tired.",
      ]),
      npc('ascent_route.hermit', 'a hermit', 30, -50, 'old_classy_male', [
        'Came up here to be forgotten. Turns out the Held remembers hermits very clearly. Something about the silence.',
      ], {
        react: [{ when: 'act3_started', lines: ["Thirty days, the Comptroller says. To make the world not need remembering. I came up here for that and it's the loneliest thing there is."] }],
      }),
      npc('ascent_route.cirque_watcher', 'a cirque-watcher', -70, -70, 'kimono_male', [
        "There was a winter once that didn't end. One winter. It's in the cirque still, a memory of cold that never spent itself.",
      ]),
    ],
    trainers: [
      tr('ascent_route.tamer', 'Dragon-Tamer Vir', -20, 40, 'knight_golden_male', [['scalewisp', 38], ['budwing', 39]], ['Few climb this high. Fewer descend.'], 2600),
      tr('ascent_route.warden_pilgrim', 'Warden Pilgrim Ilse', 50, 30, 'kimono_male', [['tidalfang', 39], ['glacifang', 40]], ['The shrine above is older than counting. Prove you can count.'], 2600),
    ],
    items: [it('ac1', 30, 70, 'full_heal', 3), it('ac2', -60, 80, 'revive', 2)],
    lore: [
      lo('lore_ascent_thin_air', 70, -30, 'Thin Air', [
        'The Held is thin up here not because it was drawn but because it was never thick. Few people; few memories; a sky and a mountain.',
        'This is what a place looks like when it has always been nearly forgotten and is at peace with it.',
        'It is not the same as a settled Seam. Learn the difference by standing in both.',
      ]),
      lo('lore_ascent_cirque', -86, -86, 'The Winter That Stayed', [
        'One winter did not end. The Held could not decide it had, and so a memory of endless cold precipitated here and has never thawed.',
        'Singular. Nil tenure. The Office has assayed it and gone home.',
        'It answers Champions. Become one.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: { 1: null, 2: null, 3: 'The climb; Glacinid in the frozen cirque after the title (§7).' },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.17 solenne ─────────────────────────
  {
    id: 'solenne',
    name: 'Solenne, the Sun-City',
    kind: 'town',
    biome: 'capital',
    type: null,
    palette: 'capital_solenne',
    layoutSeed: 0x4d1e0011,
    signature: 'provision_hall',
    spawn: { x: -50, z: 0 },
    links: { w: 'eclipse_shrine', n: 'celestial_spire' },
    gate: 'ascend',
    encounterTable: 'enc_solenne',
    npcs: [
      npc('solenne.comptroller_varn', 'Comptroller Odile Varn', -3.5, -22.5, 'old_classy_female', [
        'I have never asked you to trust me. I have asked you to read.',
        'Thirty days.',
      ], { when: 'badge:ascend', until: 'spire_confronted' }),
      npc('solenne.clerk_of_hall', 'the Clerk of the Hall', -8, -22, 'suit_male', ["The ledger's here. Anyone may read it. Nobody does."], {
        react: [
          { when: 'name_held', lines: ['Solenne. Solenne! I said it to the doorman four times. He said it back four times.'] },
          { when: 'saw_capital_thinning', lines: ["The, the — I've lived here fifty years."] },
        ],
      }),
      npc('solenne.bursar_quill', 'Bursar Elias Quill', 3.5, -22.5, 'suit_male', ["I've added a column.", 'Costs that appear on paper get argued about.'], { when: 'name_held' }),
      npc('solenne.hospital_nurse', 'a nurse at the Provision Hospital', 34, 20, 'doctor_female_young', [
        "Dispensary's stocked. Always has been. I've worked here twenty years.",
      ], {
        react: [{ when: 'sable_turned', lines: ["Teo's bed is paid a different way now. Some Warden. He doesn't know and I'm not telling him; he's twelve."] }],
      }),
      npc('solenne.granary_clerk', 'a granary clerk', -30, 20, 'casual_male', [
        "Eleven bad years since the Office. Nobody hungry in any of them. I'm not sorry. I'm — I'd like to know what it cost. That's all. I'd like the number.",
      ]),
    ],
    trainers: [],
    items: [it('so1', 40, -40, 'max_revive'), it('so2', -40, 40, 'star_piece')],
    lore: [
      lo('lore_solenne_greyyear', -14, -36, 'District Rolls, Grey Year', [
        "'Mirevale district: 612 marked likely. Saltmourn: 890. Solenne inner: 1,400 …' The clerk who kept this roll was O. Marle.",
        "'Twelfth of Winter. The lens. I have done a thing and the sacks are full. I will do it again tomorrow and write both down.'",
        'He wrote both down. Every Comptroller since has. Read the second column.',
      ]),
      lo('lore_solenne_lectern', -7, -20, 'The Public Ledger', [
        'Working copy at the Observatory; this copy monthly by courier. 1,400 pages. Two columns.',
        'Anyone may read. Register notation on the draw side: species, place, count.',
        'If you can read it, you are one of thirteen people in Ewa who can. Twelve carry devices. One is the Comptroller.',
      ]),
    ],
    warps: [],
    shop: TOWN_SHOP(['mythos_orb', 'max_potion', 'full_restore', 'max_revive', 'max_ether', 'rarecandy', ...stockFor('solenne')]),
    healer: true,
    gym: null,
    storyRole: {
      1: null,
      2: null,
      3: 'The Provision Hall and its lectern; the Permanence notice; the league; the city that forgets its own name for a day and gets it back.',
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.18 eclipse_shrine ─────────────────────────
  {
    id: 'eclipse_shrine',
    name: 'The Eclipse Shrine',
    kind: 'story',
    biome: 'shrine',
    type: 'Cosmic',
    palette: 'shrine_eclipse',
    layoutSeed: 0x4d1e0012,
    signature: 'altar_stone',
    spawn: { x: -70, z: 0 },
    links: { w: 'ascent_route', e: 'solenne' },
    gate: 'ascend',
    encounterTable: 'enc_eclipse_shrine',
    npcs: [
      npc('eclipse_shrine.shrinekeeper', 'the Shrinekeeper', 0, -60, 'kimono_male', ['Come back when you have a hundred.'], {
        when: 'badge:ascend',
        react: [{ when: 'mythical_night', lines: ['It came to be counted. Three hundred years. You were the one it counted for.'] }],
      }),
      npc('eclipse_shrine.night_warden', 'a night-warden', -30, -20, 'ninja_male', [
        "Look up. That's the sky as it was. The Wardens keep it here so someone remembers what the count started at.",
      ]),
      npc('eclipse_shrine.pilgrim', 'a pilgrim', 30, 20, 'kimono_male', [
        'Malice and devourest after dark. Ghost and fairy — absence and wonder. The two registers the first night was filed under.',
      ]),
    ],
    trainers: [],
    items: [it('es1', -40, 40, 'hyper_potion', 2), it('es2', 50, -30, 'revive')],
    lore: [
      lo('lore_eclipse_firstnight', 6, -66, 'The First Night', [
        'Before there was a morning there was a dark to have it against. The Held remembers that dark as a single thing and calls it nothing; the Wardens called it Noxmyth.',
        'Not evil. The register of the refused is Dark; the first night refused nothing. It simply came first.',
        'It is counted here. It comes to be counted by whoever has counted most.',
      ]),
      lo('lore_eclipse_oldsky', -50, 50, 'Chart One', [
        'The sky above this altar is drawn as it was on the first chart. Stand here and look up and you are seeing three hundred years ago.',
        'Then walk to Skyrend and look up again.',
        'That difference is the whole argument, and both sides agree on it.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: null,
      2: null,
      3: "The Wardens' oldest shrine; where the first night was first counted; where Noxmyth comes to a holder with a hundred witnessed.",
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.19 umbral_observatory ─────────────────────────
  {
    id: 'umbral_observatory',
    name: 'Umbral Observatory',
    kind: 'story',
    biome: 'vesper',
    type: 'Ghost',
    palette: 'vesper_observatory',
    layoutSeed: 0x4d1e0013,
    signature: 'great_lens',
    spawn: { x: 0, z: 70 },
    links: { s: 'vesperveil' },
    gate: 'wraith',
    encounterTable: 'enc_umbral_observatory',
    npcs: [
      npc('umbral_observatory.bursar_quill', 'Bursar Elias Quill', 0, 40, 'suit_male', ["I write the draw before the purchase, so I can't forget to."], {
        when: 'observatory_open',
        react: [{ when: 'spire_confronted', lines: ["She's gone up. I told her the name was held. She said 'held by whom' and I didn't know. I write the book; I don't read the Wardens'."] }],
      }),
      npc('umbral_observatory.comptroller_varn', 'Comptroller Odile Varn', 0, -50, 'old_classy_female', ['Show me the column where that was wrong.'], {
        when: 'saw_holding',
        until: 'act3_started',
        react: [{ when: 'sable_turned', lines: ["The Junior Assessor has resigned. On the ledger. I've left the token where it lies; it's a record."] }],
      }),
      npc('umbral_observatory.sable', 'Sable', 10, -44, 'casual2_male', ["I read it. That's all."], { when: 'ledger_read', until: 'escorted_out' }),
      npc('umbral_observatory.assessor_reeve', 'Assessor Tamsin Reeve', -10, 0, 'doctor_female_young', ['Nothing personal. It never is.'], {
        when: 'sable_turned',
        react: [{ when: 'new_column', lines: ["Attested. It's a good word. Quill's. I've started asking, at the Seams. Nobody's ever asked before."] }],
      }),
      npc('umbral_observatory.aonred_keeper', 'a lens-technician', 40, -20, 'casual2_female', [
        "Darkone under the lens comes out certain. Aonred or darkyon, depending what it was watched doing. We let a few go. Quill says a memory we made certain isn't ours to spend.",
      ]),
    ],
    trainers: [
      tr('sable_observatory', 'Sable', 10, -40, 'casual2_male', [['caldermole', 45], ['glimmereen', 44], ['bogmaw', 44], ['murmink', 43], ['ignispectre', 45]], ["I'm going to fight you because it's the only thing in this room I know how to do."], 2500, null),
      tr('reeve_observatory', 'Assessor Tamsin Reeve', -10, 4, 'doctor_female_young', [['chrysotox', 45], ['fedoraith', 45], ['toxshade', 46], ['glaciarm', 44], ['aonred', 47]], ["You've read it. Now you leave, because that's the procedure, and I'm the procedure."], 2500, null),
    ],
    items: [it('uo1', -40, 40, 'dusk_orb', 2), it('uo2', 50, 50, 'phantom_orb', 2)],
    lore: [
      lo('lore_observatory_form', -6, -56, 'The Form', [
        "'Let it have been that —'. The Bursar names the purchase in the charter's words and the substrate re-remembers.",
        "The draw is stated first, aloud, so that the room hears what it costs. Marle's rule. No Bursar has ever skipped it.",
        'A mile west a woman hears every word through her window. The Office has known this since Yr 12 and has never drawn on her.',
      ]),
      lo('lore_observatory_ledger_line', 6, -56, 'Yr 38, 14th of Fall', [
        'PROVISIONED — Marrowdig: relief of the Deep Cut cave-in; 61 recovered; shaft restored.',
        'DRAWN AGAINST — mire_route · seedrift ×22 · mossling ×31 · bloomsprite ×4 · smellduck ×19 · resilian ×9 (tenure high; Seam last drawn Yr 17).',
        'Below, in a different hand, a brass token pressed into the paper hard enough to dent it.',
      ]),
    ],
    warps: [{ id: 'umbral_observatory.stair', x: 0, z: 30, toX: 0, toZ: -40, label: 'The stair to the lens room' }],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: null,
      2: "The holding, the ledger, Sable's turn, the escort out.",
      3: 'Galaxion at the great lens (gate flag:ledger_read, §7).',
    },
    harvestState: 'harvested',
  },

  // ───────────────────────── 6.20 celestial_spire ─────────────────────────
  {
    id: 'celestial_spire',
    name: 'The Celestial Spire',
    kind: 'story',
    biome: 'shrine',
    type: 'Cosmic',
    palette: 'shrine_spire',
    layoutSeed: 0x4d1e0014,
    signature: 'top_step',
    spawn: { x: 0, z: 70 },
    links: { s: 'solenne' },
    gate: 'ascend',
    encounterTable: 'enc_celestial_spire',
    npcs: [
      npc('celestial_spire.comptroller_varn', 'Comptroller Odile Varn', 0, -60, 'old_classy_female', ["I'd rather nobody stood there.", 'Who has the name.'], {
        when: 'act3_started',
        until: 'spire_confronted',
      }),
      npc('celestial_spire.wynn', 'Prof. Wynn', -10, -50, 'old_classy_female', ["She left the lens. Dark. I'll not touch it; I've touched enough of them."], {
        when: 'spire_confronted',
        react: [{ when: 'mythical_morning', lines: ['The first morning. In your device. I sent a child up a road with one partner and a meter reading. Look what you held.'] }],
      }),
      npc('celestial_spire.sable', 'Sable', 10, -50, 'casual2_male', [
        "Teo's coming out in the spring. Not cured. Better. The Warden pays and doesn't ask for anything and I keep waiting for her to.",
      ], { when: 'spire_confronted' }),
      npc('celestial_spire.keeper', 'the Spire-keeper', -30, 30, 'kimono_male', [
        'The first morning was counted here, once, three hundred years ago. It comes to whoever has counted most. Not to be owned. To be counted again.',
      ]),
    ],
    trainers: [
      tr('varn_spire', 'Comptroller Odile Varn', 0, -56, 'old_classy_female', [['archonosis', 53], ['velvetomb', 53], ['necrogeist', 54], ['glaciarm', 52], ['rivetalon', 54], ['aonred', 55]], ["Stand there anyway, if you must; I've never once asked anyone to leave a room they'd read their way into."], 6000, null),
    ],
    items: [it('cs1', 40, 30, 'max_revive'), it('cs2', -50, 40, 'full_restore')],
    lore: [
      lo('lore_spire_firstmorning', 6, -66, 'The First Morning', [
        'Before there was anything to see, there was light to see it by. The Held remembers that as one thing and the Wardens called it Lumyth.',
        'Not good. The register of wonder is Fairy; the first morning was filed under Cosmic and Psychic — the world, and the mind that noticed it.',
        'It comes to be counted last of all. A holder with everything else is the only one it trusts.',
      ]),
      lo('lore_spire_vigil', 30, 50, 'The Vigil', [
        'We do not worship the light; worship asks only for your knees. We keep a record, which asks for your whole life and gives you a number.',
        'If you climbed to kneel, climb down. If you climbed to count: sit. The count is long.',
        'The Comptroller climbed to end the counting. That was the one thing this stair was never for.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: {
      1: null,
      2: null,
      3: 'The Permanence withdrawal; where the first morning was first counted; where Lumyth comes to a holder with a hundred and twenty witnessed.',
    },
    harvestState: 'intact',
  },

  // ───────────────────────── 6.21 the_rift ─────────────────────────
  {
    id: 'the_rift',
    name: 'The Rift Below',
    kind: 'story',
    biome: 'rift',
    type: null,
    palette: 'rift_rift',
    layoutSeed: 0x4d1e0015,
    signature: 'the_edge',
    spawn: { x: 0, z: -70 },
    links: { n: 'marrowdig' },
    gate: 'ascend',
    encounterTable: 'enc_the_rift',
    npcs: [
      npc('the_rift.wynn', 'Prof. Wynn', -8, 50, 'old_classy_female', ['This is what she was buying.'], {
        when: 'name_held',
        react: [{ when: 'leg_voidraxis', lines: ["You looked at it and remembered its face. Your device has an entry for a thing that was here before entries. I don't know what that means. I'd like to find out with you."] }],
      }),
      npc('the_rift.sable', 'Sable', 8, 50, 'casual2_male', [
        "Your device can't file it under anything.",
        "Don't go down to the edge. …Or do. You're the one who held a city's name. Maybe the before is afraid of you.",
      ], { when: 'name_held' }),
      npc('the_rift.rift_watch', 'a Warden rift-watch', -30, -30, 'ninja_male', [
        "We post a watch here in shifts. Nothing to do but count. The count here is always nought. That's the job: to notice when it isn't.",
      ], { when: 'name_held' }),
    ],
    trainers: [],
    items: [it('rf1', -40, 20, 'aether_orb'), it('rf2', 50, -20, 'big_nugget')],
    lore: [
      lo('lore_rift_floor', 0, 60, 'The Floor', [
        'Before the first morning and the first night there was this: nothing to remember and nothing remembering.',
        'Not evil. Older than evil. The Held is the latecomer; this is what it is held against.',
        'Everything the Office ever settled was a step toward here. Everything the Attestors ever held was a step back from it. Neither side had seen the floor. Now one has.',
      ]),
      lo('lore_rift_before', 0, 74, 'Voidraxis', [
        'The memory of before there was anything to remember. Cosmic, because it is about the world and not in it; Dragon, because it was certain from the start.',
        'No trainer who has seen its face has remembered it — until an Attestor, which remembers for them.',
        'It waits at the edge for the kind of holder who has held everything else. It does not want anything. It has never wanted. Wanting came with the morning.',
      ]),
    ],
    warps: [],
    shop: null,
    healer: false,
    gym: null,
    storyRole: { 1: null, 2: null, 3: 'What Varn was buying, shown; Voidraxis at the edge after the title (§7).' },
    harvestState: 'harvested',
  },
];
