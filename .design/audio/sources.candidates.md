# Ewamon Remastered: CC0 audio source candidates

Date: 2026-10-06
Scope: music (17 themes), ambience (11 beds), sfx (174 ids, 287 variants) from `.design/audio/manifest.json`.

## How to read this

- **Downloaded 2026-10-06** after the user approved this list. See "Download status" below; the record is `assets-src/audio/cc0/DOWNLOADS.json` (gitignored), the mapping `.design/audio/sources.json`.
- **Each row in the summary table is one download.** The user approves each one separately. Rows marked *(alt)* in the per-theme sections are fallbacks and are **not** counted in the totals.
- **Licence evidence** quotes the licence field on each page as the page shows it:
  - OpenGameArt (OGA): the "License(s)" field.
  - Kenney: "License: Creative Commons CC0".
  - Freesound: the licence badge, "Creative Commons 0".
  - **UNVERIFIED** means the licence was not confirmed on the item's own page.
- **Sizes** are as shown on the page. Kenney pages show file counts but **no sizes**, so those are "unknown".
- **OGA search caveat:** the CC0 filter on the OGA advanced search let CC-BY items through (e.g. Alexandr Zhelanov's "Ancient Temple", CC-BY 4.0). Every OGA item below was checked on its own page. Do not trust the search filter alone.
- **Freesound:** you need a free freesound.org account and login to download, even for CC0 sounds.
- **Durations** are mostly not shown on OGA pages. "Loop: yes" means the page or its tags say the file loops. Everything else needs a loop point or crossfade from the pipeline.


## Download status (2026-10-06)

| Rows | Status |
|---|---|
| K1–K7 | **fetched** (0.4–5.6 MB each; page: "License: Creative Commons CC0"); each pack's `License.txt` is in `assets-src/audio/licenses/KENNEY-<pack>-License.txt` |
| R1–R8 | **fetched** (page: "License(s): CC0") |
| M1–M17 | **fetched**. M8 is the V2 wav, M9 is `entering_the_volcano.wav`, M14 is the flac, M16 is the mp3. M17 was taken under the CC0 option |
| A1, A3–A6 | **fetched** |
| S1 (itch.io, lentikula) | **skipped.** The itch download flow returned Cloudflare 522/525 and then redirected back to the item page. **Substituted** with 7 CC0 OpenGameArt items: Magic Spell SFX (JaggedStone), Freeze Spell (artisticdude), Cure Magic (Someoneman), Teleport Spell (Ogrebane), Ghost breath (qubodup), Earth Element Magic Spell (qubodup), RPG Sound Pack (artisticdude). Each page reads "License(s): CC0" |
| A2 (Freesound) | **skipped** (needs a login). **Substituted** with OGA "Beach Ocean Waves" and "Water Waves" (qubodup; "License(s): CC0") |
| A7 (Freesound) | **skipped** (login). The capital bed is premixed from the R4/R5/R8/K3/K4 files already fetched |
| A8 (Freesound) | **skipped** (login; its licence was unverified anyway). The shrine bed is premixed from A5/A6/K3/K6 |
| *(alt)* rows | not downloaded |

The total is 58 files and 227 MB. Coverage is 366 of 366 jobs. Loop windows, premixes, the budget (72.7 MiB) and listening caveats are in `tools/audio-pipeline/IMPLEMENTATION-NOTES.md`, "Phase E4 downloads".

---

## Summary table (recommended set: 41 downloads)

| # | Source (pack/track) | Author | URL | Licence evidence | Size (as stated) | Covers | Notes |
|---|---|---|---|---|---|---|---|
| **Kenney sfx** | | | | | | | |
| K1 | Interface Sounds (100 files) | Kenney | https://kenney.nl/assets/interface-sounds | "Creative Commons CC0" | unknown | ui_* core (click/confirm/back/open/close/tab/toast/error/type/notify/dialogue_advance/save), spotted | Main UI source |
| K2 | UI Audio (50 files) | Kenney | https://kenney.nl/assets/ui-audio | "Creative Commons CC0" | unknown | ui_* variants (clicks, switches) | Extra click/switch variety |
| K3 | Impact Sounds (130 files) | Kenney | https://kenney.nl/assets/impact-sounds | "Creative Commons CC0" | unknown | hit_*, step_{grass,snow,wood,stone,flat}, orb_*, anvil_strike, bell_toll, impact_{normal,rock,steel,ground,fighting} | Footstep file list from memory (carpet/concrete/grass/snow/wood), UNVERIFIED on page |
| K4 | RPG Audio (50 files) | Kenney | https://kenney.nl/assets/rpg-audio | "Creative Commons CC0" | unknown | door_open/close/heavy, step_dirt, ui_shop_* (coins), lore_tablet (book/page) | Page: footsteps, foley, weapons |
| K5 | Music Jingles (85 files) | Kenney | https://kenney.nl/assets/music-jingles | "Creative Commons CC0" | unknown | 19 ui_stinger_*, ui_levelup, ui_badge, ui_quest_done, ui_evolve_done, ui_item_get, ui_heal | Styles from memory (8-bit/hit/pizzicato/sax/steel), UNVERIFIED; use only pizzicato/"hit" for an orchestral feel |
| K6 | Sci-fi Sounds (70 files) | Kenney | https://kenney.nl/assets/sci-fi-sounds | "Creative Commons CC0" | unknown | warp, lens_hum, pylon_crackle, move/impact_{electric,cosmic,psychic}, status_paralyze | |
| K7 | Digital Audio (60 files) | Kenney | https://kenney.nl/assets/digital-audio | "Creative Commons CC0" | unknown | stage_up/down, spawn_shimmer, move/impact_fairy, ui_evolve_start | Laser/space tones; pitch down for less "arcade" |
| **rubberduck sfx (OGA)** | | | | | | | |
| R1 | 80 CC0 creature SFX | rubberduck | https://opengameart.org/content/80-cc0-creature-sfx | "CC0" | 1.9 MB zip | cry_* (19), hurt_*, faint, raid_roar | alien, bug, cute, monster, roar, hurt, troll... |
| R2 | 80 CC0 creature SFX #2 | rubberduck | https://opengameart.org/content/80-cc0-creture-sfx-2 | "CC0" | 1.9 MB zip | cry_*, hurt_*, move_bug, faint | bug (9), monster (13), death (4) |
| R3 | 80 CC0 RPG SFX | rubberduck | https://opengameart.org/node/86018 | "CC0" | 1.8 MB zip | move/impact_{fire,dark,ghost}, status_burn, lore_tablet, ui_item_get (gems/coins), hurt_* | 22 creature, 9 spell, 21 item |
| R4 | 100 CC0 SFX | rubberduck | https://opengameart.org/content/100-cc0-sfx | "CC0" | 2.9 MB zip | bell_toll (bells, gongs), door_*, orb_break (glass), hit_* | 3 bells, 2 gongs, 3 machine loops |
| R5 | 100 CC0 SFX #2 | rubberduck | https://opengameart.org/content/100-cc0-sfx-2 | "CC0" | 2.4 MB zip | thunder, footsteps, wind (air flowing), ambient loops (street/highway → capital bed layer) | |
| R6 | 40 CC0 water / splash / slime SFX | rubberduck | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | "CC0" | 2.3 MB zip | splash, step_water, move/impact_{water,poison}, status_poison, weather_rain (rain loop) | 15 splash, 16 slime, 6 loops |
| R7 | 100 CC0 metal and wood SFX | rubberduck | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | "CC0" | 2 MB zip | anvil_strike (metal hammer), door_heavy, step_metal, impact_steel, impact_grass (wood crack) | |
| R8 | 30 CC0 SFX loops | rubberduck | https://opengameart.org/content/30-cc0-sfx-loops | "CC0" | 3.5 MB zip | **forge bed** (11 machine loops), lens_hum, cinder bed layer (boiling, rolling) | |
| **Other sfx** | | | | | | | |
| S1 | Basic Spell Impacts [Free/CC0] (20 wav) | lentikula | https://lentikula.itch.io/freecc0-basic-spell-impacts-sfx | "CC0 1.0 Public Domain" | 13 MB zip | move/impact_{fire,ice,electric,water}, status_freeze, weather_hail | itch.io page; the page reader said a login may be needed |
| **Music** | | | | | | | |
| M1 | Battle Theme A | cynicmusic | https://opengameart.org/content/battle-theme-a | "CC0" | 3.3 MB mp3 | theme **battle** | strings and horns |
| M2 | Battle Theme B for RPG | cynicmusic | https://opengameart.org/content/battle-theme-b-for-rpg | "CC0" | 1.6 MB mp3 | theme **gym** | timpani, harpsichord bridge |
| M3 | Boss Battle Music ("Epic Boss Battle [Seamlessly Looping]") | SubspaceAudio (Juhani Junkala) | https://opengameart.org/content/boss-battle-music | "CC0" | 21.8 MB wav | theme **champion** | Loop: yes |
| M4 | Dramatic Boss Encounter | cynicmusic | https://opengameart.org/content/dramatic-boss-encounter | "CC0" | 7 MB wav | theme **elite** | drums and violin; author advises adding reverb |
| M5 | Determined Pursuit (epic orchestra loop) | Emma_MA | https://opengameart.org/content/determined-pursuit-epic-orchestra-loop | "CC0" | 19.1 MB wav | theme **raid** | Loop: yes; frantic strings |
| M6 | Victory Theme for RPG | cynicmusic | https://opengameart.org/content/victory-theme-for-rpg | "CC0" | 1.4 MB mp3 | theme **victory**, ui_stinger_victory_* (fallback) | author says the ending is awkward → trim |
| M7 | Town Theme RPG | cynicmusic | https://opengameart.org/content/town-theme-rpg | "CC0" | 1.3 MB mp3 | theme **grove** | harps and recorders, peaceful |
| M8 | New Sunrise (new_sunrise_V2.wav) | nene | https://opengameart.org/content/new-sunrise | "CC0" | 36.2 MB wav | theme **capital** | brass, strings, timpani, choir; 48 kHz/24-bit |
| M9 | Ambience of a Fallen Age: entering_the_volcano.wav | Umplix | https://opengameart.org/content/ambience-of-a-fallen-age | "CC0" | 33.9 MB wav | theme **cinder** | volcanic ambient; no forge percussion (see notes) |
| M10 | Factory Ambiance | yd | https://opengameart.org/content/factory-ambiance | "CC0" | 2.5 MB ogg | theme **forge** | industrial, dark |
| M11 | Crystal Cave (song18) | cynicmusic | https://opengameart.org/content/crystal-cave-song18 | "CC0" | 534.9 KB mp3 | theme **marrow** | ~50–60 s; "easy for perfect loop" |
| M12 | Horror Atmosphere ("Post Apocalyptic Wastelands [Loop Ready]") | SubspaceAudio (Juhani Junkala) | https://opengameart.org/content/horror-atmosphere | "CC0" | 14.2 MB ogg | theme **rift**; also the rift bed (low-passed) | 5:23; Loop: yes; no melody |
| M13 | Seaside Village | KarateStudios | https://opengameart.org/content/seaside-village | "CC0" | 12 MB flac | theme **salt** | peaceful, ocean-themed |
| M14 | Dark Shrine Loop | qubodup (remix of yd) | https://opengameart.org/content/dark-shrine-loop | "CC0" | 3 MB flac (mp3 905.7 KB) | theme **shrine** | Loop: yes; calm, temple/cathedral |
| M15 | Rise Of The Early Dawn | antonioraymond71 | https://opengameart.org/content/rise-of-the-early-dawn | "CC0" | 2 MB mp3 | theme **sky** | Elder Scrolls-inspired mountain-sunrise overworld |
| M16 | Energy Storm | iamoneabe | https://opengameart.org/content/energy-storm | "CC0" | 5.8 MB mp3 (wav 58.4 MB) | theme **storm** | Loop: yes ("Loopable") |
| M17 | Creepy Forest (F) | Augmentality (Brandon Morris) | https://opengameart.org/content/creepy-forest-f | "OGA-BY 3.0" + "CC0" | 10.8 MB ogg | theme **vesper** | dual licence: take it under CC0; electric guitar and wind |
| **Ambience** | | | | | | | |
| A1 | AMB Morning Sounds (Perfect Loop) | Kresiek The Furry | https://opengameart.org/content/amb-morning-sounds-perfect-loop | "CC0" | 3.2 MB ogg | bed **grove** | Loop: yes |
| A2 | Ocean Waves on Beach (#623052) | goochiano | https://freesound.org/people/goochiano/sounds/623052/ | "Creative Commons 0" | 16.9 MB wav | bed **salt** | 2:03; login needed |
| A3 | rain and thunders | kindland | https://opengameart.org/content/rain-and-thunders | "CC0" | 6.8 MB ogg | bed **storm**, weather_rain, thunder | not stated as loopable |
| A4 | Loopable Dungeon Ambience | JaggedStone | https://opengameart.org/content/loopable-dungeon-ambience | "CC0" | 1.6 MB ogg | bed **marrow** (low wind and water drips) | Loop: yes |
| A5 | Crickets Ambient Noise - loopable | Wolfgang_ | https://opengameart.org/content/crickets-ambient-noise-loopable | "CC0" | 184.4 KB mp3 | bed **vesper** (layer with A6 wind) | 11 s loop |
| A6 | wind whoosh loop | SketchMan3 | https://opengameart.org/content/wind-whoosh-loop | "CC0" | 251.6 KB ogg | bed **sky**, wind_gust, weather_sand (layer) | Loop: yes |
| A7 | Torino, Piazza Castello (#276970) | alesonica | https://freesound.org/people/alesonica/sounds/276970/ | "Creative Commons 0" | 5.0 MB mp3 | bed **capital** | 2:10; crowd, children, traffic, bongos; login needed |
| A8 | Orbital Temple Sacred Drone (#854867) | bassimat | https://freesound.org/people/bassimat/sounds/854867/ | UNVERIFIED (CC0 search filter only) | unknown | bed **shrine** (drone; add bells/gong from R4) | confirm the licence badge before downloading |

Beds **forge**, **cinder** and **rift** are built from rows already listed:
- forge: R8 machine loops.
- cinder: low band of M9, plus R8 boiling/rolling loops and A3 rumble.
- rift: M12, low-passed under 1 kHz.

---

## Music: per theme

The pipeline derives 3 layers from one track, so one track per theme is enough. Tempo and key are not matched. Expect the pipeline to adopt each track's own bpm/bars, or stretch it ±6 %.

| Theme | Brief | Candidate | Mood fit | Loop? | Alternative *(alt, not counted)* |
|---|---|---|---|---|---|
| battle | 160 D minor, driving orchestral | M1 Battle Theme A (cynicmusic) | Good: epic strings and horns RPG battle | not stated | Fantasy - Battlegrounds, Doge, https://opengameart.org/content/fantasy-battlegrounds ("CC0", 2.3 MB mp3, orchestral strings/percussion/woodwinds) |
| gym | 160 A minor | M2 Battle Theme B (cynicmusic) | Good: same composer as battle, so the set stays coherent | not stated | Jungle Battle Loop, omfgdude, https://opengameart.org/content/jungle-battle-loop ("CC0", 780 KB ogg; keyboard-made, lower production) |
| champion | 168 B minor, final boss | M3 Epic Boss Battle (Juhani Junkala) | Very good: God of War-style orchestral boss | **yes** | Sinister Boss Appears!, cynicmusic, https://opengameart.org/content/sinister-boss-appears ("CC0", 15.7 MB wav; intro-style) |
| elite | 144 C minor, tension | M4 Dramatic Boss Encounter (cynicmusic) | Good: dramatic drums and violin | not stated | Storm Chasers (see storm alt) |
| raid | 138 F minor, raid boss | M5 Determined Pursuit (Emma_MA) | Very good: frantic, time-pressure feel | **yes** | Sinister Boss Appears! (above) |
| victory | 120 D major, short fanfare loop | M6 Victory Theme for RPG (cynicmusic) | Good; trim the awkward ending | no (trim) | Kenney Music Jingles (K5), pizzicato/"hit" jingles |
| grove | 96 D major, warm pastoral | M7 Town Theme RPG (cynicmusic) | Very good: harps and recorders, peaceful | not stated | Once Upon a Time (loop), TAD, https://opengameart.org/content/once-upon-a-time-loop ("CC0", 1.8 MB mp3 / 10.2 MB wav; happy orchestral + piano; **loop: yes**) |
| capital | 108 E major, grand city | M8 New Sunrise V2 (nene) | Very good: brass, choir, timpani, adventurous | not stated | (a) Medieval: Market Day, loop version, RandomMind, https://opengameart.org/content/medieval-market-day ("CC0", Loop_Market_Day.mp3 2.6 MB; upbeat folk; **loop: yes**). (b) A Legend Will Rise, CodeManu, https://opengameart.org/content/a-legend-will-rise-orchestral ("CC0", 2.8 MB mp3) |
| cinder | 92 A dorian, volcanic, forge percussion | M9 entering_the_volcano (Umplix) | Partial: right setting, but ambient with no percussion | not stated | Free Music Pack, tricksntraps, https://opengameart.org/content/free-music-pack ("CC0", 31.4 MB zip, 7 tracks incl. "Doomed"; per-track mood UNVERIFIED) |
| forge | 112 C# phrygian, industrial | M10 Factory Ambiance (yd) | Good: industrial-complex exploration | not stated | none checked |
| marrow | 96 F# phrygian, mine/caves | M11 Crystal Cave (cynicmusic) | Very good: stone and bell textures, deep bass | **yes** | Cave Theme, Brandon75689, https://opengameart.org/content/cave-theme ("OGA-BY 3.0" + "CC0", 3.2 MB ogg; take it under CC0) |
| rift | 60 F# drone, dark ambient < 1 kHz | M12 Horror Atmosphere (Juhani Junkala) | Good: atmospheres and noise only, no melody; low-pass it | **yes** | (a) the_abyss.wav (Umplix, same page as M9, 39 MB). (b) Dungeon Ambience, yd, https://opengameart.org/content/dungeon-ambience ("CC0", 1.2 MB ogg; commenters call it a great loop) |
| salt | 96 E minor, coast/sea | M13 Seaside Village (KarateStudios) | Good: sunny ocean village | not stated | Merchants and Sea Salt, NBJDLukasAbsolute, https://opengameart.org/content/merchants-and-sea-salt ("CC0", 19.7 MB wav; port-town) |
| shrine | 60 E, temple, bells | M14 Dark Shrine Loop (qubodup/yd) | Good: calm, mysterious temple | **yes** | Galactic Temple, yd, https://opengameart.org/content/galactic-temple ("CC0", 1.1 MB zip with ogg + LMMS source) |
| sky | 92 A lydian, soaring peak | M15 Rise Of The Early Dawn | Very good: "sunrise on a grassy mountain" overworld | not stated | Up in the Sky, Memoraphile, https://opengameart.org/content/up-in-the-sky ("CC-BY 4.0, OGA-BY 3.0, CC0", 3.4 MB ogg; dreamy; **loop: yes**) |
| storm | 128 B minor, electric, energetic | M16 Energy Storm (iamoneabe) | Good: epic, loopable | **yes** | Storm Chasers, Eldritch Grim, https://opengameart.org/content/storm-chasers ("CC0", 15 MB wav; hybrid trailer) |
| vesper | 66 F# minor, haunted dusk | M17 Creepy Forest (F) | Good: eerie, with wind | not stated | Sirens in Darkness, cynicmusic, https://opengameart.org/content/sirens-in-darkness ("CC0", 7 MB mp3; warm pads and piano) |

Reserve, also CC0 and checked:
- At Home - Orchestral, Wolfgang_, https://opengameart.org/content/at-home-orchestral (13.1 MB wav; calm, melancholy). Could be the title or ui_stinger_restored.
- Fantasy Choir (3 pieces), César da Rocha, https://opengameart.org/content/fantasy-choir-3-orchestral-pieces (69.7 MB zip). Could work for shrine or capital.
- Celtic Loop, stereoscopic, https://opengameart.org/content/celtic-loop (1 MB). Could work for salt or grove.

## Ambience: per biome

| Bed | Source | Status |
|---|---|---|
| grove | A1 AMB Morning Sounds (perfect loop) | covered. Alt: Freesound "Forest Day - Bird Chirps, Insects" by RealSquink, https://freesound.org/people/RealSquink/sounds/788118/ (CC0 summary text on the page; 1:45; 29 MB wav) |
| cinder | M9 low band + R8 boiling/rolling loops + A3 rumble | derived, weak. No dedicated CC0 volcanic bed found. "Lava loop" is in the OwlishMedia "Ambient Sounds" collection, licence UNVERIFIED |
| salt | A2 Ocean Waves on Beach (goochiano) | covered. Alt: Sea and river wave sounds, RandomMind, https://opengameart.org/content/sea-and-river-wave-sounds ("CC0", VistulaShort.mp3 12 MB, 5 min; river, not sea) |
| storm | A3 rain and thunders + R5 thunder + A6 wind | covered |
| marrow | A4 Loopable Dungeon Ambience | covered |
| vesper | A5 crickets + A6 wind | covered |
| forge | R8 machine loops (11) | covered |
| sky | A6 wind whoosh loop | covered. Alt: felix.blume "Wind singing in the mountain..." https://freesound.org/people/felix.blume/sounds/165526/ (CC0 via search filter only, UNVERIFIED) |
| capital | A7 Torino, Piazza Castello + R5 street loop + R8 flowing water (fountain) | covered. Includes traffic and bongos, so edit or EQ |
| shrine | A8 drone (UNVERIFIED) + R4 bells/gongs | derived/partial |
| rift | M12 low-passed | derived |

## SFX: by group

Rule used: an id counts as covered if at least one plausible file exists. The pipeline pitch-derives the extra variants.

| Group | Ids (variants) | Sources | Covered | Weak spots |
|---|---|---|---|---|
| UI | 45 (49) | K1, K2, K5 (stingers, level-up, badge, quest), K4/R3 coins (shop), K7 (evolve) | 45 | The 19 ui_stinger_* rely on Kenney jingles. Only some of the jingle styles suit orchestral; pick pizzicato/"hit" |
| Footsteps | 12 (36) | K3 (grass, snow, wood, concrete → stone/flat), K4 (dirt), R5 footsteps, R7 metal, R6 water | 12 | ash, salt, sand, gravel are EQ/pitch derivations of snow/dirt (4 weak). The CC-BY congusbongus pack would fill gravel, but it is excluded |
| Battle | 24 (43) | K3 punches (hit_*), R1/R2 die (faint), K1/A6 whoosh (switch/flee), K3/R4 glass and plate (orb_*), S1/R3/R6/K6 (status_*), K7 (stage_up/down), R6 rain, A6 sand, S1 ice (hail) | 24 | weather_sun and status_sleep need soft shimmer/chime designs from K7/K1 (2 weak) |
| Elements | 76 (133): move/impact/cry/hurt × 19 types | cry_*/hurt_*: R1+R2 (160 creature sounds, incl. cute, bug, alien, monster, roar). move/impact: S1 (fire, ice, electric, water), R3 spells (fire, dark), K6 (electric, cosmic, psychic), K7 (fairy), K3 (normal, rock, steel, ground, fighting), R6 slime (poison), R7 wood crack (grass), A6 whoosh (flying), R1 roar (dragon), weird/alien (ghost, dark) | 76 | move/impact for fairy, psychic, cosmic, dragon are layered designs (about 8 weak). For grass, add a rustle (see world) |
| World | 17 (26) | K4/R4/R7 doors, R6 splash, R5/A3 thunder, A6 wind_gust, K6 warp/lens_hum/pylon_crackle, K7 spawn_shimmer, K1 spotted, R7/K3 anvil_strike, R4/K3 bell_toll, R3 stone/book (lore_tablet), K5 hit jingle (raid_phase), R1 roar (raid_roar) | 17 | grass_rustle has no dedicated rustle file. Use R3/R5 foley or cloth from K4 (1 weak) |

## Excluded / not clearly CC0

| Source | Reason |
|---|---|
| FreePD.com (Kevin MacLeod's public-domain site) | **Closed in 2025.** The page says "The hosting and maintenance of the site have ceased." Third-party mirrors have unverifiable provenance |
| Kenney Game Assets All-in-1 (itch.io) | Content is CC0 but the bundle is **paid** ($19.95 minimum, 456 MB). The individual audio packs above are free |
| Pixabay music/sfx | Pixabay Content License, not CC0 |
| Sonniss GDC Game Audio Bundles | Royalty-free licence, not CC0 |
| Alexandr Zhelanov (e.g. "Ancient Temple") | **CC-BY 4.0**, verified on https://opengameart.org/content/ancient-temple |
| "Footsteps on different surfaces" (congusbongus) | **CC-BY 3.0**, verified on the page |
| JC Sounds: Fantasy SFX Pack Vol 1 and Nature Ambient Pack Vol 1 (OGA) | CC-BY 4.0 per search snippet; page not opened |
| "Essentials Pack for Fantasy Games - LOOP BOX #3" | CC-BY 4.0 per search snippet; page not opened |
| Matthew Pablo, Kevin MacLeod (incompetech), Scott Buckley, Alexander Nakarada, HorrorPen, Trevor Lentz, Bart Kelsey, Ville Seppanen | Not checked this session. Commonly CC-BY or CC-BY-SA; check each item if wanted |
| OwlishMedia collections "Ambient Sounds" and "Magic Sounds" | These collections mix licences. Check each item's own page |
| "Spell Effects by StarsteelGaming", "Gothicvania Magic Pack 9" | CC0, but these are sprite (visual) packs, not audio |
| Off-style CC0 (kept as last resort) | "512 Sound Effects (8-bit style)", SubspaceAudio, https://opengameart.org/content/512-sound-effects-8-bit-style ("CC0", 20.6 MB; 8-bit). "Fire Level", Spring Spring ("CC0", chiptune). "Ambient - The Beach Where Dreams Die", Chloe Wolfe ("CC0", chiptune synths + ocean, 29 MB) |
| "Mysterious Ambience (song21)", cynicmusic | Usable (multi-licence that includes CC0) but not needed; Crystal Cave covers marrow |

## Coverage estimate (recommended 41 downloads)

| Category | Covered | Strong (not derived/weak) |
|---|---|---|
| Music themes | **17 / 17** (100 %) | 16 / 17. cinder is a mood compromise |
| Ambience beds | **11 / 11** (100 %, 3 derived) | 8 / 11. cinder, shrine and rift are derived; A8's licence is unverified |
| SFX ids | **174 / 174** (100 %) | about 159 / 174 (≈ 91 %); about 15 weak ids (4 footsteps, 2 battle, about 8 elemental, 1 world) |
| SFX variants | 287 / 287 by pitch derivation | real distinct files exist for most UI, footstep and creature ids |

Downloads:
- 7 Kenney packs
- 8 rubberduck packs
- 1 itch spell pack
- 17 music tracks
- 8 ambience files

Total size:
- Stated sizes: about **176 MB** music + **32 MB** OGA/itch sfx + **34 MB** ambience ≈ **242 MB**.
- Unstated sizes: the 7 Kenney packs (likely a few MB each, ogg/wav; not shown on the pages) and A8.
- Estimate: **≈ 260–300 MB**.
- The big items are M8 New Sunrise (36 MB), M9 volcano (34 MB), M3 boss (22 MB) and M5 pursuit (19 MB), all wav. Taking smaller formats where offered (M16 mp3, M14 mp3) is already assumed.

---

## Suggested sources.json mapping notes

Licence and attribution:
- **CC0 means attribution is not required**, but CREDITS should still list it.
- Several authors ask for credit as a courtesy:
  - cynicmusic: "cynicmusic.com / pixelsphere.org".
  - César da Rocha.
  - beardalaxy.
  - lentikula.
- For the dual-licensed items M17 and Cave Theme, record `"licence": "CC0-1.0"` (the only value `sources.json` accepts) and put "taken under the CC0 option of OGA-BY 3.0 / CC0" in the entry's `note`.

How the ingest fits these files (`tools/audio-pipeline/IMPLEMENTATION-NOTES.md`, "Phase E4 ingest"):
- **One source file per job.** An entry can trim and gain a file but cannot mix several. The beds built from several rows (forge, cinder, rift, vesper = A5 + A6, shrine = A8 + R4 bells) and the "layered" sfx designs (fairy/psychic/cosmic/dragon moves, gravel/sand/salt/ash steps) must first be premixed into one file under `assets-src/audio/cc0/mix/` (e.g. `ffmpeg -i a.ogg -i b.ogg -filter_complex amix=inputs=2 mix/vesper.wav`). Otherwise, map the single best file. Counting each such bed as covered assumes that premix step.
- **Themes need a loop region.** "Loop: yes" files map with no `trim`. Every other track needs a `trim` window of whole bars plus the track's `bpm`/`bars`, so the theme adopts its real tempo instead of being stretched more than 6 %. Add `crossfadeSec` (0.5–2 s, with `trim[0] ≥ crossfadeSec`) when the window does not loop cleanly. Finding those windows is a listening task once the files are on disk.
- **One file per sfx id is enough.** Missing variants are pitch-shifted copies (±1 then ±2 semitones). Mapping a second real file to `_2` is always better.
- **Coverage counted in pipeline jobs** (366 = 68 stems + 11 beds + 287 sfx variants), assuming the premixes above: 17 base tracks give all 68 stems (51 derived); 11 beds; all 174 sfx ids mapped directly with the rest pitch-derived. That is 366 / 366 jobs (100 %) nominal, about 91 % "strong" by the sfx judgement above.

| Manifest id | Source row | Trim / loop notes | CREDITS line |
|---|---|---|---|
| theme battle | M1 | no loop points stated; pipeline crossfade loop | "Battle Theme A" by cynicmusic, https://opengameart.org/content/battle-theme-a (CC0) |
| theme gym | M2 | no loop points; keep the harpsichord bridge in the loop | "Battle Theme B for RPG" by cynicmusic, https://opengameart.org/content/battle-theme-b-for-rpg (CC0) |
| theme champion | M3 | seamless loop as shipped, so use the full file | "Epic Boss Battle" by Juhani Junkala (SubspaceAudio), https://opengameart.org/content/boss-battle-music (CC0) |
| theme elite | M4 | add reverb (author's advice) | "Dramatic Boss Encounter" by cynicmusic, https://opengameart.org/content/dramatic-boss-encounter (CC0) |
| theme raid | M5 | loop as shipped | "Determined Pursuit" by Emma_MA, https://opengameart.org/content/determined-pursuit-epic-orchestra-loop (CC0) |
| theme victory | M6 | trim before the ending (author calls it awkward); loop the fanfare body | "Victory Theme for RPG" by cynicmusic, https://opengameart.org/content/victory-theme-for-rpg (CC0) |
| theme grove | M7 | crossfade loop | "Town Theme RPG" by cynicmusic, https://opengameart.org/content/town-theme-rpg (CC0) |
| theme capital | M8 (V2 file) | choose a loop window in the main theme; source is 48 kHz/24-bit | "New Sunrise" by nene, https://opengameart.org/content/new-sunrise (CC0) |
| theme cinder | M9 (entering_the_volcano.wav) | adopt the track's own tempo; pipeline percussion layer adds the forge feel | "Entering the Volcano" (Ambience of a Fallen Age) by Umplix, https://opengameart.org/content/ambience-of-a-fallen-age (CC0) |
| theme forge | M10 | crossfade loop | "Factory Ambiance" by yd, https://opengameart.org/content/factory-ambiance (CC0) |
| theme marrow | M11 | ~50–60 s file, perfect loop per author | "Crystal Cave (song18)" by cynicmusic, https://opengameart.org/content/crystal-cave-song18 (CC0) |
| theme rift | M12 | loop-ready; low-pass < 1 kHz per manifest | "Post Apocalyptic Wastelands" by Juhani Junkala, https://opengameart.org/content/horror-atmosphere (CC0) |
| theme salt | M13 | crossfade loop | "Seaside Village" by KarateStudios, https://opengameart.org/content/seaside-village (CC0) |
| theme shrine | M14 | loop as shipped | "Dark Shrine Loop" by qubodup (after yd), https://opengameart.org/content/dark-shrine-loop (CC0) |
| theme sky | M15 | short overworld piece; crossfade loop | "Rise Of The Early Dawn" by antonioraymond71, https://opengameart.org/content/rise-of-the-early-dawn (CC0) |
| theme storm | M16 | loopable per author | "Energy Storm" by iamoneabe, https://opengameart.org/content/energy-storm (CC0) |
| theme vesper | M17 | crossfade loop | "Creepy Forest" by Brandon Morris (Augmentality), https://opengameart.org/content/creepy-forest-f (CC0 option) |
| ambience grove/salt/storm/marrow/vesper/sky/capital/shrine | A1–A8 | pick a ~60 s window and crossfade (A2, A7 are 2 min field recordings) | author + page URL per row above |
| ambience forge/cinder/rift | R8 / M9+R8+A3 / M12 | derived beds | as source rows |
| sfx groups | K1–K7, R1–R8, S1 | map files per the SFX table; pitch-derive variants | "Kenney (kenney.nl), CC0"; "rubberduck (OpenGameArt), CC0"; "lentikula (itch.io), CC0" |
