"use strict";
/**
 * worldImported.js — canonical world adapter for the 3D "Ewa" overworld.
 *
 * The 2D Phaser/Tiled world (bloom-town/ember-route/...) was retired in favour
 * of the hand-crafted 3D overworld that ships in `frontend/src/world3d/`. That
 * world is now AUTHORITATIVE: its area ids (mirevale, mire_route, cinderhold,
 * ...) are the canonical map names, and its per-route wild tables are the
 * source for `rollEncounter`.
 *
 * The module surface is unchanged (route/quest/auth/liveOps modules import many
 * of these constants); only the data + a few defaults moved to the new world.
 * Encounter tables are keyed by area id; `rollEncounter("mire_route")` returns
 * a `{ speciesId, levelMin, levelMax, weight }` for the wild encounter pipeline.
 */

const WORLD_ID = "ewa-world-3d";

// Canonical area list — mirrors `AREA_ORDER` + the special zones in the 3D
// world's `src/world3d/world.js`. 8 town/route pairs + 5 special zones.
const MAP_NAMES = [
  "mirevale",   "mire_route",
  "cinderhold", "ash_route",
  "saltmourn",  "tide_route",
  "stormrook",  "galvan_route",
  "marrowdig",  "deepcut_route",
  "vesperveil", "hollow_route",
  "forgewall",  "siege_route",
  "skyrend",    "ascent_route",
  // Special / story zones (no wild encounters).
  "eclipse_shrine", "solenne",
  "umbral_observatory", "celestial_spire", "the_rift",
];

// Mirevale spawn — matches the 3D world's player start (`state.js`: x 0, z 6).
// Note: the overworld uses continuous floats; x/y here carry x/z.
const START_POSITION = Object.freeze({
  x: 0,
  y: 6,
  mapId: "mirevale",
});

// Per-route wild encounter tables. Each entry → { speciesId, levelMin, levelMax, weight }.
// `rollEncounter` picks weighted-random; weight defaults to 1.
//
// Ported verbatim from the 3D world's `ENCOUNTERS` table (`world.js`), where
// each row is `[speciesId, weight, loLvl, hiLvl]`. Only the 8 routes have wild
// grass; towns + special zones have no table. Every species id is verified to
// exist in `data/ewamon.js` (the single source of truth, 130 species).
//
// Levels climb route-by-route (2 → 42) Pokémon-style; `weight` is the spawn
// lottery (common ~6, uncommon ~3-5, rare ~2).
const ENCOUNTER_TABLES = {
  // ── Mire Route ── grass starter zone (Lv 2–5) ─────────────────────────
  "mire_route": [
    { speciesId: "mossling",  levelMin: 2, levelMax: 5, weight: 6 },
    { speciesId: "glimp",     levelMin: 2, levelMax: 4, weight: 6 },
    { speciesId: "seedrift",  levelMin: 3, levelMax: 5, weight: 5 },
    { speciesId: "smellduck", levelMin: 2, levelMax: 5, weight: 5 },
    { speciesId: "dreambud",  levelMin: 3, levelMax: 5, weight: 3 },
    { speciesId: "mufflo",    levelMin: 2, levelMax: 4, weight: 4 },
  ],

  // ── Ash Route ── volcanic foothills (Lv 6–10) ─────────────────────────
  "ash_route": [
    { speciesId: "flampling", levelMin: 6, levelMax: 10, weight: 6 },
    { speciesId: "wickling",  levelMin: 6, levelMax: 9,  weight: 5 },
    { speciesId: "embrock",   levelMin: 7, levelMax: 10, weight: 5 },
    { speciesId: "pebfist",   levelMin: 6, levelMax: 9,  weight: 4 },
    { speciesId: "coalette",  levelMin: 8, levelMax: 10, weight: 4 },
  ],

  // ── Tide Route ── coastal / surf (Lv 10–15) ───────────────────────────
  "tide_route": [
    { speciesId: "mudbub",    levelMin: 10, levelMax: 13, weight: 6 },
    { speciesId: "slushpup",  levelMin: 11, levelMax: 14, weight: 5 },
    { speciesId: "brookrawl", levelMin: 10, levelMax: 13, weight: 5 },
    { speciesId: "mossling",  levelMin: 10, levelMax: 12, weight: 4 },
    { speciesId: "glowtent",  levelMin: 12, levelMax: 15, weight: 3 },
    { speciesId: "tidespine", levelMin: 12, levelMax: 15, weight: 3 },
  ],

  // ── Galvan Route ── storm plains (Lv 15–20) ───────────────────────────
  "galvan_route": [
    { speciesId: "ampmite",    levelMin: 15, levelMax: 18, weight: 6 },
    { speciesId: "stormchick", levelMin: 15, levelMax: 18, weight: 5 },
    { speciesId: "gustuff",    levelMin: 15, levelMax: 18, weight: 5 },
    { speciesId: "shardling",  levelMin: 17, levelMax: 20, weight: 4 },
    { speciesId: "glimfin",    levelMin: 16, levelMax: 20, weight: 3 },
  ],

  // ── Deepcut Route ── rocky badlands (Lv 20–25) ────────────────────────
  "deepcut_route": [
    { speciesId: "pebblit",  levelMin: 20, levelMax: 23, weight: 6 },
    { speciesId: "embrock",  levelMin: 20, levelMax: 23, weight: 5 },
    { speciesId: "berkest",  levelMin: 21, levelMax: 24, weight: 4 },
    { speciesId: "pebfist",  levelMin: 20, levelMax: 23, weight: 5 },
    { speciesId: "coalette", levelMin: 22, levelMax: 25, weight: 3 },
  ],

  // ── Hollow Route ── haunted glade (Lv 25–30) ──────────────────────────
  "hollow_route": [
    { speciesId: "nettlewisp", levelMin: 25, levelMax: 28, weight: 5 },
    { speciesId: "murkrat",    levelMin: 25, levelMax: 28, weight: 5 },
    { speciesId: "zaptus",     levelMin: 25, levelMax: 28, weight: 4 },
    { speciesId: "hexroach",   levelMin: 26, levelMax: 29, weight: 4 },
    { speciesId: "nerohat",    levelMin: 27, levelMax: 30, weight: 3 },
    { speciesId: "umbrit",     levelMin: 27, levelMax: 30, weight: 3 },
    { speciesId: "darkone",    levelMin: 28, levelMax: 30, weight: 2 },
  ],

  // ── Siege Route ── industrial pass (Lv 30–35) ─────────────────────────
  "siege_route": [
    { speciesId: "grubolt",   levelMin: 30, levelMax: 33, weight: 6 },
    { speciesId: "coldplate", levelMin: 30, levelMax: 33, weight: 5 },
    { speciesId: "shardling", levelMin: 30, levelMax: 33, weight: 4 },
    { speciesId: "scraphog",  levelMin: 32, levelMax: 35, weight: 4 },
    { speciesId: "alloylark", levelMin: 32, levelMax: 35, weight: 3 },
  ],

  // ── Ascent Route ── dragon's peak finale (Lv 35–42) ───────────────────
  "ascent_route": [
    { speciesId: "scalewisp", levelMin: 35, levelMax: 38, weight: 6 },
    { speciesId: "budwing",   levelMin: 35, levelMax: 38, weight: 5 },
    { speciesId: "tidalfang", levelMin: 36, levelMax: 39, weight: 4 },
    { speciesId: "glacifang", levelMin: 36, levelMax: 39, weight: 4 },
    { speciesId: "serpyre",   levelMin: 39, levelMax: 42, weight: 2 },
  ],
};

// One-time catchable legendary statics — gated exactly as the 3D overworld
// spawns them (`when`: badge:<id> or flag:<f>). Keyed by species id. The gate is
// re-validated server-side in /wild `request_legendary_encounter` so a client
// can never force-spawn a gated legendary to catch it early.
const LEGENDARIES = {
  raikitsune: { species: "raikitsune", level: 30, area: "galvan_route",        when: "badge:circuit" },
  bankaiser:  { species: "bankaiser",  level: 42, area: "forgewall",           when: "badge:anvil" },
  galaxion:   { species: "galaxion",   level: 38, area: "umbral_observatory",  when: "flag:hq_done" },
  sunjaw:     { species: "sunjaw",     level: 55, area: "ash_route",           when: "flag:champion" },
  glacinid:   { species: "glacinid",   level: 55, area: "ascent_route",        when: "flag:champion" },
  voltaura:   { species: "voltaura",   level: 55, area: "galvan_route",        when: "flag:champion" },
  zenryu:     { species: "zenryu",     level: 60, area: "eclipse_shrine",      when: "flag:champion" },
  lumyth:     { species: "lumyth",     level: 60, area: "celestial_spire",     when: "flag:champion" },
  voidraxis:  { species: "voidraxis",  level: 65, area: "the_rift",            when: "flag:champion" },
  // Climax boss. Gated on `siege_done` (the last story flag PERSISTED to the
  // server before the climax) — NOT `climax`, which the engine only sets mid-
  // sequence as it spawns this very battle and hasn't persisted yet. Gating on
  // `climax` deadlocked the finale (boss needs climax; climax needs the boss).
  noxmyth:    { species: "noxmyth",    level: 55, area: "eclipse_shrine",      when: "flag:siege_done" },
};
function getLegendary(key) {
  return Object.prototype.hasOwnProperty.call(LEGENDARIES, String(key)) ? LEGENDARIES[String(key)] : null;
}

const ENCOUNTER_RATES = Object.freeze({ default: 10 });

function isEncounterMap(mapId) {
  return typeof mapId === "string" && Object.prototype.hasOwnProperty.call(ENCOUNTER_TABLES, mapId);
}

function rollEncounter(mapId) {
  const table = ENCOUNTER_TABLES[mapId];
  if (!table || table.length === 0) return null;
  const total = table.reduce((acc, e) => acc + (e.weight || 1), 0);
  let pick = Math.random() * total;
  for (const entry of table) {
    pick -= entry.weight || 1;
    if (pick <= 0) return entry;
  }
  return table[0];
}

function sanitizeMapPosition(raw) {
  const out = { x: START_POSITION.x, y: START_POSITION.y, mapId: START_POSITION.mapId };
  if (raw && typeof raw === "object") {
    if (typeof raw.x === "number" && Number.isFinite(raw.x)) out.x = raw.x;
    if (typeof raw.y === "number" && Number.isFinite(raw.y)) out.y = raw.y;
    if (typeof raw.mapId === "string" && MAP_NAMES.includes(raw.mapId)) {
      out.mapId = raw.mapId;
    }
  }
  return out;
}

function getAreaIdAt(_x, _y, mapId) {
  return typeof mapId === "string" ? mapId : START_POSITION.mapId;
}
function getAreaAt(_x, _y, mapId) {
  return { id: mapId, name: mapId };
}

function getPublicWorldData() {
  return {
    worldId: WORLD_ID,
    startingMap: START_POSITION.mapId,
    maps: MAP_NAMES,
    startPosition: START_POSITION,
  };
}

// Collision lives entirely in the client (the 3D overworld resolves circular
// solids). Server treats any tile as walkable.
function isInBounds() { return true; }
function isWalkableTile() { return true; }
function isWaterTile()    { return false; }
function isGrassTile()    { return false; }
function getInteractionAt() { return null; }
function getInteractionNear() { return null; }
function getTileAt() { return null; }

module.exports = {
  AREAS: [],
  BACKGROUND_IMAGE: null,
  ENCOUNTER_TABLES,
  ENCOUNTER_RATES,
  LEGENDARIES,
  getLegendary,
  GRASS_TILES: [],
  INTERACTIONS: {},
  MAP_H: 20, MAP_W: 30,
  MAP_PX_H: 320, MAP_PX_W: 480,
  MAP_LAYOUT: [],
  MAP_NAMES,
  TILE_KEYS_BY_TYPE: {},
  TILE_SIZE: 16,
  TILE_TYPES: {},
  VIEW_H: 20, VIEW_W: 30,
  WATER_TILES: [],
  WALKABLE: [],
  WORLD_ID,
  START_POSITION,
  getAreaAt, getAreaIdAt, getInteractionAt, getInteractionNear,
  getPublicWorldData, getTileAt, isInBounds, isWalkableTile, isGrassTile,
  isWaterTile, rollEncounter, sanitizeMapPosition, isEncounterMap,
};
