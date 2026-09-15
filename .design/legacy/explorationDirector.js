"use strict";
/**
 * explorationDirector — world heat, hotspots, and raid rotation.
 *
 * Rebuilt May 2026 for the TMJ overworld: hotspots/raids are keyed by **string
 * mapIds** matching the .tmj filenames (e.g. "bloom-route"). The old numeric
 * Kanto/Johto tables (mapId: 55/40/…) wouldn't match anything after the
 * rewrite, so raids never spawned. This rebuild restores that.
 */

const { getAreaIdAt } = require("../data/worldImported");

// ── Zone metadata ──────────────────────────────────────────────────────────────
// The 8 wild routes; towns/arena/champion-hall are not encounter zones.
const ZONE_ORDER = [
  "bloom-route",
  "ember-route",
  "tidal-route",
  "volt-route",
  "stone-route",
  "phantom-route",
  "iron-route",
  "draco-route",
];

const ZONE_LABELS = {
  "bloom-route":   "Bloom Route",
  "ember-route":   "Ember Route",
  "tidal-route":   "Tidal Route",
  "volt-route":    "Volt Route",
  "stone-route":   "Stone Route",
  "phantom-route": "Phantom Route",
  "iron-route":    "Iron Route",
  "draco-route":   "Draco Route",
};

const ZONE_TIERS = {
  "bloom-route":   "early",
  "ember-route":   "early",
  "tidal-route":   "mid",
  "volt-route":    "mid",
  "stone-route":   "late",
  "phantom-route": "late",
  "iron-route":    "late",
  "draco-route":   "late",
};

// TMJ maps are 30 wide × 20 high. Hotspot coords stay well inside those bounds.
const HOTSPOT_TEMPLATES = {
  "bloom-route": [
    { id: "bloom-meadow",  mapId: "bloom-route",  x: 8,  y: 10, radius: 5, title: "Meadow Surge",     type: "surge" },
    { id: "bloom-thicket", mapId: "bloom-route",  x: 22, y: 14, radius: 5, title: "Thicket Watch",    type: "roaming" },
  ],
  "ember-route": [
    { id: "ember-crater",  mapId: "ember-route",  x: 10, y: 8,  radius: 5, title: "Crater Ambush",    type: "ambush" },
    { id: "ember-flow",    mapId: "ember-route",  x: 20, y: 12, radius: 5, title: "Lava Flow Pulse",  type: "roaming" },
  ],
  "tidal-route": [
    { id: "tidal-break",   mapId: "tidal-route",  x: 12, y: 10, radius: 6, title: "Tideglass Break", type: "surge" },
    { id: "tidal-jetty",   mapId: "tidal-route",  x: 22, y: 14, radius: 5, title: "Breaker Point",   type: "ambush" },
  ],
  "volt-route": [
    { id: "volt-storm",    mapId: "volt-route",   x: 9,  y: 9,  radius: 5, title: "Storm Surge",      type: "surge" },
    { id: "volt-relay",    mapId: "volt-route",   x: 21, y: 13, radius: 5, title: "Relay Hum",        type: "roaming" },
  ],
  "stone-route": [
    { id: "stone-quarry",  mapId: "stone-route",  x: 11, y: 9,  radius: 5, title: "Quarry Ambush",    type: "ambush" },
    { id: "stone-vein",    mapId: "stone-route",  x: 22, y: 13, radius: 5, title: "Iron Vein Watch",  type: "roaming" },
  ],
  "phantom-route": [
    { id: "phantom-veil",  mapId: "phantom-route", x: 10, y: 10, radius: 6, title: "Veil Whisper",     type: "roaming" },
    { id: "phantom-mire",  mapId: "phantom-route", x: 21, y: 12, radius: 5, title: "Mire Pull",        type: "ambush" },
  ],
  "iron-route": [
    { id: "iron-gate",     mapId: "iron-route",   x: 9,  y: 10, radius: 5, title: "Foundry Gate",     type: "ambush" },
    { id: "iron-coil",     mapId: "iron-route",   x: 22, y: 14, radius: 5, title: "Coil Drift",       type: "surge" },
  ],
  "draco-route": [
    { id: "draco-peak",    mapId: "draco-route",  x: 12, y: 8,  radius: 6, title: "Peak Stand",       type: "ambush" },
    { id: "draco-rift",    mapId: "draco-route",  x: 22, y: 14, radius: 6, title: "Starfall Rift",    type: "roaming" },
  ],
};

// Roaming/ambush species pools — drawn from each route's ENCOUNTER_TABLES base
// forms, with the rarer picks weighted toward roaming.
const ROAMING_POOLS = {
  "bloom-route":   ["dreambud", "seedrift", "glimp"],
  "ember-route":   ["embrock", "cindercap", "fennorange"],
  "tidal-route":   ["glowtent", "glimfin", "tidespine"],
  "volt-route":    ["luxtrik", "voltide", "shardling"],
  "stone-route":   ["lithokrysm", "coalette", "berkest"],
  "phantom-route": ["wraithtide", "darkone", "nerohat"],
  "iron-route":    ["rivetalon", "scraphog", "alloylark"],
  "draco-route":   ["serpyre", "rexaloft", "glacifang"],
};

const AMBUSH_POOLS = {
  "bloom-route":   ["mossling", "bramblecub", "bloomduck"],
  "ember-route":   ["flampling", "wickling", "pebfist"],
  "tidal-route":   ["brookrawl", "mudbub", "slushpup"],
  "volt-route":    ["ampmite", "stormchick", "gustuff"],
  "stone-route":   ["pebblit", "embrock", "pebfist"],
  "phantom-route": ["nettlewisp", "murkrat", "hexroach"],
  "iron-route":    ["grubolt", "coldplate", "shardling"],
  "draco-route":   ["scalewisp", "tidalfang", "budwing"],
};

// Raid pools — 4 late-game routes each host a rotating epic/legendary boss.
const RAID_TEMPLATES = [
  {
    id: "raid-tideglass",
    zoneId: "tidal-route",
    mapId: "tidal-route",
    x: 15, y: 10, radius: 8,
    bossPool: ["tidespine", "glowtent", "glimfin"],
    recommendedLevel: 18,
    tierLabel: "Epic Breaker",
  },
  {
    id: "raid-stonehearth",
    zoneId: "stone-route",
    mapId: "stone-route",
    x: 15, y: 10, radius: 8,
    bossPool: ["lithokrysm", "coalette", "berkest"],
    recommendedLevel: 24,
    tierLabel: "Stone Epic",
  },
  {
    id: "raid-veilcrown",
    zoneId: "phantom-route",
    mapId: "phantom-route",
    x: 15, y: 10, radius: 8,
    bossPool: ["wraithtide", "darkone", "nerohat"],
    recommendedLevel: 28,
    tierLabel: "Veil Crown",
  },
  {
    id: "raid-dracozenith",
    zoneId: "draco-route",
    mapId: "draco-route",
    x: 15, y: 10, radius: 9,
    bossPool: ["serpyre", "rexaloft", "glacifang"],
    recommendedLevel: 34,
    tierLabel: "Draco Zenith",
  },
];

// ── Time-window helpers ────────────────────────────────────────────────────────
function toUtcDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value);
}

function floorWindow(date, minutes) {
  const utc = toUtcDate(date);
  const windowMs = minutes * 60 * 1000;
  return new Date(Math.floor(utc.getTime() / windowMs) * windowMs);
}

function nextWindow(date, minutes) {
  return new Date(floorWindow(date, minutes).getTime() + minutes * 60 * 1000);
}

function hashSeed(input) {
  const raw = String(input || "");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickOne(list, seed) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[seed % list.length];
}

// ── World state builders ───────────────────────────────────────────────────────
function buildFeaturedZones(now = new Date()) {
  const windowStart = floorWindow(now, 15);
  const seed = hashSeed(`zones:${windowStart.toISOString()}`);
  const earlyMid = ZONE_ORDER.filter(zoneId => ["early", "mid"].includes(ZONE_TIERS[zoneId]));
  const late = ZONE_ORDER.filter(zoneId => ZONE_TIERS[zoneId] === "late");
  const chosen = [
    pickOne(earlyMid, seed),
    pickOne(late, Math.floor(seed / 3) + 11),
  ].filter(Boolean);

  return chosen.map((zoneId, index) => {
    const hotspotTemplates = HOTSPOT_TEMPLATES[zoneId] || [];
    const hotspot = hotspotTemplates.length
      ? hotspotTemplates[(seed + index) % hotspotTemplates.length]
      : null;
    return {
      zoneId,
      label: ZONE_LABELS[zoneId] || zoneId,
      threatLevel: ((seed + (index * 7)) % 3) + 1,
      hotspot: hotspot ? {
        ...hotspot,
        eventId: `hotspot:${zoneId}:${windowStart.toISOString()}`,
        zoneId,
        endsAt: nextWindow(now, 15).toISOString(),
      } : null,
    };
  });
}

function buildRoamingRare(now = new Date(), featuredZones = buildFeaturedZones(now)) {
  const roamingWindow = floorWindow(now, 10);
  const seed = hashSeed(`roaming:${roamingWindow.toISOString()}`);
  const baseZone = featuredZones.find(entry => entry.hotspot?.type === "roaming") || featuredZones[0];
  if (!baseZone?.hotspot) return null;
  const speciesPool = ROAMING_POOLS[baseZone.zoneId] || [];
  const speciesId = pickOne(speciesPool, seed);
  if (!speciesId) return null;
  return {
    eventId: `roaming:${baseZone.zoneId}:${roamingWindow.toISOString()}`,
    zoneId: baseZone.zoneId,
    label: `${ZONE_LABELS[baseZone.zoneId] || baseZone.zoneId} Sighting`,
    speciesId,
    mapId: baseZone.hotspot.mapId,
    x: baseZone.hotspot.x,
    y: baseZone.hotspot.y,
    radius: Math.max(4, baseZone.hotspot.radius - 1),
    threatLevel: baseZone.threatLevel,
    startsAt: roamingWindow.toISOString(),
    endsAt: nextWindow(now, 10).toISOString(),
  };
}

function buildActiveRaids(now = new Date()) {
  const raidWindow = floorWindow(now, 60);
  const seed = hashSeed(`raid:${raidWindow.toISOString()}`);
  const raidTemplate = pickOne(RAID_TEMPLATES, seed);
  if (!raidTemplate) return [];
  const speciesId = pickOne(raidTemplate.bossPool, Math.floor(seed / 5) + 7);
  return [{
    eventId: `raid:${raidTemplate.id}:${raidWindow.toISOString()}`,
    templateId: raidTemplate.id,
    zoneId: raidTemplate.zoneId,
    label: `${raidTemplate.tierLabel}`,
    speciesId,
    rarity: raidTemplate.zoneId === "draco-route" ? "legendary" : "epic",
    mapId: raidTemplate.mapId,
    x: raidTemplate.x,
    y: raidTemplate.y,
    radius: raidTemplate.radius,
    maxPlayers: 4,
    recommendedLevel: raidTemplate.recommendedLevel,
    lobbyOpensAt: raidWindow.toISOString(),
    endsAt: nextWindow(now, 60).toISOString(),
  }];
}

function getExplorationWorldState(now = new Date()) {
  const featuredZones = buildFeaturedZones(now);
  const hotspots = featuredZones.map(entry => entry.hotspot).filter(Boolean);
  const roamingRare = buildRoamingRare(now, featuredZones);
  const activeRaids = buildActiveRaids(now);
  return {
    generatedAt: toUtcDate(now).toISOString(),
    featuredZones,
    hotspots,
    roamingRare,
    activeRaids,
    nextWorldRotationAt: nextWindow(now, 15).toISOString(),
    nextRaidRotationAt: nextWindow(now, 60).toISOString(),
  };
}

// ── Per-player exploration state ───────────────────────────────────────────────
function ensureExplorationState(player) {
  player.liveOps = player.liveOps && typeof player.liveOps === "object" ? player.liveOps : {};
  player.liveOps.exploration = player.liveOps.exploration && typeof player.liveOps.exploration === "object"
    ? player.liveOps.exploration
    : {};
  const exploration = player.liveOps.exploration;
  exploration.zoneHeat = exploration.zoneHeat && typeof exploration.zoneHeat === "object" ? exploration.zoneHeat : {};
  exploration.roamingAttempts = exploration.roamingAttempts && typeof exploration.roamingAttempts === "object" ? exploration.roamingAttempts : {};
  exploration.raidCatchSessions = exploration.raidCatchSessions && typeof exploration.raidCatchSessions === "object" ? exploration.raidCatchSessions : {};
  exploration.recentRaidHighlights = Array.isArray(exploration.recentRaidHighlights) ? exploration.recentRaidHighlights : [];
  exploration.counters = exploration.counters && typeof exploration.counters === "object" ? exploration.counters : {};
  return exploration;
}

function getZoneThreat(worldState, zoneId) {
  return worldState?.featuredZones?.find(entry => entry.zoneId === zoneId)?.threatLevel || 0;
}

function getHotspotsForMap(worldState, mapId) {
  if (typeof mapId !== "string") return [];
  return (worldState?.hotspots || []).filter(hotspot => hotspot.mapId === mapId);
}

function getRaidForMap(worldState, mapId) {
  if (typeof mapId !== "string") return null;
  return (worldState?.activeRaids || []).find(raid => raid.mapId === mapId) || null;
}

function getRaidByEventId(worldState, eventId) {
  return (worldState?.activeRaids || []).find(raid => raid.eventId === eventId) || null;
}

function getCurrentZoneId(player) {
  const mapId = player?.mapPosition?.mapId || "bloom-town";
  const x = Number(player?.mapPosition?.x || 0);
  const y = Number(player?.mapPosition?.y || 0);
  return getAreaIdAt(x, y, mapId) || "bloom-town";
}

function buildPlayerExplorationPayload(player, now = new Date()) {
  const worldState = getExplorationWorldState(now);
  const exploration = ensureExplorationState(player);
  const zoneId = getCurrentZoneId(player);
  const currentMapId = player?.mapPosition?.mapId || "bloom-town";
  return {
    worldState,
    featuredZones: worldState.featuredZones,
    currentZoneThreat: getZoneThreat(worldState, zoneId),
    currentZoneHeat: Number(exploration.zoneHeat[zoneId] || 0),
    activeHotspots: getHotspotsForMap(worldState, currentMapId),
    roamingRare: worldState.roamingRare,
    activeRaids: worldState.activeRaids,
    nextWorldRotationAt: worldState.nextWorldRotationAt,
    nextRaidRotationAt: worldState.nextRaidRotationAt,
  };
}

function recordExplorationStep(player, { zoneId, mapId, x, y, isGrass = false } = {}, now = new Date()) {
  const worldState = getExplorationWorldState(now);
  const exploration = ensureExplorationState(player);
  const normalizedZoneId = zoneId || getCurrentZoneId(player);
  const threatLevel = getZoneThreat(worldState, normalizedZoneId);
  const hotspots = getHotspotsForMap(worldState, mapId).filter(hotspot => {
    const dx = Number(hotspot.x || 0) - Number(x || 0);
    const dy = Number(hotspot.y || 0) - Number(y || 0);
    return Math.sqrt((dx * dx) + (dy * dy)) <= Number(hotspot.radius || 0);
  });
  const hotspot = hotspots[0] || null;
  let heat = Number(exploration.zoneHeat[normalizedZoneId] || 0);
  if (isGrass && threatLevel > 0) heat += 1 + threatLevel;
  if (hotspot) heat += hotspot.type === "ambush" ? 8 : 4;
  if (!isGrass && !hotspot) heat = Math.max(0, heat - 5);
  if (isGrass && !hotspot) heat = Math.max(0, heat - 1);
  exploration.zoneHeat[normalizedZoneId] = Math.min(140, Math.max(0, heat));
  exploration.counters.highThreatSteps = Number(exploration.counters.highThreatSteps || 0) + (threatLevel > 0 ? 1 : 0);
  if (hotspot) {
    exploration.counters.hotspotsVisited = Number(exploration.counters.hotspotsVisited || 0) + 1;
  }
  const currentHeat = exploration.zoneHeat[normalizedZoneId];
  const inAmbushHotspot = hotspot?.type === "ambush";
  const ambushThreshold = inAmbushHotspot ? 72 : 96 + (threatLevel * 8);
  const ambushChance = inAmbushHotspot
    ? 0.16 + (threatLevel * 0.04)
    : threatLevel >= 3
      ? 0.06
      : 0.02;
  const shouldTriggerAmbush = isGrass
    && threatLevel > 0
    && currentHeat >= ambushThreshold
    && Math.random() < ambushChance;
  return {
    worldState,
    threatLevel,
    hotspot,
    heat: currentHeat,
    shouldTriggerAmbush,
    ambushType: inAmbushHotspot ? "trainer" : "surge",
  };
}

function resetZoneHeat(player, zoneId) {
  const exploration = ensureExplorationState(player);
  exploration.zoneHeat[zoneId] = 0;
}

function canStartRoamingEncounter(player, roamingEvent) {
  if (!roamingEvent?.eventId) return false;
  const exploration = ensureExplorationState(player);
  const attempts = Number(exploration.roamingAttempts[roamingEvent.eventId] || 0);
  return attempts < 3;
}

function markRoamingEncounter(player, roamingEvent) {
  if (!roamingEvent?.eventId) return 0;
  const exploration = ensureExplorationState(player);
  const nextAttempts = Number(exploration.roamingAttempts[roamingEvent.eventId] || 0) + 1;
  exploration.roamingAttempts[roamingEvent.eventId] = nextAttempts;
  exploration.counters.roamingFinds = Number(exploration.counters.roamingFinds || 0) + 1;
  return nextAttempts;
}

function grantRaidCatchSession(player, raidEvent, now = new Date()) {
  if (!raidEvent?.eventId || !raidEvent?.speciesId) return null;
  const exploration = ensureExplorationState(player);
  exploration.raidCatchSessions[raidEvent.eventId] = {
    eventId: raidEvent.eventId,
    speciesId: raidEvent.speciesId,
    rarity: raidEvent.rarity,
    throwsRemaining: 3,
    resolved: false,
    unlockedAt: toUtcDate(now).toISOString(),
  };
  exploration.counters.raidWins = Number(exploration.counters.raidWins || 0) + 1;
  exploration.recentRaidHighlights = [{
    eventId: raidEvent.eventId,
    speciesId: raidEvent.speciesId,
    rarity: raidEvent.rarity,
    happenedAt: toUtcDate(now).toISOString(),
  }, ...exploration.recentRaidHighlights].slice(0, 5);
  return exploration.raidCatchSessions[raidEvent.eventId];
}

function getRaidCatchSession(player, eventId) {
  const exploration = ensureExplorationState(player);
  return exploration.raidCatchSessions[eventId] || null;
}

function consumeRaidCatchThrow(player, eventId) {
  const session = getRaidCatchSession(player, eventId);
  if (!session || session.resolved) return null;
  session.throwsRemaining = Math.max(0, Number(session.throwsRemaining || 0) - 1);
  if (session.throwsRemaining <= 0) session.resolved = true;
  return session;
}

function markRaidCatchResolved(player, eventId, caught = false) {
  const session = getRaidCatchSession(player, eventId);
  if (!session) return null;
  session.resolved = true;
  session.caught = Boolean(caught);
  return session;
}

function buildThreatEncounterConfig(zoneId, threatLevel, worldState, now = new Date()) {
  const pool = AMBUSH_POOLS[zoneId] || ROAMING_POOLS[zoneId] || ["mossling"];
  const seed = hashSeed(`ambush:${zoneId}:${floorWindow(now, 15).toISOString()}`);
  const teamSize = Math.min(3, Math.max(1, threatLevel));
  const team = Array.from({ length: teamSize }, (_, index) => ({
    speciesId: pool[(seed + index) % pool.length],
    level: 8 + (threatLevel * 4) + (index * 2),
    nickname: `Threat ${index + 1}`,
  }));
  const eventId = `ambush:${zoneId}:${floorWindow(now, 15).toISOString()}`;
  return {
    title: threatLevel >= 3 ? "Veil Raid Captain" : "Frontier Ambush",
    rewardMoney: 180 + (threatLevel * 120),
    team,
    zoneId,
    interactionId: null,
    eventId,
    activeEventId: worldState?.featuredZones?.find(entry => entry.zoneId === zoneId)?.hotspot?.eventId || null,
  };
}

module.exports = {
  ZONE_LABELS,
  getExplorationWorldState,
  ensureExplorationState,
  buildPlayerExplorationPayload,
  getZoneThreat,
  getHotspotsForMap,
  getRaidForMap,
  getRaidByEventId,
  recordExplorationStep,
  resetZoneHeat,
  canStartRoamingEncounter,
  markRoamingEncounter,
  grantRaidCatchSession,
  getRaidCatchSession,
  consumeRaidCatchThrow,
  markRaidCatchResolved,
  buildThreatEncounterConfig,
};
