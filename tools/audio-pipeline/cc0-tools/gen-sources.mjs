// Phase E4 (gitignored helper): writes .design/audio/sources.json from the mapping table below plus the attribution
// of each downloaded file (DOWNLOADS.json) and the premix parts (mix/MIXES.json). Re-run after editing the table.
// usage: node _tools/gen-sources.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CC0 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(CC0, '..', '..', '..');
const OUT = path.join(REPO, '.design', 'audio', 'sources.json');
const mixes = JSON.parse(readFileSync(path.join(CC0, 'mix', 'MIXES.json'), 'utf8'));

const KENNEY = (slug, title) => ({ author: 'Kenney (kenney.nl)', url: `https://kenney.nl/assets/${slug}`, title, licenceFile: `KENNEY-${slug}-License.txt` });
const OGA = (slug, title, author) => ({ author, url: `https://opengameart.org/content/${slug}`, title });
// attribution by path prefix (longest match wins)
const PACKS = {
  'kenney/kenney_interface-sounds/': KENNEY('interface-sounds', 'Interface Sounds'),
  'kenney/kenney_ui-audio/': KENNEY('ui-audio', 'UI Audio'),
  'kenney/kenney_impact-sounds/': KENNEY('impact-sounds', 'Impact Sounds'),
  'kenney/kenney_rpg-audio/': KENNEY('rpg-audio', 'RPG Audio'),
  'kenney/kenney_music-jingles/': KENNEY('music-jingles', 'Music Jingles'),
  'kenney/kenney_sci-fi-sounds/': KENNEY('sci-fi-sounds', 'Sci-fi Sounds'),
  'kenney/kenney_digital-audio/': KENNEY('digital-audio', 'Digital Audio'),
  'rubberduck/80-CC0-creature-SFX/': OGA('80-cc0-creature-sfx', '80 CC0 creature SFX', 'rubberduck'),
  'rubberduck/80-CC0-creature-sfx-2/': OGA('80-cc0-creture-sfx-2', '80 CC0 creature SFX #2', 'rubberduck'),
  'rubberduck/80-CC0-RPG-SFX/': { author: 'rubberduck', url: 'https://opengameart.org/node/86018', title: '80 CC0 RPG SFX' },
  'rubberduck/100-CC0-SFX/': OGA('100-cc0-sfx', '100 CC0 SFX', 'rubberduck'),
  'rubberduck/sfx_100_v2/': OGA('100-cc0-sfx-2', '100 CC0 SFX #2', 'rubberduck'),
  'rubberduck/water-splash-slime-sfx/': OGA('40-cc0-water-splash-slime-sfx', '40 CC0 water / splash / slime SFX', 'rubberduck'),
  'rubberduck/100-CC0-wood-metal-SFX/': OGA('100-cc0-metal-and-wood-sfx', '100 CC0 metal and wood SFX', 'rubberduck'),
  'rubberduck/sfx_loops/': OGA('30-cc0-sfx-loops', '30 CC0 SFX loops', 'rubberduck'),
  'subs/rpg-sound-pack/': OGA('rpg-sound-pack', 'RPG Sound Pack', 'artisticdude'),
  'subs/magic-spell-sfx/': OGA('magic-spell-sfx', 'Magic Spell SFX', 'JaggedStone'),
  'subs/cure-magic/': OGA('cure-magic', 'Cure Magic', 'Someoneman'),
  'subs/freeze-spell/': OGA('freeze-spell-0', 'Freeze Spell', 'artisticdude'),
  'subs/teleport-spell/': OGA('teleport-spell', 'Teleport Spell', 'Ogrebane'),
  'subs/ghost-breath/': OGA('ghost-breath', 'Ghost breath', 'qubodup'),
  'subs/earth-element-magic-spell/': OGA('earth-element-magic-spell', 'Earth Element Magic Spell', 'qubodup'),
  'subs/beach-ocean-waves/': OGA('beach-ocean-waves', 'Beach Ocean Waves', 'qubodup (from jasinski, Freesound #18363)'),
  'subs/water-waves/': OGA('water-waves', 'Water Waves', 'qubodup (from transitking, Freesound #11505)'),
  'music/battleThemeA.mp3': OGA('battle-theme-a', 'Battle Theme A', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/battleThemeB.mp3': OGA('battle-theme-b-for-rpg', 'Battle Theme B for RPG', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/junkala-epic-boss-battle-loop.wav': OGA('boss-battle-music', 'Epic Boss Battle [Seamlessly Looping]', 'Juhani Junkala (SubspaceAudio)'),
  'music/dramatic-boss-encounter.wav': OGA('dramatic-boss-encounter', 'Dramatic Boss Encounter', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/determined_pursuit_loop.wav': OGA('determined-pursuit-epic-orchestra-loop', 'Determined Pursuit (epic orchestra loop)', 'Emma_MA'),
  'music/Victory1.mp3': OGA('victory-theme-for-rpg', 'Victory Theme for RPG', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/TownTheme.mp3': OGA('town-theme-rpg', 'Town Theme RPG', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/new_sunrise_V2.wav': OGA('new-sunrise', 'New Sunrise (V2)', 'nene'),
  'music/entering_the_volcano.wav': OGA('ambience-of-a-fallen-age', 'Ambience of a Fallen Age: Entering the Volcano', 'Umplix'),
  'music/Factory.ogg': OGA('factory-ambiance', 'Factory Ambiance', 'yd'),
  'music/song18-crystal-cave.mp3': OGA('crystal-cave-song18', 'Crystal Cave (song18)', 'cynicmusic (cynicmusic.com / pixelsphere.org)'),
  'music/junkala-post-apocalyptic-wastelands-loop.ogg': OGA('horror-atmosphere', 'Post Apocalyptic Wastelands [Loop Ready]', 'Juhani Junkala (SubspaceAudio)'),
  'music/seaside-village.flac': OGA('seaside-village', 'Seaside Village', 'KarateStudios'),
  'music/DarkShrineLoop.flac': OGA('dark-shrine-loop', 'Dark Shrine Loop', 'qubodup (after yd)'),
  'music/rise_of_the_early_dawn.mp3': OGA('rise-of-the-early-dawn', 'Rise Of The Early Dawn', 'antonioraymond71'),
  'music/energystorm.mp3': OGA('energy-storm', 'Energy Storm', 'iamoneabe'),
  'music/creepy-forest.ogg': OGA('creepy-forest-f', 'Creepy Forest (F)', 'Brandon Morris (Augmentality)'),
  'ambience/amb_morning.ogg': OGA('amb-morning-sounds-perfect-loop', 'AMB Morning Sounds (Perfect Loop)', 'Kresiek The Furry'),
  'ambience/Dark_Rainy_Night.ogg': OGA('rain-and-thunders', 'rain and thunders', 'kindland'),
  'ambience/dungeon_ambient_1.ogg': OGA('loopable-dungeon-ambience', 'Loopable Dungeon Ambience', 'JaggedStone'),
  'ambience/crickets.mp3': OGA('crickets-ambient-noise-loopable', 'Crickets Ambient Noise - loopable', 'Wolfgang_'),
  'ambience/wind-woosh-loop.ogg': OGA('wind-whoosh-loop', 'wind whoosh loop', 'SketchMan3'),
};
const NOTES = {
  'music/creepy-forest.ogg': 'dual-licensed OGA-BY 3.0 / CC0 on its page; taken under the CC0 option',
  'subs/': 'substitute for an approved item that needed a login (Phase E4 notes)',
};

function attribution(file) {
  const key = Object.keys(PACKS).filter((k) => file.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (key === undefined) throw new Error(`no attribution for ${file}`);
  const p = PACKS[key];
  const base = path.posix.basename(file).replace(/\.[^.]+$/, '');
  const single = key === file;
  return { author: p.author, url: p.url, title: single ? p.title : `${p.title}: ${base}`, ...(p.licenceFile ? { licenceFile: p.licenceFile } : {}) };
}

// ─── the mapping ────────────────────────────────────────────────────────────────────────────────────────────
const KI = 'kenney/kenney_interface-sounds/Audio/';
const KU = 'kenney/kenney_ui-audio/Audio/';
const KX = 'kenney/kenney_impact-sounds/Audio/';
const KR = 'kenney/kenney_rpg-audio/Audio/';
const PIZ = 'kenney/kenney_music-jingles/Audio/Pizzicato jingles/jingles_PIZZI';
const STL = 'kenney/kenney_music-jingles/Audio/Steel jingles/jingles_STEEL';
const HIT = 'kenney/kenney_music-jingles/Audio/Hit jingles/jingles_HIT';
const KS = 'kenney/kenney_sci-fi-sounds/Audio/';
const KD = 'kenney/kenney_digital-audio/Audio/';
const R1 = 'rubberduck/80-CC0-creature-SFX/';
const R2 = 'rubberduck/80-CC0-creature-sfx-2/';
const R3 = 'rubberduck/80-CC0-RPG-SFX/';
const R4 = 'rubberduck/100-CC0-SFX/';
const R5 = 'rubberduck/sfx_100_v2/';
const R6 = 'rubberduck/water-splash-slime-sfx/';
const R7 = 'rubberduck/100-CC0-wood-metal-SFX/';
const AP = 'subs/rpg-sound-pack/pack/';
const MS = 'subs/magic-spell-sfx/';
const CM = 'subs/cure-magic/';
const MIX = (n) => `mix/${n}.wav`;

/** themes: base track, loop window [s, s+L) of whole bars at the track's own tempo (see Phase E4 notes) */
const THEMES = {
  battle: { file: 'music/battleThemeA.mp3', s: 28.816, L: 39.461, bars: 24, xf: 1.0, note: 'seam corr ≈0.4 (variation, not an exact repeat)' },
  gym: { file: 'music/battleThemeB.mp3', s: 2.09, L: 20.0, bars: 12, xf: 0.75, note: 'seam corr 0.67/0.53' },
  champion: { file: 'music/junkala-epic-boss-battle-loop.wav', s: 51.386, L: 49.372, bars: 36, xf: 2.0, note: 'through-composed; the shipped 123 s loop is over budget, so a 36-bar window with a 2 s seam fade (weak seam)' },
  elite: { file: 'music/dramatic-boss-encounter.wav', s: 4.923, L: 15.0, bars: 8, xf: 0.5, note: 'clean 8-bar repeat (corr 0.74); short' },
  raid: { file: 'music/determined_pursuit_loop.wav', s: 50.968, L: 36.0, bars: 24, xf: 0, note: 'exact repeat (corr 1.00)' },
  victory: { file: 'music/Victory1.mp3', s: 19.365, L: 19.636, bars: 9, xf: 1.0, note: 'seam corr ≈0.35; 9 bars' },
  grove: { file: 'music/TownTheme.mp3', s: 43.236, L: 31.036, bars: 12, xf: 2.0, note: 'through-composed (no repeat found); 2 s seam fade — needs a listen' },
  capital: { file: 'music/new_sunrise_V2.wav', s: 44.954, L: 36.923, bars: 16, xf: 0.5, note: 'strong repeat (corr 0.87–0.90)' },
  cinder: { file: 'music/entering_the_volcano.wav', s: 54.102, L: 32.0, bars: 16, xf: 1.0, note: 'repeat corr 0.77–0.80' },
  forge: { file: 'music/Factory.ogg', s: 26.099, L: 36.0, bars: 12, xf: 1.0, note: 'repeat corr 0.85/0.56' },
  marrow: { file: 'music/song18-crystal-cave.mp3', s: 4.156, L: 33.714, bars: 14, xf: 1.5, note: 'weak seam (corr 0.45 at the seam); needs a listen' },
  rift: { file: MIX('theme_rift'), s: 6.0, L: 32.0, bars: 8, xf: 2.0, bpm: 60, note: 'no pulse in the source; 32 s window (8 bars at the bible tempo) of a 1 kHz low-passed premix, 2 s seam fade' },
  salt: { file: 'music/seaside-village.flac', s: 43.561, L: 24.0, bars: 16, xf: 1.0, note: 'repeat corr 0.50/0.39' },
  shrine: { file: 'music/DarkShrineLoop.flac', s: 5.016, L: 25.087, bars: 9, xf: 1.5, note: 'repeat corr 0.67 at the seam; 9 bars' },
  sky: { file: 'music/rise_of_the_early_dawn.mp3', s: 69.567, L: 16.0, bars: 8, xf: 0.5, note: 'clean 8-bar repeat (corr 0.86–0.90); short' },
  storm: { file: 'music/energystorm.mp3', s: 35.619, L: 41.379, bars: 20, xf: 0.5, note: 'strong repeat (corr 0.90–0.95)' },
  vesper: { file: 'music/creepy-forest.ogg', s: 29.931, L: 36.0, bars: 10, xf: 1.0, note: 'repeat corr 0.80/0.81' },
};

/** ambience beds: one file each (premixes from several CC0 files where the bed needs layers) */
const BEDS = {
  grove: { file: MIX('bed_grove') },
  marrow: { file: MIX('bed_marrow') },
  salt: { file: MIX('bed_salt') },
  storm: { file: MIX('bed_storm') },
  vesper: { file: MIX('bed_vesper') },
  sky: { file: MIX('bed_sky') },
  capital: { file: MIX('bed_capital') },
  shrine: { file: MIX('bed_shrine') },
  forge: { file: MIX('bed_forge') },
  cinder: { file: MIX('bed_cinder') },
  rift: { file: MIX('bed_rift') },
};

/** sfx: id → list of files (variant 1, 2, …); a string or { file, trim, gainDb } */
const T = (file, a, b) => ({ file, trim: [a, b] });
const SFX = {
  // ui
  ui_back: [KI + 'back_002.ogg'],
  ui_badge: [HIT + '15.ogg'],
  ui_click: [KI + 'click_001.ogg', KU + 'click3.ogg'],
  ui_close: [KR + 'bookClose.ogg'],
  ui_confirm: [KI + 'confirmation_001.ogg'],
  ui_dialogue_advance: [KI + 'select_001.ogg'],
  ui_error: [KI + 'error_003.ogg'],
  ui_evolve_done: [CM + 'Cure6.wav'],
  ui_evolve_start: [AP + 'battle/spell.wav'],
  ui_heal: [CM + 'Cure1.wav'],
  ui_item_get: [PIZ + '10.ogg'],
  ui_item_use: [AP + 'inventory/bottle.wav'],
  ui_levelup: [STL + '02.ogg'],
  ui_notify: [KI + 'glass_001.ogg'],
  ui_open: [KR + 'bookOpen.ogg'],
  ui_quest: [KR + 'bookFlip1.ogg'],
  ui_quest_done: [PIZ + '12.ogg'],
  ui_save: [KI + 'scratch_004.ogg'],
  ui_shop_buy: [KR + 'handleCoins2.ogg', R3 + 'item_coins_01.ogg'],
  ui_shop_deny: [KR + 'handleSmallLeather.ogg'],
  ui_shop_sell: [AP + 'inventory/coin.wav'],
  ui_tab: [KI + 'tick_004.ogg'],
  ui_toast: [R4 + 'bell_02.ogg'],
  ui_trade: [MS + 'magical_5.ogg'],
  ui_type: [KI + 'click_002.ogg', KI + 'click_003.ogg', KI + 'click_004.ogg'],
  ui_witness: [MIX('ui_witness_1')],
  // stingers: CC0 music excerpts (and Kenney jingles), cut on an onset; fitSfx fades the tail
  ui_stinger_beat: [T('music/song18-crystal-cave.mp3', 7.15, 10.4)],
  ui_stinger_catch: [PIZ + '02.ogg'],
  ui_stinger_defeat: [PIZ + '01.ogg'],
  ui_stinger_intro_champion: [T('music/new_sunrise_V2.wav', 33.6, 37.85)],
  ui_stinger_intro_elite: [T('music/junkala-epic-boss-battle-loop.wav', 0.25, 4.0)],
  ui_stinger_intro_gym: [T('music/dramatic-boss-encounter.wav', 2.05, 5.3)],
  ui_stinger_intro_legendary: [T('music/junkala-post-apocalyptic-wastelands-loop.ogg', 9.9, 14.15)],
  ui_stinger_intro_raid: [T('music/determined_pursuit_loop.wav', 0.7, 4.45)],
  ui_stinger_intro_trainer: [T('music/battleThemeB.mp3', 0.0, 2.75)],
  ui_stinger_intro_wild: [T('music/battleThemeA.mp3', 0.42, 2.67)],
  ui_stinger_restored: [T('music/song18-crystal-cave.mp3', 41.0, 45.25)],
  ui_stinger_thinning: [MIX('ui_stinger_thinning_1')],
  ui_stinger_title: [T('music/TownTheme.mp3', 0.0, 2.75)],
  ui_stinger_victory_champion: [T('music/new_sunrise_V2.wav', 116.2, 120.45)],
  ui_stinger_victory_gym: [T('music/new_sunrise_V2.wav', 87.95, 91.7)],
  ui_stinger_victory_legendary: [T('music/rise_of_the_early_dawn.mp3', 0.0, 4.25)],
  ui_stinger_victory_raid: [T('music/new_sunrise_V2.wav', 107.5, 111.75)],
  ui_stinger_victory_trainer: [T('music/Victory1.mp3', 6.22, 9.47)],
  ui_stinger_victory_wild: [T('music/Victory1.mp3', 1.85, 4.6)],
  // footsteps
  step_grass: [KX + 'footstep_grass_000.ogg', KX + 'footstep_grass_001.ogg', KX + 'footstep_grass_002.ogg'],
  step_snow: [KX + 'footstep_snow_000.ogg', KX + 'footstep_snow_001.ogg', KX + 'footstep_snow_002.ogg'],
  step_wood: [KX + 'footstep_wood_000.ogg', KX + 'footstep_wood_001.ogg', KX + 'footstep_wood_002.ogg'],
  step_stone: [KX + 'footstep_concrete_000.ogg', KX + 'footstep_concrete_001.ogg', KX + 'footstep_concrete_002.ogg'],
  step_flat: [KX + 'footstep_carpet_000.ogg', KX + 'footstep_carpet_001.ogg', KX + 'footstep_carpet_002.ogg'],
  step_dirt: [KR + 'footstep00.ogg', KR + 'footstep01.ogg', KR + 'footstep02.ogg'],
  step_metal: [R7 + 'metal_sheet_05.ogg', R7 + 'metal_sheet_04.ogg', KX + 'impactMetal_light_004.ogg'],
  step_water: [R5 + 'sfx100v2_footstep_wet_01.ogg', R5 + 'sfx100v2_footstep_wet_02.ogg', R5 + 'sfx100v2_footstep_wet_03.ogg'],
  step_sand: [1, 2, 3].map((i) => MIX(`step_sand_${i}`)),
  step_gravel: [1, 2, 3].map((i) => MIX(`step_gravel_${i}`)),
  step_salt: [1, 2, 3].map((i) => MIX(`step_salt_${i}`)),
  step_ash: [1, 2, 3].map((i) => MIX(`step_ash_${i}`)),
  grass_rustle: [1, 2, 3].map((i) => MIX(`grass_rustle_${i}`)),
  // battle
  hit_normal: [KX + 'impactPunch_medium_000.ogg', KX + 'impactPunch_medium_001.ogg', KX + 'impactPunch_medium_002.ogg'],
  hit_super: [KX + 'impactPunch_heavy_000.ogg', KX + 'impactPunch_heavy_001.ogg', KX + 'impactPunch_heavy_002.ogg'],
  hit_weak: [KX + 'impactSoft_heavy_000.ogg', KX + 'impactSoft_heavy_001.ogg'],
  hit_crit: [MIX('hit_crit_1'), MIX('hit_crit_2')],
  faint: [MIX('faint_1'), MIX('faint_2')],
  flee: [MIX('flee_1')],
  switch: [MIX('switch_1')],
  orb_throw: [MIX('orb_throw_1')],
  orb_shake: [MIX('orb_shake_1'), MIX('orb_shake_2'), MIX('orb_shake_3')],
  orb_catch: [MIX('orb_catch_1')],
  orb_break: [MIX('orb_break_1'), MIX('orb_break_2')],
  stage_up: [KD + 'highUp.ogg'],
  stage_down: [KD + 'lowDown.ogg'],
  status_burn: [R3 + 'spell_fire_06.ogg', R3 + 'spell_fire_07.ogg'],
  status_confuse: [KD + 'spaceTrash1.ogg', KD + 'spaceTrash3.ogg'],
  status_freeze: [T('subs/freeze-spell/freeze.wav', 0, 1.3)],
  status_heal: [CM + 'Cure2.wav', CM + 'Cure4.wav'],
  status_paralyze: [KD + 'zap1.ogg', KD + 'zap2.ogg'],
  status_poison: [AP + 'inventory/bubble3.wav', R6 + 'bubble_01.ogg'],
  status_sleep: [MIX('status_sleep_1')],
  weather_rain: [MIX('weather_rain_1')],
  weather_hail: [MIX('weather_hail_1')],
  weather_sand: [MIX('weather_sand_1')],
  weather_sun: [MIX('weather_sun_1')],
  spotted: [HIT + '00.ogg'],
  thunder: [T(R5 + 'sfx100v2_thunder_01.ogg', 0, 4.0), T('ambience/Dark_Rainy_Night.ogg', 33.7, 38.2)],
  wind_gust: [R5 + 'sfx100v2_air_01.ogg', MIX('wind_gust_2')],
  // signature moves (client battle/signatures.ts): one layered premix each (mix.py, timed from the cinematic's charge)
  sig_aurora_requiem: [MIX('sig_aurora_requiem_1')],
  sig_bankai_sever: [MIX('sig_bankai_sever_1')],
  sig_cosmic_miracle: [MIX('sig_cosmic_miracle_1')],
  sig_cosmic_pyre: [MIX('sig_cosmic_pyre_1')],
  sig_cosmic_convergence: [MIX('sig_cosmic_convergence_1')],
  sig_crimson_lotus_prison: [MIX('sig_crimson_lotus_prison_1')],
  sig_demon_lords_descent: [MIX('sig_demon_lords_descent_1')],
  sig_thermal_shock: [MIX('sig_thermal_shock_1')],
  sig_foxfire_voltage: [MIX('sig_foxfire_voltage_1')],
  sig_hollow_crescent: [MIX('sig_hollow_crescent_1')],
  sig_kamehameha: [MIX('sig_kamehameha_1')],
  sig_rift_collapse: [MIX('sig_rift_collapse_1')],
  sig_sparking_grace: [MIX('sig_sparking_grace_1')],
  sig_stellar_devour: [MIX('sig_stellar_devour_1')],
  sig_sunbreaker_barrage: [MIX('sig_sunbreaker_barrage_1')],
  sig_vendetta_volley: [MIX('sig_vendetta_volley_1')],
  // Majin / Tenjin bond cinematics (client battle/bond.ts): heartbeats, the lock and the burst (mix.py, from the bond frame)
  bond_majin: [MIX('bond_majin_1')],
  bond_tenjin: [MIX('bond_tenjin_1')],
  raid_phase: [MIX('raid_phase_1')],
  raid_roar: [MIX('raid_roar_1')],
  // world
  anvil_strike: [R7 + 'hammer_01.ogg', R4 + 'metal_04.ogg'],
  bell_toll: [MIX('bell_toll_1')],
  door_close: [KR + 'doorClose_1.ogg'],
  door_heavy: [MIX('door_heavy_1')],
  door_open: [KR + 'doorOpen_1.ogg', KR + 'doorOpen_2.ogg'],
  lens_hum: [MIX('lens_hum_1')],
  lore_tablet: [MIX('lore_tablet_1')],
  pylon_crackle: [KS + 'forceField_000.ogg', KS + 'forceField_003.ogg'],
  spawn_shimmer: [MS + 'magical_1_0.ogg', CM + 'Cure5.wav'],
  splash: [R6 + 'splash_02.ogg', R6 + 'splash_03.ogg'],
  warp: ['subs/teleport-spell/teleport.wav'],
  // creatures: cry ×2, hurt ×1 per type
  cry_normal: [R1 + 'cute_09.ogg', R1 + 'barking_01.ogg'],
  cry_fire: [R1 + 'monster_03.ogg', R2 + 'monster_09.ogg'],
  cry_water: [R1 + 'burble_01.ogg', R1 + 'burble_02.ogg'],
  cry_grass: [R1 + 'misc_04.ogg', R1 + 'misc_08.ogg'],
  cry_electric: [R1 + 'alien_01.ogg', R2 + 'alien_08.ogg'],
  cry_ice: [R1 + 'alien_06.ogg', R2 + 'alien_10.ogg'],
  cry_fighting: [R1 + 'grunt_05.ogg', R1 + 'grunt_02.ogg'],
  cry_poison: [R1 + 'spit_02.ogg', R2 + 'slime_08.ogg'],
  cry_ground: [R1 + 'grunt_03.ogg', R2 + 'grunt_07.ogg'],
  cry_flying: [R1 + 'scream_01.ogg', R1 + 'scream_02.ogg'],
  cry_psychic: [R2 + 'misc_11.ogg', R1 + 'weird_02.ogg'],
  cry_bug: [R1 + 'bug_02.ogg', R2 + 'bug_07.ogg'],
  cry_rock: [R1 + 'troll_01.ogg', R2 + 'monster_12.ogg'],
  cry_ghost: [AP + 'NPC/shade/shade12.wav', AP + 'NPC/shade/shade9.wav'],
  cry_dragon: [R2 + 'roar_05.ogg', R2 + 'roar_06.ogg'],
  cry_dark: [R2 + 'monster_16.ogg', R1 + 'roar_03.ogg'],
  cry_steel: [MIX('cry_steel_1'), R2 + 'weird_06.ogg'],
  cry_fairy: [MIX('cry_fairy_1'), MIX('cry_fairy_2')],
  cry_cosmic: [MIX('cry_cosmic_1'), MIX('cry_cosmic_2')],
  hurt_normal: [R1 + 'hurt_03.ogg'],
  hurt_fire: [R1 + 'hurt_02.ogg'],
  hurt_water: [R2 + 'slime_02.ogg'],
  hurt_grass: [R7 + 'wood_squeak_02.ogg'],
  hurt_electric: [R1 + 'alien_05.ogg'],
  hurt_ice: [R2 + 'alien_12.ogg'],
  hurt_fighting: [R1 + 'hurt_05.ogg'],
  hurt_poison: [R2 + 'slime_07.ogg'],
  hurt_ground: [R2 + 'grunt_08.ogg'],
  hurt_flying: [R2 + 'misc_17.ogg'],
  hurt_psychic: [R1 + 'weird_01.ogg'],
  hurt_bug: [R2 + 'bug_12.ogg'],
  hurt_rock: [AP + 'NPC/giant/giant4.wav'],
  hurt_ghost: [AP + 'NPC/shade/shade14.wav'],
  hurt_dragon: [R3 + 'creature_hurt_01.ogg'],
  hurt_dark: [R2 + 'monster_14.ogg'],
  hurt_steel: [R2 + 'monster_15.ogg'],
  hurt_fairy: [R1 + 'cute_07.ogg'],
  hurt_cosmic: [R1 + 'weird_05.ogg'],
  // moves (wind-up) and impacts, ×2
  move_normal: [AP + 'battle/swing.wav', KR + 'cloth1.ogg'],
  impact_normal: [KX + 'impactSoft_heavy_002.ogg', KX + 'impactSoft_heavy_004.ogg'],
  move_fire: [R3 + 'spell_fire_01.ogg', R3 + 'spell_fire_02.ogg'],
  impact_fire: [KS + 'explosionCrunch_000.ogg', R3 + 'spell_fire_05.ogg'],
  move_water: [MIX('move_water_1')],
  impact_water: [R6 + 'splash_01.ogg', R6 + 'splash_05.ogg'],
  move_grass: [MIX('move_grass_1')],
  impact_grass: [MIX('impact_grass_1')],
  move_electric: [KS + 'forceField_001.ogg', KD + 'phaserUp2.ogg'],
  impact_electric: [KS + 'laserLarge_001.ogg', KS + 'laserLarge_003.ogg'],
  move_ice: [MIX('move_ice_1')],
  impact_ice: [KX + 'impactGlass_heavy_001.ogg', KX + 'impactGlass_heavy_004.ogg'],
  move_fighting: [AP + 'battle/swing2.wav', AP + 'battle/swing3.wav'],
  impact_fighting: [KX + 'impactPunch_heavy_003.ogg', KX + 'impactPunch_heavy_004.ogg'],
  move_poison: [R6 + 'bubble_03.ogg', AP + 'inventory/bubble2.wav'],
  impact_poison: [R6 + 'slime_01.ogg', R6 + 'slime_05.ogg'],
  move_ground: [MIX('move_ground_1'), T('subs/earth-element-magic-spell/Earth_Element_Magic_Spell_3.ogg', 0, 1.0)],
  impact_ground: [KX + 'impactMining_000.ogg', KX + 'impactMining_002.ogg'],
  move_flying: [MIX('move_flying_1')],
  impact_flying: [MIX('impact_flying_1')],
  move_psychic: [KD + 'phaserUp1.ogg', KD + 'phaserUp5.ogg'],
  impact_psychic: [KS + 'forceField_002.ogg', KD + 'lowRandom.ogg'],
  move_bug: [MIX('move_bug_1')],
  impact_bug: [AP + 'NPC/beetle/bite-small.wav', AP + 'NPC/beetle/bite-small2.wav'],
  move_rock: [R3 + 'stones_01.ogg', R3 + 'stones_02.ogg'],
  impact_rock: [R3 + 'stones_03.ogg', KX + 'impactMining_001.ogg'],
  move_ghost: [MIX('move_ghost_1'), MIX('move_ghost_2')],
  impact_ghost: [MIX('impact_ghost_1')],
  move_dragon: [MIX('move_dragon_1')],
  impact_dragon: [MIX('impact_dragon_1')],
  move_dark: [MIX('move_dark_1')],
  impact_dark: [R1 + 'eat_04.ogg', R1 + 'eat_01.ogg'],
  move_steel: [AP + 'battle/sword-unsheathe.wav', AP + 'battle/sword-unsheathe2.wav'],
  impact_steel: [R7 + 'metal_hit_01.ogg', KX + 'impactMetal_heavy_001.ogg'],
  move_fairy: [MS + 'magical_2.ogg', T(CM + 'Cure3.wav', 0, 1.0)],
  impact_fairy: [KX + 'impactBell_heavy_002.ogg', KX + 'impactBell_heavy_003.ogg'],
  move_cosmic: [MIX('move_cosmic_1')],
  impact_cosmic: [MIX('impact_cosmic_1')],
};

// ─── build ──────────────────────────────────────────────────────────────────────────────────────────────────
const out = {
  $comment:
    'Phase E4: jobId -> CC0 source file under assets-src/audio/cc0/ (+ attribution). Generated from the approved downloads (assets-src/audio/cc0/DOWNLOADS.json) and premixes (mix/, credited through `parts`). Theme windows: whole bars at each track\'s own tempo, found by self-similarity analysis; see tools/audio-pipeline/IMPLEMENTATION-NOTES.md "Phase E4 downloads".',
};
function entry(file, extra = {}) {
  if (!existsSync(path.join(CC0, file))) throw new Error(`missing ${file}`);
  if (file.startsWith('mix/')) {
    const parts = mixes[path.posix.basename(file)];
    if (!parts) throw new Error(`no MIXES.json record for ${file}`);
    const ps = parts.map((p) => ({ file: p, ...attribution(p) }));
    const authors = [...new Set(ps.map((p) => p.author))];
    return { file, licence: 'CC0-1.0', author: authors.join('; '), url: ps[0].url, title: `Premix: ${path.posix.basename(file, '.wav')}`, ...extra, parts: ps };
  }
  const a = attribution(file);
  const note = Object.entries(NOTES).find(([k]) => file.startsWith(k))?.[1];
  const notes = [extra.note, note].filter(Boolean).join('; ');
  return { file, licence: 'CC0-1.0', ...a, ...extra, ...(notes ? { note: notes } : {}) };
}
for (const [id, t] of Object.entries(THEMES)) {
  const bpm = t.bpm ?? Math.round(((t.bars * 240) / t.L) * 1e6) / 1e6;
  const L = t.bpm ? (t.bars * 240) / t.bpm : t.L;
  out[`themes/${id}/base`] = entry(t.file, {
    trim: [t.s, Math.round((t.s + L) * 1e6) / 1e6],
    bpm,
    bars: t.bars,
    ...(t.xf > 0 ? { crossfadeSec: t.xf } : {}),
    note: `loop window ${t.s}–${(t.s + L).toFixed(3)} s; ${t.note}`,
  });
}
for (const [id, b] of Object.entries(BEDS)) out[`ambience/${id}`] = entry(b.file, b.trim ? { trim: b.trim } : {});
for (const [id, list] of Object.entries(SFX)) {
  list.forEach((v, i) => {
    const o = typeof v === 'string' ? { file: v } : v;
    const { file, ...extra } = o;
    out[`sfx/${id}_${i + 1}`] = entry(file, extra);
  });
}
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${Object.keys(out).length - 1} entries → ${OUT}`);
