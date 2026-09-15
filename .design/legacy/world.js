/* ============================================================================
   world.js — CONTENT / STORY for the Ewa Region.
   The journey is TOWN + ROUTE pairs (mainline-style): towns hold the gym, shop,
   healer, townsfolk and story beats; routes hold tall-grass wilds, trainers,
   hidden items and landmarks. Plus the capital Solenne and the story zones.
   Each area is data-driven (npcs / trainers / items / landmark) so overworld.js
   can build a distinct, living place from it.
   ========================================================================== */

export const BADGES = [
  { id: 'bloom',   name: 'Bloom Badge',   type: 'Grass' },
  { id: 'ember',   name: 'Ember Badge',   type: 'Fire' },
  { id: 'current', name: 'Current Badge', type: 'Water' },
  { id: 'circuit', name: 'Circuit Badge', type: 'Electric' },
  { id: 'fault',   name: 'Fault Badge',   type: 'Rock' },
  { id: 'wraith',  name: 'Wraith Badge',  type: 'Ghost' },
  { id: 'anvil',   name: 'Anvil Badge',   type: 'Steel' },
  { id: 'ascend',  name: 'Ascend Badge',  type: 'Dragon' },
];

/* shorthands.
   np()'s trailing options object carries an optional look (opt), story gates
   (when = only appears once this flag is set; until = vanishes once this flag
   is set), and react = [{ when, lines }] alternate lines chosen by flag state
   (first match wins, so list the most-progressed first). lo() = a hidden lore
   tablet: an inscription tucked in a far corner that rewards exploration. */
const tr = (x, z, name, team, lines, reward, opt) => ({ x, z, name, team, lines, reward: reward || 300, opt: opt || {} });
const np = (x, z, name, lines, o) => ({ x, z, name, lines, opt: (o&&o.opt)||{}, react: o&&o.react, when: o&&o.when, until: o&&o.until });
const it = (x, z, item, qty, id) => ({ x, z, item, qty: qty || 1, id });
const lo = (x, z, id, title, text) => ({ x, z, id, title, text });

/* Rival Sable's two looks: the eclipse-grey of the turncoat phase, and the
   cast-off-robe look once redeemed. Reused across the cameo appearances below. */
const SABLE_GREY = { robe:'#2e2b3a', hat:'cap', accent:'#9a8fb0', hair:'#2b2336', skin:'#caa07a', hairStyle:'spiky', eyeColor:'#7be0d0', scale:1.06, pose:'crossed' };
const SABLE_FREE = { skin:'#caa07a', shirt:'#4a4466', hair:'#2b2336', accent:'#7be0d0', pants:'#33304a', hairStyle:'spiky', eyeColor:'#7be0d0', scale:1.06 };

export const AREAS = {
  /* ───────── 1 · GRASS · Mirevale ───────── */
  mirevale: {
    name: 'Mirevale', type: 'Grass', kind: 'town', music: 'overworld',
    ground: '#5f7e44', ground2: '#48632f', sky: '#86946e', fog: 0.012, dark: 0.1,
    props: 'forest', landmark: 'vein', veinColor: '#7be08a',
    gym: 'verdant_gym', shop: true, healer: true, links: { east: 'mire_route' },
    npcs: [
      np(6, -6, 'Fenkeeper', ["Mirevale grows in the canopy's shade. Lately even that shade looks thin.","Lumyth's light should pour through the leaves at noon. It doesn't anymore."],
        { react: [
          { when:'saw_order', lines:["Grey-robed folk passed through, asking the way to the Veins. I didn't like their eyes.","Whatever they want with the light, it isn't to keep it burning."] },
          { when:'badge_bloom', lines:["You bested Mira? Then the Grove trusts you. Good — it'll need someone to trust soon."] },
        ] }),
      np(-6, -8, 'Child', ["When I grow up I'll get a partner and walk all eight badges!"]),
      np(8, 6, 'Old Woman', ["My grandmother said the light circles once a hundred years. It's early. That frightens me."]),
      np(-9, 9, 'Berry-Gardener', ["Pick a partner that suits you, not one that suits the badge. The badge comes either way."]),
      // Rival Sable — the eager friend, before the Order ever crosses your path.
      np(3, 8, 'Sable', ["So Wynn gave you one too. Figures.","Listen — strength is strength, wherever it comes from. I mean to get strong fast. Faster than you.","Race you to the first badge. Don't sulk when I win."],
        { opt: SABLE_FREE, when:'done_intro', until:'saw_order' }),
    ],
    items: [ it(-14, 6, 'potion', 1, 'mv1'), it(14, -18, 'spark_orb', 2, 'mv2'), it(-30, -28, 'crest_orb', 1, 'mv3') ],
    lore: [ lo(30, 28, 'lore_grove', 'Grove-Stone',
      ["'The first Wardens did not plant this grove for shade,' the worn stone reads.",
       "'They grew it as a sieve — to catch Lumyth's light and break its glare into something a land could live beneath.'",
       "'When the canopy thins, it is not the trees that are dying. It is the light they were built to strain.'"]) ],
  },
  mire_route: {
    name: 'Mire Route', type: 'Grass', kind: 'route', music: 'overworld',
    ground: '#56743f', ground2: '#3e5a2c', sky: '#7e8f66', fog: 0.014, dark: 0.18,
    props: 'forest', tallGrass: true, encounter: 'mire',
    links: { west: 'mirevale', east: 'cinderhold' }, gate: 'bloom',
    npcs: [ np(0, 12, 'Sign', ["MIRE ROUTE — Cinderhold ahead. Tall grass rustles with young Ewamon."]) ],
    trainers: [
      tr(-12, 0, 'Forager Pim', [['mossling', 4], ['glimp', 4]], ["The grass hides more than berries!"], 320),
      tr(14, -8, 'Bug-Catcher Tev', [['seedrift', 5]], ["Caught somethin' rare in the fen — wanna see?"], 280),
    ],
    items: [ it(-16, 14, 'potion', 1, 'mr1'), it(16, 16, 'crest_orb', 1, 'mr2'), it(30, -26, 'revive', 1, 'mr3') ],
    lore: [ lo(-30, -26, 'lore_first', 'Mossed Marker',
      ["Lichen all but swallows the carving. You scrape it clear.",
       "'Before the Mote there was the First Dark, and the Dark was not empty — it was full, and it was awake.'",
       "'Lumyth is only a splinter of a greater light, flung down to drive the Dark beneath the world. A splinter can be put out.'"]) ],
  },
  /* ───────── 2 · FIRE · Cinderhold ───────── */
  cinderhold: {
    name: 'Cinderhold', type: 'Fire', kind: 'town', music: 'overworld',
    ground: '#5a463c', ground2: '#3e2f28', sky: '#7a5a4e', fog: 0.017, dark: 0.32,
    props: 'volcano', landmark: 'vein', veinColor: '#ff7a3a',
    gym: 'blaze_gym', shop: true, healer: true, links: { west: 'mire_route', east: 'ash_route' },
    npcs: [
      np(7, -5, 'Ashwife', ["The volcano slept for years. Now it's warm again — and grey-robed folk are bleeding it dry."],
        { react: [ { when:'saw_order', lines:["You faced them in the harvest-field! Bless you. They drained three canisters before you came.","Karn says the Ember Vein's running cold for the first time in a century. Cold. A volcano."] } ] }),
      np(-7, 5, 'Smith', ["Karn keeps the forge true. If the Ember Vein goes out, so does Cinderhold."]),
      np(9, 7, 'Soot-Child', ["I dared Bo to touch a canister the grey-robes left. His hand went cold for a whole day!"]),
    ],
    items: [ it(-15, -16, 'superpotion', 1, 'ch1'), it(31, 27, 'ember_orb', 2, 'ch2') ],
    lore: [ lo(-31, 27, 'lore_ember', 'Forge-Tablet',
      ["Cast into the foundry's oldest wall, the iron letters are still warm.",
       "'Lumyth does not simply shine. Each hundred-year circling it must be FED — light given back at every Vein, or the Mote thins and gutters.'",
       "'Cinderhold's forge is no mere smithy. It is a feeding-mouth. Keep it lit, or keep a candle for the world.'"]) ],
  },
  ash_route: {
    name: 'Ash Route', type: 'Fire', kind: 'route', music: 'overworld',
    ground: '#52423a', ground2: '#352a24', sky: '#6e564a', fog: 0.02, dark: 0.35,
    props: 'volcano', tallGrass: true, encounter: 'ash',
    links: { west: 'cinderhold', east: 'saltmourn' }, gate: 'ember',
    npcs: [
      np(-2, 14, 'Sign', ["ASH ROUTE — Saltmourn ahead. Mind the warm rocks; the Vein runs strange."]),
      np(9, 11, 'Ash-Walker', ["Grey-robes came through with their canisters, bound for the coast. Whatever they're bleeding from the Vein, the sea's next."]),
    ],
    trainers: [
      tr(-12, 2, 'Kindler Rosa', [['flampling', 8], ['embrock', 9]], ["Feel the heat? It's only getting started."], 520, { shirt:'#c0492f' }),
      tr(13, -6, 'Hiker Born', [['pebfist', 9], ['coalette', 10]], ["These rocks are warm to the touch now. Unnatural."], 540),
    ],
    items: [ it(16, 14, 'ember_orb', 2, 'ar1'), it(-16, -14, 'potion', 2, 'ar2'), it(-31, 28, 'superpotion', 1, 'ar3') ],
    lore: [ lo(31, -27, 'lore_canister', 'Dropped Canister',
      ["A grey-robe left a silver canister behind, a service-log etched on its side.",
       "'RITE INVERTED. Do NOT feed the Vein. SIPHON. Each draw dims the Mote one part in a thousand.'",
       "'When the thousandth part is drawn, the false sun goes out, and the True Dark inherits the sky. — by the Hand of the Hierophant.'"]) ],
  },
  /* ───────── 3 · WATER · Saltmourn ───────── */
  saltmourn: {
    name: 'Saltmourn', type: 'Water', kind: 'town', music: 'overworld',
    ground: '#b8a878', ground2: '#7f8a78', sky: '#9fb6c4', fog: 0.014, dark: 0.22,
    props: 'harbor', landmark: 'chapel',
    gym: 'tidal_gym', shop: true, healer: true, links: { west: 'ash_route', east: 'tide_route' },
    npcs: [
      np(6, -4, 'Old Sailor', ["Tide climbs a hand's-width higher every year now. Whole districts are under the water."],
        { react: [ { when:'saw_shard', lines:["The deep-folk say the sea rises when the light fails. It rose before. It swallowed a city whole.","We built Saltmourn on those drowned roofs. Pray we don't join them."] } ] }),
      np(-8, 6, 'Net-Mender', ["Captain Maren will ferry you past the foul water. If anyone can read this tide, it's her."]),
      np(8, 7, 'Lamp-Keeper', ["I keep the harbor-lights burning all night now. Folk can't sleep in a dark they don't trust."]),
    ],
    items: [ it(15, -16, 'tide_orb', 2, 'sm1'), it(-30, -27, 'hyperpotion', 1, 'sm2') ],
    lore: [ lo(30, -27, 'lore_tide', 'Barnacled Slab',
      ["Half-drowned at the tideline, the slab surfaces only at the lowest ebb.",
       "'When last the light failed, the sea forgot its shore and climbed. The first capital — Old Solenne — drowned in a single night.'",
       "'We do not build below the high mark. We do not name the drowned. And we do not let the light fail again.'"]) ],
  },
  tide_route: {
    name: 'Tide Route', type: 'Water', kind: 'route', music: 'overworld',
    ground: '#a89a6a', ground2: '#6f7e74', sky: '#92aec0', fog: 0.016, dark: 0.25,
    props: 'harbor', tallGrass: true, encounter: 'tide', water: true,
    links: { west: 'saltmourn', east: 'stormrook' }, gate: 'current',
    npcs: [
      np(-2, 14, 'Sign', ["TIDE ROUTE — Stormrook ahead. Keep to the bridges; the deep water bites."]),
      np(9, 11, 'Beachcomber', ["Found a grey-robe's canister washed up — ice-cold and empty. They're draining the light into the sea itself."]),
    ],
    trainers: [
      tr(-12, 4, 'Swimmer Cael', [['mudbub', 12], ['slushpup', 13]], ["The current's mine to ride!"], 720),
      tr(12, -8, 'Fisher Dell', [['brookrawl', 13], ['tidespine', 14]], ["Reeled in a biter the other day. You'll do."], 760),
    ],
    items: [ it(16, 16, 'hyperpotion', 1, 'tr1'), it(-16, -12, 'crest_orb', 2, 'tr2') ],
  },
  /* ───────── 4 · ELECTRIC · Stormrook ───────── */
  stormrook: {
    name: 'Stormrook', type: 'Electric', kind: 'town', music: 'overworld',
    ground: '#4a4a56', ground2: '#34343e', sky: '#5a5a72', fog: 0.016, dark: 0.4,
    props: 'city', landmark: 'tower',
    gym: 'volt_gym', shop: true, healer: true, links: { west: 'tide_route', east: 'galvan_route' },
    npcs: [
      np(7, -5, 'Engineer', ["The grid browns out every night. Something's siphoning the current — and it isn't the storms."],
        { react: [ { when:'saw_shard', lines:["The brownouts track the light, not the load. When Lumyth dims, the city dims. They're wired together.","Zia won't say it aloud, but the grid was built to draw from the Mote itself. If it goes dark, so do we — for good."] } ] }),
      np(-7, 6, 'Neon Kid', ["Zia runs the whole grid from the spire. Grey-robes tried to hijack it last week."]),
      np(9, 8, 'Linewoman', ["Climbed the spire to re-fuse the mains. The feed-cable runs straight up past the clouds. To what, I won't guess."]),
    ],
    items: [ it(-15, -16, 'revive', 1, 'st1'), it(31, -27, 'superpotion', 2, 'st2') ],
    lore: [ lo(-31, -27, 'lore_grid', 'Spire-Plate',
      ["A brass dedication plate, green with age, bolted to the spire's foot.",
       "'STORMROOK GRID — commissioned to draw not from storm nor coal, but from the Mote above, that the city might never know a dark hour.'",
       "'Should the lamps dim of their own accord, do not seek the fault in the wires. Seek it in the sky.'"]) ],
  },
  galvan_route: {
    name: 'Galvan Span', type: 'Electric', kind: 'route', music: 'overworld',
    ground: '#46464f', ground2: '#2e2e36', sky: '#54546a', fog: 0.018, dark: 0.42,
    props: 'city', tallGrass: true, encounter: 'galvan',
    links: { west: 'stormrook', east: 'marrowdig' }, gate: 'circuit',
    npcs: [
      np(-2, 14, 'Sign', ["GALVAN SPAN — Marrowdig ahead. Live cables overhead. Do not climb."]),
      np(9, 11, 'Line-Walker', ["The span's feed-cable runs to the spire and up past the clouds. Grey-robes tapped it last week — sparks for days."]),
    ],
    trainers: [
      tr(-12, 3, 'Rocker Jinx', [['ampmite', 17], ['stormchick', 18]], ["Crank it to eleven!"], 980, { shirt:'#f4cf3f' }),
      tr(13, -7, 'Guard Volt', [['gustuff', 18], ['shardling', 19]], ["Span's closed to grey-robes. You? Prove it."], 1020),
    ],
    items: [ it(16, 14, 'superpotion', 2, 'gr1') ],
  },
  /* ───────── 5 · ROCK · Marrowdig ───────── */
  marrowdig: {
    name: 'Marrowdig', type: 'Rock', kind: 'town', music: 'overworld',
    ground: '#8a755a', ground2: '#5e4c3a', sky: '#9a8a72', fog: 0.013, dark: 0.28,
    props: 'canyon', landmark: 'mineshaft',
    gym: 'stone_gym', shop: true, healer: true, links: { west: 'galvan_route', east: 'deepcut_route', special: 'the_rift' },
    npcs: [
      np(7, -4, 'Miner', ["Lads won't go to the bottom shaft anymore. Say something down there... answers back."]),
      np(-8, 6, 'Foreman', ["Petra broke into a dig she didn't make. Grey-robes, pulling a black shard out of the deep."],
        { react: [ { when:'saw_shard', lines:["The grey-robes got their shard and bolted for Vesperveil. But the deep's still muttering. Whatever they woke down there, they left it awake."] } ] }),
      np(9, 7, 'Pit-Lantern Girl', ["Take a pit-lantern, free of charge. The dark at the bottom shaft eats torchlight whole — you'll want the spare."]),
      np(-6, -7, 'Old Digger', ["Sixty years I cut these tunnels. Not once did the deep answer back. Now it won't hush. I dig topside only, these days."]),
    ],
    items: [ it(15, -16, 'hyperpotion', 1, 'md1'), it(31, 27, 'revive', 1, 'md2') ],
    lore: [ lo(-31, 27, 'lore_marrow', 'Pithead Stone',
      ["Bolted over the mouth of the deepest shaft, the warning is older than the town itself.",
       "'Dig for ore, dig for iron, dig for the bones of the hills. But when the rock turns to black glass — STOP. You have struck the floor of the world.'",
       "'What lies beneath that floor is not more rock. It is the First Dark, and it has listened to every pick-strike since the first one fell.'"]) ],
  },
  deepcut_route: {
    name: 'Deepcut', type: 'Rock', kind: 'route', music: 'overworld',
    ground: '#82705a', ground2: '#56462f', sky: '#8e7e68', fog: 0.014, dark: 0.32,
    props: 'canyon', tallGrass: true, encounter: 'deepcut',
    links: { west: 'marrowdig', east: 'vesperveil' }, gate: 'fault',
    npcs: [
      np(-2, 14, 'Sign', ["DEEPCUT — Vesperveil ahead. The canyon narrows. The cold rises from below."]),
      np(9, 11, 'Lost Miner', ["Went down the wrong seam and heard it — my own voice, coming back wrong. Haven't gone near a shaft since."]),
    ],
    trainers: [
      tr(-12, 4, 'Breaker Hod', [['pebblit', 22], ['embrock', 23]], ["I break walls. And teams."], 1200),
      tr(13, -7, 'Digger Sten', [['berkest', 23], ['coalette', 24]], ["The deeper we cut, the colder it gets. Wrong, that."], 1240),
    ],
    items: [ it(16, 16, 'revive', 1, 'dr1'), it(-16, -12, 'prism_orb', 1, 'dr2') ],
    lore: [ lo(31, 27, 'lore_shard', 'Cold Seam',
      ["A vein of black glass threads the rock here, colder than the stone around it. Words are scratched beside it by a miner's hand.",
       "'It is a sliver of the First Dark, left in the deep when the light drove it under. Speak to it and it answers — in YOUR voice, with YOUR wants, made larger.'",
       "'That is how it takes you. Not with fear. With permission.'"]) ],
  },
  /* ───────── 6 · GHOST · Vesperveil ───────── */
  vesperveil: {
    name: 'Vesperveil', type: 'Ghost', kind: 'town', music: 'overworld',
    ground: '#46415a', ground2: '#332f44', sky: '#3a3550', fog: 0.024, dark: 0.62,
    props: 'haunted', landmark: 'witchhut',
    gym: 'phantom_gym', shop: true, healer: true,
    links: { west: 'deepcut_route', east: 'hollow_route', special: 'umbral_observatory' },
    npcs: [
      np(7, -4, 'Veiled Woman', ["The eclipse-shadow pools here already. Out past dusk, the dead don't stay still."]),
      np(-8, 6, 'Gravedigger', ["Nyx hears a voice under the dark. Noxmyth, she calls it. I'd not listen if I were her."],
        { react: [ { when:'found_hq', lines:["So the voice has a house — that cliff-top ruin. Nyx was right. She's always right, and it never helps her."] } ] }),
      np(9, 8, 'Candle-Seller', ["Two for a coin. Not for the dark — for the things that move in it."]),
      // Sable, in eclipse-grey now — the turncoat phase, after the Void Shard.
      np(2, 9, 'Sable', ["...Don't look at me like that.","The shard showed me what I could be. The Order doesn't lie about strength — only about what it costs.","I'm not your rival anymore. I'm not sure what I am. Just... don't be there when it ends. I'd rather not."],
        { opt: SABLE_GREY, when:'saw_shard', until:'siege_done' }),
    ],
    items: [ it(15, -16, 'dusk_orb', 2, 'vv1'), it(-31, -27, 'fullheal', 1, 'vv2') ],
    lore: [ lo(31, -27, 'lore_noxmyth', 'Grave-Lintel',
      ["The stone above the oldest crypt door is carved with two suns, one black, locked like clasped hands.",
       "'Lumyth is not alone. It has a twin born of the First Dark — NOXMYTH, the Under-Sun — and the two are a single coin.'",
       "'One may wake only as the other sleeps. To raise the Under-Sun, you need only put the day-sun out. The Order does not build a weapon. It flips a coin.'"]) ],
  },
  hollow_route: {
    name: 'Hollow Road', type: 'Ghost', kind: 'route', music: 'overworld',
    ground: '#403b54', ground2: '#2a2740', sky: '#332f4a', fog: 0.03, dark: 0.7,
    props: 'haunted', tallGrass: true, encounter: 'hollow',
    links: { west: 'vesperveil', east: 'forgewall' }, gate: 'wraith',
    npcs: [
      np(-2, 14, 'Sign', ["HOLLOW ROAD — Forgewall ahead. Travel by daylight. Do not answer voices."]),
      np(9, 11, 'Candle-Pilgrim', ["The shadow thickens with every mile toward the bastion. The Order's engine is there — you can hear it humming from here."]),
    ],
    trainers: [
      tr(-12, 4, 'Medium Sael', [['nettlewisp', 27], ['murkrat', 28]], ["The spirits whisper your name. They are not kind."], 1500, { shirt:'#5b4b66', hair:'#2b2336' }),
      tr(13, -7, 'Acolyte', [['umbrit', 28], ['darkone', 29]], ["The Order welcomes the dark. You should too."], 1500, { robe:'#2e2b3a', hat:'cap', accent:'#888' }),
    ],
    items: [ it(16, 14, 'fullheal', 2, 'hr1') ],
  },
  /* ───────── 7 · STEEL · Forgewall ───────── */
  forgewall: {
    name: 'Forgewall', type: 'Steel', kind: 'town', music: 'overworld',
    ground: '#62666e', ground2: '#45484f', sky: '#6a6e78', fog: 0.015, dark: 0.4,
    props: 'fortress', landmark: 'gate',
    gym: 'iron_gym', shop: true, healer: true, links: { west: 'hollow_route', east: 'siege_route' },
    npcs: [
      np(7, -4, 'Refugee', ["The grey-robes brought a machine into the bastion. An engine. It hums all night."],
        { react: [ { when:'siege_done', lines:["You held the gate. We saw the grey ranks break and run for Skyrend with their machine.","And the one who turned on them at the end — fought like the dark itself owed them money."] } ] }),
      np(-8, 6, 'Soldier', ["Marshal Rell will hold the gate. Stand with him and we might just keep it."]),
      np(9, 8, 'Armorer', ["Every plate I forge, I quench in cold water and a colder prayer. Take a potion. You'll need both."]),
      // Sable — robe cast off, fighting beside you now. The redemption lands.
      np(-3, 9, 'Sable', ["I burned the robe at the gate. Watched it go.","You never stopped treating me like a rival instead of a lost cause. I don't know why. I'm glad you did.","Go to Skyrend. End this. I'll hold the rear — and this time it's your back I'm guarding, not your blind spot."],
        { opt: SABLE_FREE, when:'siege_done' }),
    ],
    items: [ it(15, -16, 'hyperpotion', 2, 'fw1'), it(31, 27, 'revive', 2, 'fw2') ],
    lore: [ lo(-31, 27, 'lore_order', 'Bastion Archive-Stone',
      ["Sealed behind the armory, a Warden's confession is chiseled in close, furious lines.",
       "'Erebos was the finest of us. He read every tablet, walked every Vein — and concluded the light is not a gift but a CAGE, and the First Dark not a monster but the thing the cage was built to hold down.'",
       "'He named his followers the Eclipse Order and went to open the cage. We struck his name from the rolls. We did not strike his argument. That is the part that frightens me.'"]) ],
  },
  siege_route: {
    name: 'Siege Road', type: 'Steel', kind: 'route', music: 'overworld',
    ground: '#5a5e66', ground2: '#3e4148', sky: '#62666f', fog: 0.016, dark: 0.42,
    props: 'fortress', tallGrass: true, encounter: 'siege',
    links: { west: 'forgewall', east: 'skyrend' }, gate: 'anvil',
    npcs: [
      np(-2, 14, 'Sign', ["SIEGE ROAD — Skyrend ahead. Marshal's orders: no grey robes past the wall."]),
      np(9, 11, 'Wall-Runner', ["Word from the front — the Engine's nearly lit. If the gate falls, nothing stands between it and the peak."]),
    ],
    trainers: [
      tr(-12, 4, 'Sentinel Cor', [['grubolt', 32], ['coldplate', 33]], ["None pass the wall unproven."], 2000, { shirt:'#9aa6b0' }),
      tr(13, -7, 'Eclipsar Adept', [['scraphog', 33], ['alloylark', 34]], ["The Engine is nearly lit. You are too late."], 2000, { robe:'#2e2b3a', hat:'cap', accent:'#888' }),
    ],
    items: [ it(16, 16, 'revive', 1, 'sr1') ],
  },
  /* ───────── 8 · DRAGON · Skyrend ───────── */
  skyrend: {
    name: 'Skyrend Peak', type: 'Dragon', kind: 'town', music: 'overworld',
    ground: '#7a7088', ground2: '#564f64', sky: '#8a80a0', fog: 0.01, dark: 0.3,
    props: 'peak', landmark: 'shrine',
    gym: 'draco_gym', shop: true, healer: true, links: { west: 'siege_route', east: 'ascent_route' },
    npcs: [
      np(7, -4, 'Sky Monk', ["From this height the sun looks... wrong. The wrong color. The wrong size."],
        { react: [ { when:'siege_done', lines:["The Engine passed over us at dusk, carried on grey wings, trailing cold. It made for the Shrine above.","Climb, trainer. The Hierophant means to put out the sun from the one place high enough to do it."] } ] }),
      np(-8, 6, 'Pilgrim', ["Sylvane guards the Ascent. Beyond it, the Eclipse Shrine — where the grey-robes mean to end the day."]),
      np(9, 8, 'Wind-Reader', ["The thermals turned to ice yesterday. The mountain knows something's coming. So do I."]),
    ],
    items: [ it(15, -16, 'hyperpotion', 2, 'sk1'), it(-31, -27, 'fullheal', 2, 'sk2') ],
    lore: [ lo(31, -27, 'lore_solenne', 'Summit Cairn',
      ["Pilgrims have stacked stones here for centuries. The base stone is the oldest, and it is the only one with words.",
       "'Solenne sits beneath Lumyth's very apex, and the Wardens keep it lit through every night because it is the ANCHOR — the pin that holds the whole rite of light to the world.'",
       "'Let the Sun-City go dark even one night, and the pin slips. Then it is not one Vein that fails, but all of them, at once, forever.'"]) ],
  },
  ascent_route: {
    name: 'The Ascent', type: 'Dragon', kind: 'route', music: 'overworld',
    ground: '#726888', ground2: '#4e475e', sky: '#80769a', fog: 0.012, dark: 0.34,
    props: 'peak', tallGrass: true, encounter: 'ascent',
    links: { west: 'skyrend', east: 'eclipse_shrine' }, gate: 'ascend',
    npcs: [
      np(-2, 14, 'Sign', ["THE ASCENT — the Eclipse Shrine lies above. Turn back if your light is not your own."]),
      np(9, 11, 'Last Pilgrim', ["The air's gone to ice and the sun's the wrong size. Whatever the Order means to do up there, it's nearly done. Climb fast."]),
    ],
    trainers: [
      tr(-12, 4, 'Dragon-Tamer Vir', [['scalewisp', 38], ['budwing', 39]], ["Few climb this high. Fewer descend."], 2600, { shirt:'#6a52d0' }),
      tr(13, -8, 'Eclipsar Knight', [['tidalfang', 39], ['glacifang', 40]], ["Turn back. What waits above is not for you."], 2600, { robe:'#241830', hat:'cap', accent:'#7be0d0' }),
    ],
    items: [ it(16, 16, 'fullheal', 3, 'ac1'), it(-31, 28, 'revive', 2, 'ac2') ],
    lore: [ lo(31, 28, 'lore_warden', 'Last Warden\'s Stone',
      ["Near the summit, freshly cut — the newest stone of them all, and the most afraid.",
       "'If you are reading this, the eclipse has come early. Mark that word: EARLY. The circling does not err. It was MOVED.'",
       "'Someone reached up and dragged the dark forward by decades. The light cannot defend itself — it never had to. That was always our task. Finish what I could not.'"]) ],
  },
  /* ───────── capital + story zones ───────── */
  solenne: {
    name: 'Solenne, the Sun-City', type: 'Cosmic', kind: 'capital', music: 'overworld',
    ground: '#cdbf86', ground2: '#b09a5a', sky: '#cfe6ff', fog: 0.004, dark: 0,
    props: 'capital', landmark: 'cathedral', shop: true, healer: true,
    links: { west: 'eclipse_shrine', special: 'celestial_spire' },
    npcs: [
      np(6, 4, 'Citizen', ["Solenne has never known a single night. We mean to keep it that way."],
        { react: [ { when:'champion', lines:["You're the Warden now. The one who held the sky. We'll light a lamp in your name every dusk — just in case."] } ] }),
      np(-6, 4, 'Vanguard Page', ["Past the Spire stand the three Wardens. Beat them, and the Champion awaits."]),
      np(8, 8, 'Bell-Ringer', ["I rang the dawn-bell the morning the eclipse broke. Loudest I ever rang it. My arms still ache. Worth it."]),
      // Sable, at the capital for your league run — all the way from rival to friend.
      np(-3, 9, 'Sable', ["Made it. Both of us, somehow.","I'll be in the stands for the Champion fight. Whole way up I kept thinking — the rival's supposed to win, in the stories.","Go prove the stories wrong. I'll cheer anyway."],
        { opt: SABLE_FREE, when:'climax' }),
    ],
    lore: [ lo(-11, 9, 'lore_charge', 'The Warden\'s Charge',
      ["Set in the cathedral floor where every new Warden must stand, worn smooth by a hundred years of boots.",
       "'The light is not strong. That is the secret we keep. It is vast and it is generous and it cannot lift a finger to save itself.'",
       "'So we stand for it. Not because we are chosen — because someone must, and we were the ones who looked up. If you stand here now: you are the one who looked up. Hold the line.'"]) ],
  },
  eclipse_shrine: {
    name: 'The Eclipse Shrine', type: 'Cosmic', kind: 'special', music: 'battle',
    ground: '#3a2f4a', ground2: '#241d30', sky: '#241830', fog: 0.02, dark: 0.9,
    props: 'shrine', landmark: 'engine', links: { west: 'ascent_route', special: 'solenne' },
    npcs: [
      // before the climax the Order still holds the approach.
      np(0, -6, 'Eclipse Acolyte', ["Turn back. The Hierophant is at the altar and the sky is nearly out. You are a century too late to matter."],
        { until:'climax' }),
      // after: the Engine is a dead hulk and the light has returned.
      np(5, 3, 'Warden Surveyor', ["So this is the Eclipse Engine. Cold now. We'll leave it where it fell — a monument to how close it came.","Every Warden after you will climb here and look at it. Good. Let them."],
        { when:'climax' }),
      np(-6, 5, 'Dawn-Pilgrim', ["I walked nine days to stand where the sun came back. Strangers knelt right here, holding hands they'd never held before.","I only wanted to see the place. Thank you for the place."],
        { when:'climax' }),
      // Sable, quiet at the site of the turn.
      np(-3, -3, 'Sable', ["This is where I'd have ended up, if you hadn't beaten me to the first badge. Grey robe, dead sky, all of it.","...I don't say thank you well. So I'll just stand here a while. Take that as the thank you."],
        { opt: SABLE_FREE, when:'climax' }),
      // once you're Champion, the dragon returns to roost on the altar-stone.
      np(8, -7, 'Skywatch', ["Feel that weight in the air? Zenryu's come back to the altar now the light holds steady.","The Champion's own dragon. It only roosts where the sky is whole. Go up slow."],
        { when:'champion' }),
    ],
    items: [ it(-12, -10, 'hyperpotion', 2, 'es1'), it(11, 9, 'revive', 1, 'es2') ],
    lore: [
      lo(12, -12, 'lore_engine', 'The Eclipse Engine',
        ["A brass-and-shadow ruin the size of a chapel, fused to the altar it was built to smother.",
         "'It does not make the dark,' a scratched plate reads. 'It only takes the light away faster than Lumyth can give it. Subtraction, dressed as a sun.'",
         "'Anything that calls itself an engine of endings is just a very loud way of doing nothing. Remember that the next time one frightens you.'"]),
      lo(-11, 11, 'lore_altar', 'The Altar-Stone',
        ["The shrine predates the Order by a thousand years; the grey-robes only chose it for its clear view of the sky.",
         "'Here the first Wardens watched Lumyth pass and learned to count the century. Here they swore the Charge.'",
         "'The Order thought a holy place would make their unmaking holy. A place is only as good as the last soul to stand in it. You stood in it.'"]),
    ],
  },
  umbral_observatory: {
    name: 'Umbral Observatory', type: 'Dark', kind: 'special', music: 'battle',
    ground: '#2e2b3a', ground2: '#1e1c28', sky: '#15131f', fog: 0.03, dark: 0.85,
    props: 'observatory', landmark: 'dome', links: { west: 'vesperveil' },
    npcs: [
      // the nest, before you clear it.
      np(0, 4, 'Eclipse Acolyte', ["You should not have found this place. The Hierophant will not be pleased."],
        { until:'hq_done' }),
      // after the raid the dome is emptied and the great lens left aimed at nothing.
      np(-5, 5, 'Vesperveil Constable', ["We took the dome the morning you broke their raid. Mostly empty by then — they'd flown the Engine to Forgewall already.","Left the big lens, though. Aimed straight at the eclipse-shadow. They weren't watching the stars. They were listening to what's under them."],
        { when:'hq_done' }),
      np(6, 6, 'Repentant Acolyte', ["I wore the grey. I believed the speech about a 'false sun.' Then I stood in the dark we'd made and it was just... dark. Cold. Nothing reborn in it.","They left me the keys when they fled. I keep the dome open now. Penance, maybe. Or just somewhere to be."],
        { when:'hq_done' }),
      np(4, -5, 'Stargazer', ["With the Order gone you can finally use the telescope for telescope-things. Galaxion drifts past the lens some nights — a beast made of the dark between stars.","It came down to the dome when the Engine went quiet. Curious, maybe. Or grateful. Hard to read a thing with no face."],
        { when:'hq_done' }),
    ],
    items: [ it(-11, -9, 'dusk_orb', 2, 'uo1') ],
    lore: [
      lo(10, 10, 'lore_listen', 'The Listening Lens',
        ["Bolted beneath the great telescope, in a hand that grew less steady line by line.",
         "'It does not see. We ground the mirror flat so it would never see. It hears. Aim it at the shadow Lumyth casts and you can hear Noxmyth turn in its sleep.'",
         "'Night 414: it said a name back to me. Mine. I have not slept since. If you are reading this — do not aim the lens. Some sounds you cannot stop hearing once you start.'"]),
    ],
  },
  celestial_spire: {
    name: 'The Celestial Spire', type: 'Cosmic', kind: 'special', music: 'overworld',
    ground: '#e8e0c0', ground2: '#cfc28a', sky: '#dff0ff', fog: 0.003, dark: 0,
    props: 'spire', landmark: 'spire', links: { west: 'solenne' },
    npcs: [
      np(-5, 4, 'Spire-Keeper', ["Up here the light is close enough to touch — which is exactly why no Warden ever has.","Lumyth is not a prize at the top of a climb. It is a guest we keep the lamp lit for. Mind the difference."],
        { react: [
          { when:'champion', lines:["Warden. The light let you climb this high — it does that for the ones who held the line for it.","Go on up. It has waited a hundred years to look back at someone."] },
        ] }),
      np(6, 6, 'Astronomer', ["I have charted Lumyth's circle since I was a girl. A century, near enough, to the day.","Early this time, and dimmer — but still here. You are why it is still here. I wrote that in the margin of my chart. In ink."]),
      np(3, -4, 'Wynn', ["Couldn't keep an old professor off the Spire, could you. I had to see it once before I'm too grey to climb.","I sent a child up the road with a single partner and a vague warning. I am not proud of how small that gift was. Look what you grew it into."],
        { when:'champion' }),
    ],
    lore: [
      lo(10, -8, 'lore_vigil', 'The Vigil',
        ["Set into the topmost step, where the wind never quite stops.",
         "'We do not worship the light. Worship asks nothing of you but your knees. We keep a vigil — which asks everything, every day, forever.'",
         "'If you climbed this far to kneel, climb back down. If you climbed this far to keep watch: welcome, Warden. The night is long and we are glad of you.'"]),
    ],
  },
  the_rift: {
    name: 'The Rift Below', type: 'Cosmic', kind: 'special', music: 'battle',
    ground: '#241f33', ground2: '#15111f', sky: '#0c0a14', fog: 0.04, dark: 1,
    props: 'rift', landmark: 'rift', links: { west: 'marrowdig' },
    npcs: [
      np(0, 5, 'Rift-Warden', ["I study the rifts so they never open again — and this is the rift. The one under all the others.","Noxmyth was the door, and we shut the door. But Erebos was right about one thing: something on the far side still has a hand on the latch."],
        { when:'champion', react: [
          { when:'leg_voidraxis', lines:["You faced what was down there and came back up. Then my charts have a name now, where there was only a question mark.","Sleep lightly, Warden. So will I."] },
        ] }),
      np(-6, 7, 'Rift-Watcher', ["We post a watch here in shifts. Nothing to do but listen. Some nights you hear breathing that isn't yours.","Don't go down to the edge. ...Or do. You're the one who broke the eclipse. Maybe the dark's afraid of you now."],
        { when:'champion' }),
      // a holdout who never disbanded.
      np(7, -5, 'Grey Holdout', ["The Order is finished. I know. I stayed anyway.","Erebos was a fanatic and a fool — but he was not wrong about the shape of the world. There is a thing beneath it, it is patient, and one day the latch lifts on its own.","...I don't expect you to understand. I expect you to remember I said it."],
        { when:'champion' }),
    ],
    lore: [
      lo(9, 9, 'lore_firstdark', 'The First Dark',
        ["No tablet here — the words are scored straight into the rift-wall, by a hand or by the rock's own breaking.",
         "'Before the light there was this. Not evil. Older than evil. The light is the latecomer; the dark is only home, waiting at the top of the stairs for everyone.'",
         "'You shut the door, Warden. That was the whole of your task and you did it well. The door staying shut is not your task — that one belongs to whoever stands here after you. Stand well.'"]),
    ],
  },
};
export const AREA_ORDER = ['mirevale','mire_route','cinderhold','ash_route','saltmourn','tide_route','stormrook','galvan_route','marrowdig','deepcut_route','vesperveil','hollow_route','forgewall','siege_route','skyrend','ascent_route','eclipse_shrine','solenne'];
export const getArea = id => AREAS[id];

/* ---- wild encounter tables (base forms): [speciesId, weight, loLvl, hiLvl] ---- */
export const ENCOUNTERS = {
  mire:    [['mossling',6,2,5],['glimp',6,2,4],['seedrift',5,3,5],['smellduck',5,2,5],['dreambud',3,3,5],['mufflo',4,2,4]],
  ash:     [['flampling',6,6,10],['wickling',5,6,9],['embrock',5,7,10],['pebfist',4,6,9],['coalette',4,8,10]],
  tide:    [['mudbub',6,10,13],['slushpup',5,11,14],['brookrawl',5,10,13],['mossling',4,10,12],['glowtent',3,12,15],['tidespine',3,12,15]],
  galvan:  [['ampmite',6,15,18],['stormchick',5,15,18],['gustuff',5,15,18],['shardling',4,17,20],['glimfin',3,16,20]],
  deepcut: [['pebblit',6,20,23],['embrock',5,20,23],['berkest',4,21,24],['pebfist',5,20,23],['coalette',3,22,25]],
  hollow:  [['nettlewisp',5,25,28],['murkrat',5,25,28],['zaptus',4,25,28],['hexroach',4,26,29],['nerohat',3,27,30],['umbrit',3,27,30],['darkone',2,28,30]],
  siege:   [['grubolt',6,30,33],['coldplate',5,30,33],['shardling',4,30,33],['scraphog',4,32,35],['alloylark',3,32,35]],
  ascent:  [['scalewisp',6,35,38],['budwing',5,35,38],['tidalfang',4,36,39],['glacifang',4,36,39],['serpyre',2,39,42]],
};

/* ---- league cast (original identities; Ewamon-tuned teams) ---- */
const T = (species, level) => ({ species, level });
export const GYMS = {
  verdant_gym: { leader: 'Mira Thornwell', title: 'Grove-Keeper of Mirevale', type: 'Grass', badge: 'bloom', area: 'mirevale', reward: 800,
    look: { skin:'#e8c39e', shirt:'#5a8f4a', pants:'#3f6a34', hair:'#6fae5a', hairStyle:'long', accent:'#caa24a', eyeColor:'#3a6a2a', scale:1.16, headScale:0.86 },
    pre: ["Mira Thornwell, Grove-Keeper. You feel the dimming too, don't you?", "Then show me roots strong enough to outlast the dark. For the Bloom Badge!"],
    post: ["Strong roots. Take the Bloom Badge — and watch the Veins as you go.", "The grey-robes were here, asking after the Grove-Vein. I sent them packing. You may not be so lucky."],
    team: [T('bramblecub',11), T('smellduck',12), T('briarbear',14)] },
  blaze_gym:   { leader: 'Karn Emberlitt', title: 'Ash-Forge Master', type: 'Fire', badge: 'ember', area: 'cinderhold', reward: 1100,
    look: { skin:'#caa07a', shirt:'#b8482f', pants:'#4a2a22', hair:'#3a2a1c', hairStyle:'short', accent:'#e8643c', eyeColor:'#7a2a1a', scale:1.22, headScale:0.84, bulk:1.28 },
    pre: ["So the grove-trainer comes to the forge. Good — I need someone who won't melt.","The Ember Vein is mine to keep. Beat me and the Ember Badge is yours."],
    post: ["Hah! Hot enough for you? The Ember Badge is earned.","Corona's lot keep coming for the Vein. Hit them harder than you hit me."],
    team: [T('cindercap',15), T('moflame',16), T('pyrecap',18)] },
  tidal_gym:   { leader: 'Captain Maren', title: 'Drowned-Harbor Master', type: 'Water', badge: 'current', area: 'saltmourn', reward: 1500,
    look: { skin:'#d9a874', shirt:'#3f6a8a', pants:'#2a3a4a', hair:'#3a2a1c', hairStyle:'ponytail', hat:'cap', accent:'#cfe0f0', eyeColor:'#2a5a7a', scale:1.15, headScale:0.86 },
    pre: ["Read the wave, then own it. Can you?","The Current Badge goes to those who don't drown."],
    post: ["You ride the tide well. The Current Badge is yours.","The Order poisons the water to break us. Don't let them break you."],
    team: [T('glimfin',19), T('tidespine',20), T('voltide',22)] },
  volt_gym:    { leader: 'Zia Volt', title: 'Storm-Grid Keeper', type: 'Electric', badge: 'circuit', area: 'stormrook', reward: 1900,
    look: { skin:'#e8c39e', shirt:'#f4cf3f', pants:'#3a3a48', hair:'#f4d23f', hairStyle:'wild', accent:'#5fd0e0', eyeColor:'#c8a020', scale:1.1, headScale:0.88 },
    pre: ["Fast hands, faster voltage. Keep up if you can.","Circuit Badge's on the line. Don't blink."],
    post: ["Overclocked and outclassed — me, this time. Circuit Badge, yours.","They hijacked my grid to charge something huge. Find it. Stop it."],
    team: [T('ampmite',24), T('raidori',25), T('luxtrik',26), T('flowbot',27)] },
  stone_gym:   { leader: 'Petra Stonewright', title: 'Mine-Boss of Marrowdig', type: 'Rock', badge: 'fault', area: 'marrowdig', reward: 2300,
    look: { skin:'#caa07a', shirt:'#8a6f52', pants:'#5e4c3a', hair:'#5a4632', hairStyle:'short', accent:'#b09a6f', eyeColor:'#5a3a22', scale:1.18, headScale:0.85, bulk:1.22 },
    pre: ["Break yourself on the wall, or climb it. Your choice.","Earn the Fault Badge the hard way."],
    post: ["Solid. The Fault Badge is yours.","My deepest dig hit a black shard — and grey-robes hauling it out. They went down, not up. Be careful."],
    team: [T('pebblit',28), T('lithokrysm',29), T('thornback',31), T('prismolith',32)] },
  phantom_gym: { leader: 'Nyx Hollow', title: 'Medium of Vesperveil', type: 'Ghost', badge: 'wraith', area: 'vesperveil', reward: 2700,
    look: { skin:'#dceae0', shirt:'#4a4460', pants:'#2f2733', hair:'#6a5b9a', hairStyle:'long', accent:'#9a7ad0', eyeColor:'#6a5b9a', scale:1.12, headScale:0.88 },
    pre: ["A clean mind still loses to a haunted field. Mind the whispers.","...Sorry. It's loud tonight. The Wraith Badge — come and take it."],
    post: ["You held your nerve. The Wraith Badge is yours.","The voice comes from the cliff east of here. The Umbral Observatory. Their nest. Go — before I start to agree with it."],
    team: [T('nerohat',32), T('miscarmen',33), T('nettlewisp',34), T('fedoraith',35), T('mismagmen',37)] },
  iron_gym:    { leader: 'Marshal Rell', title: 'Warden of Forgewall', type: 'Steel', badge: 'anvil', area: 'forgewall', reward: 3200,
    look: { skin:'#caa07a', shirt:'#7a8694', pants:'#4a4e54', hair:'#3a3a42', hairStyle:'short', cape:'#5a5e66', accent:'#9aa6b0', eyeColor:'#3a4a5a', scale:1.24, headScale:0.83, bulk:1.3 },
    pre: ["Soft teams don't leave this room. Show me plating.","The Anvil Badge is forged, not given."],
    post: ["Tempered. The Anvil Badge is yours.","They want my bastion for a cradle. When they come — and they will — stand the gate with me."],
    team: [T('scraphog',36), T('alloylark',37), T('rivetalon',39), T('trenchtusk',40), T('acier',42)] },
  draco_gym:   { leader: 'Sylvane', title: 'Keeper of the Sky-Shrine', type: 'Dragon', badge: 'ascend', area: 'skyrend', reward: 4000,
    look: { skin:'#e8c39e', shirt:'#6a52d0', pants:'#3a2f5a', hair:'#cfd8e0', hairStyle:'long', cape:'#6a52d0', accent:'#b9a6e0', eyeColor:'#6a52d0', scale:1.18, headScale:0.85 },
    pre: ["Every final test should feel unfair. This one will.","The Ascend Badge opens the way above. Earn it."],
    post: ["The sky bows to you. Take the Ascend Badge — and the Ascent.","Above is the Eclipse Shrine. The Hierophant is already there. Climb. Quickly."],
    team: [T('serpyre',39), T('budwing',40), T('bloomdrake',42), T('glacinid',44), T('pyrothal',46)] },
};

export const ELITE = [
  { id: 'veil',    name: 'Warden Veil',    theme: 'Ghost', reward: 6000,
    look: { skin:'#dceae0', shirt:'#3a3450', pants:'#241830', hair:'#6a5b9a', hairStyle:'long', cape:'#241830', accent:'#9a7ad0', eyeColor:'#9a7ad0', scale:1.2, headScale:0.84 },
    pre: ["A haunted field, a clean kill. I am Veil. Show me you survived the eclipse for a reason."],
    team: [T('mismagmen',48), T('fedoraith',49), T('voidraith',50), T('toxshade',51), T('bankaiser',54)] },
  { id: 'aurelia', name: 'Warden Aurelia', theme: 'Fairy', reward: 7000,
    look: { skin:'#f2cdb0', shirt:'#f0a6d0', pants:'#c86a9a', hair:'#ffe066', hairStyle:'long', cape:'#f0a6d0', accent:'#fff0c0', eyeColor:'#e06fa0', scale:1.18, headScale:0.85 },
    pre: ["I keep Lumyth's light. You helped save it. Now prove you can wield it."],
    team: [T('glimmereen',48), T('cirrileap',49), T('starwhim',50), T('gemknight',51), T('voltaura',54)] },
  { id: 'kirei',   name: 'Warden Kirei',   theme: 'Psychic', reward: 8000,
    look: { skin:'#e8c39e', shirt:'#e06fa0', pants:'#5b4b76', hair:'#6a5b9a', hairStyle:'bun', cape:'#5b4b76', accent:'#e06fa0', glasses:true, eyeColor:'#6a5b9a', scale:1.18, headScale:0.85 },
    pre: ["I study the rifts so they never open again. Let's see your mind."],
    team: [T('nebucloak',48), T('auroracle',49), T('archonosis',51), T('mismagmen',52), T('galaxion',55)] },
];
export const CHAMPION = { id: 'zeon', name: 'Champion Zeon', theme: 'Dragon', reward: 20000,
  look: { skin:'#caa07a', shirt:'#6a52d0', pants:'#2a2440', hair:'#2b2336', hairStyle:'wild', cape:'#f0d878', accent:'#f0d878', eyeColor:'#6a52d0', scale:1.3, headScale:0.82, bulk:1.15 },
  pre: ["So you came through. I am Zeon, the Last Warden of Ewa.", "You broke the Long Eclipse. Now break me — and the title is yours. Go all out."],
  post: ["...The light is yours to keep now, Warden. Walk it well."],
  team: [T('florasage',55), T('blizzraak',55), T('abyssrake',56), T('rexaloft',57), T('pyrothal',58), T('zenryu',60)] };

/* ---- the Eclipse Order ---- */
export const ECLIPSE = {
  corona: { name: 'Eclipsar Corona', title: 'The Fanatic', reward: 3000,
    team: [T('moflame',26), T('infernomorel',28), T('miscarmen',28), T('moblaze',30)] },
  rift: { name: 'Eclipsar Rift', title: 'The Theorist', reward: 4500,
    team: [T('serpyre',36), T('voidraith',37), T('bloomdrake',38), T('abyssrake',40)] },
  umbra: { name: 'Eclipsar Umbra', title: 'The Zealot', reward: 4000,
    team: [T('nerohat',34), T('toxshade',35), T('mismagmen',36), T('voidraith',38)] },
  erebos: { name: 'Hierophant Erebos', title: 'of the Eclipse Order', reward: 12000,
    team: [T('infernomorel',48), T('voidraith',49), T('toxshade',50), T('mismagmen',51), T('aonred',53)] },
};

/* ---- legendaries: one-time scripted statics ---- */
export const LEGENDARIES = {
  raikitsune: { species: 'raikitsune', level: 30, area: 'galvan_route', flag: 'leg_raikitsune', when: 'badge:circuit' },
  bankaiser:  { species: 'bankaiser',  level: 42, area: 'forgewall', flag: 'leg_bankaiser', when: 'badge:anvil' },
  galaxion:   { species: 'galaxion',   level: 38, area: 'umbral_observatory', flag: 'leg_galaxion', when: 'flag:hq_done' },
  sunjaw:     { species: 'sunjaw',     level: 55, area: 'ash_route', flag: 'leg_sunjaw', when: 'flag:champion' },
  glacinid:   { species: 'glacinid',   level: 55, area: 'ascent_route', flag: 'leg_glacinid', when: 'flag:champion' },
  voltaura:   { species: 'voltaura',   level: 55, area: 'galvan_route', flag: 'leg_voltaura', when: 'flag:champion' },
  zenryu:     { species: 'zenryu',     level: 60, area: 'eclipse_shrine', flag: 'leg_zenryu', when: 'flag:champion' },
  // NB: roaming form uses its OWN flag (roam_noxmyth), NOT leg_noxmyth. The climax
  // boss sets leg_noxmyth on every non-loss outcome (before `champion` is reachable),
  // so gating the roaming spawn on leg_noxmyth would suppress it forever.
  noxmyth:    { species: 'noxmyth',    level: 62, area: 'eclipse_shrine', flag: 'roam_noxmyth', when: 'flag:champion' },
  lumyth:     { species: 'lumyth',     level: 60, area: 'celestial_spire', flag: 'leg_lumyth', when: 'flag:champion' },
  voidraxis:  { species: 'voidraxis',  level: 65, area: 'the_rift', flag: 'leg_voidraxis', when: 'flag:champion' },
};

export const SHOP_STOCK = ['potion','superpotion','hyperpotion','fullheal','revive','spark_orb','crest_orb','prism_orb','dusk_orb'];

/* ---- main story script (flag-driven; fires per area) ---- */
export const STORY = [
  { id: 'intro', area: 'mirevale', need: [], set: ['met_wynn'], speaker: 'Prof. Wynn',
    lines: [
      "Welcome to Mirevale. Under this canopy you can already see it — the light is *thinning*.",
      "Lumyth, the Day-Mote, has circled our sky for a century. It is early this time. And it is dimming.",
      "Take a partner. Walk the eight badges. And watch the Veins for me — something is drinking the light." ],
    starter: true },
  { id: 'ember_harvest', area: 'cinderhold', need: ['badge:bloom'], set: ['saw_order'], speaker: 'Eclipsar Corona',
    lines: [
      "Acolytes — keep the canisters flowing. The Ember Vein burns so brightly here.",
      "Ah. A trainer. You wouldn't understand: the false sun must be *put out* to be reborn.",
      "Stop us if you can. You can't." ],
    battle: { kind: 'order', trainer: 'corona' },
    after: ["The Acolytes scatter, leaving a silver canister stamped with a crescent.","'The Eclipse Order'... and every canister ships to Forgewall."] },
  { id: 'marrow_shard', area: 'marrowdig', need: ['badge:fault'], set: ['saw_shard'], speaker: 'Eclipsar Rift',
    lines: [
      "The miners dug exactly deep enough. This shard — a sliver of the First Dark — is worth a thousand of you.",
      "...You again. And look who I brought.",
      "(Sable steps from the shadow in eclipse-grey.) 'Strength is strength,' Sable says. 'They're not wrong about the dark.'" ],
    battle: { kind: 'order', trainer: 'rift' },
    after: ["Rift escapes up the shaft with the Void Shard. Sable won't meet your eyes."] },
  { id: 'find_hq', area: 'vesperveil', need: ['badge:wraith'], set: ['found_hq'], speaker: 'Nyx Hollow',
    lines: [
      "I hear it every night now. A voice under the eclipse-shadow. Noxmyth. It is *patient*.",
      "The grey-robes came from the cliff east of here — the old Umbral Observatory. That is their nest.",
      "Go. Before I start agreeing with the voice." ] },
  { id: 'hq_raid', area: 'umbral_observatory', need: ['found_hq'], set: ['hq_done'], speaker: 'Eclipsar Corona',
    lines: [
      "So you found the nest. Then you'll hear the whole of it:",
      "The Eclipse Engine is nearly built. We dim Lumyth, we wake Noxmyth, and Noxmyth opens the Rift for what sleeps beneath the world.",
      "Sable — you don't have to be here." ],
    battle: { kind: 'order', trainer: 'corona' },
    after: ["The Engine is gone — flown to Forgewall. But Sable lingers at the door, the crack in the grey finally showing."] },
  { id: 'siege', area: 'forgewall', need: ['hq_done','badge:wraith'], set: ['siege_done'], speaker: 'Marshal Rell',
    lines: [
      "They want my bastion for a cradle. Over my cold plating.",
      "Hold the gate with me, trainer. Whatever comes through — we do not break." ],
    battle: { kind: 'order', trainer: 'rift' },
    after: ["The gate holds — but the Engine was assembled inside and flown to Skyrend. Sable fights beside you now, grey robe cast off."] },
  { id: 'climax', area: 'eclipse_shrine', need: ['badge:ascend','siege_done'], set: ['climax'], speaker: 'Hierophant Erebos',
    lines: [
      "You climbed all this way to watch the dawn die. How fitting.",
      "Behold the Long Eclipse. The false light gutters. Noxmyth wakes. And the Rift... the Rift opens.",
      "You cannot stop a sunrise from ending. But you may try." ],
    battle: { kind: 'order', trainer: 'erebos' },
    after: [
      "As Erebos falls, the Engine screams — and NOXMYTH rises from the black sun!",
      "(Noxmyth subdued, Lumyth descends in a sheet of light and seals the cracked sky. Dawn breaks.)",
      "Erebos, hollow: 'You only shut the door. It is still down there.'",
      "The way to Solenne — and the league — lies open." ],
    boss: 'noxmyth' },
];

export function nextStoryBeat(areaId, flags){
  for (const b of STORY){
    if (b.area !== areaId) continue;
    if (flags['done_' + b.id]) continue;
    const need = b.need || [];
    if (need.every(n => n.startsWith('badge:') ? flags['badge_' + n.slice(6)] : flags[n])) return b;
  }
  return null;
}
