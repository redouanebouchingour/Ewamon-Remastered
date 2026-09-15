"use strict";
/**
 * Quest board — chapter-based progression keyed to the TMJ overworld.
 *
 * Rebuilt May 2026 for the new map set. The old Kanto/Johto quest chain
 * (mentor_elia / orchard_keeper / veil_lieutenant_koss / sovereign_mael / …)
 * is gone because those NPCs no longer exist — mapInteractions.js is an
 * empty stub since the rewrite. Objectives now advance on reaching a new
 * map (`zoneId` matches `mapPosition.mapId`) or hitting a species count
 * milestone. When NPC/trainer markers come back to the .tmj objects layer,
 * interaction/trainer objectives can be re-added per quest.
 */

const QUEST_ORDER = [
  "ch1_bloom_call",
  "ch2_ember_climb",
  "ch3_tide_turn",
  "ch4_volt_relay",
  "ch5_stone_pass",
  "ch6_phantom_veil",
  "ch7_iron_forge",
  "ch8_draco_zenith",
];

const QUESTS = {
  ch1_bloom_call: {
    id: "ch1_bloom_call",
    title: "Ch.1 — Bloom Call",
    summary: "Welcome to Bloom Town. Step into the meadow, find a partner, and start your dex.",
    reward: { money: 1500, items: { potion: 5, crest_orb: 3 } },
    objectives: [
      { id: "reach_bloom_route",   label: "Reach Bloom Route",        zoneId: "bloom-route" },
      { id: "catch_three_species", label: "Catch 3 Ewamon species",   requiredCount: 3 },
    ],
  },
  ch2_ember_climb: {
    id: "ch2_ember_climb",
    title: "Ch.2 — Ember Climb",
    summary: "Heat rises off Ember Route. Toughen up your team before the volcanic foothills swallow them whole.",
    reward: { money: 2200, items: { revive: 2, crest_orb: 3 } },
    objectives: [
      { id: "reach_ember_town",    label: "Reach Ember Town",         zoneId: "ember-town" },
      { id: "reach_ember_route",   label: "Reach Ember Route",        zoneId: "ember-route" },
      { id: "catch_five_species",  label: "Catch 5 Ewamon species",   requiredCount: 5 },
    ],
  },
  ch3_tide_turn: {
    id: "ch3_tide_turn",
    title: "Ch.3 — Tide Turn",
    summary: "The coast hides clues. Push into Tidal Route — the breakers don't wait.",
    reward: { money: 3000, items: { revive: 1, prism_orb: 3 } },
    objectives: [
      { id: "reach_tidal_town",    label: "Reach Tidal Town",         zoneId: "tidal-town" },
      { id: "reach_tidal_route",   label: "Reach Tidal Route",        zoneId: "tidal-route" },
      { id: "catch_eight_species", label: "Catch 8 Ewamon species",   requiredCount: 8 },
    ],
  },
  ch4_volt_relay: {
    id: "ch4_volt_relay",
    title: "Ch.4 — Volt Relay",
    summary: "Storm plains crackle on Volt Route. Tap the relay grid and ride the front.",
    reward: { money: 3500, items: { superpotion: 3, crest_orb: 2 } },
    objectives: [
      { id: "reach_volt_town",     label: "Reach Volt Town",          zoneId: "volt-town" },
      { id: "reach_volt_route",    label: "Reach Volt Route",         zoneId: "volt-route" },
      { id: "catch_twelve_species", label: "Catch 12 Ewamon species", requiredCount: 12 },
    ],
  },
  ch5_stone_pass: {
    id: "ch5_stone_pass",
    title: "Ch.5 — Stone Pass",
    summary: "Stone Route's quarries hide rare ore — and rarer creatures. Press inland.",
    reward: { money: 4500, items: { prism_orb: 3, rarecandy: 1 } },
    objectives: [
      { id: "reach_stone_town",    label: "Reach Stone Town",         zoneId: "stone-town" },
      { id: "reach_stone_route",   label: "Reach Stone Route",        zoneId: "stone-route" },
      { id: "catch_sixteen_species", label: "Catch 16 Ewamon species", requiredCount: 16 },
    ],
  },
  ch6_phantom_veil: {
    id: "ch6_phantom_veil",
    title: "Ch.6 — Phantom Veil",
    summary: "Whispers crawl under Phantom Route's canopy. Stay close to the lanterns.",
    reward: { money: 6000, items: { rarecandy: 2, prism_orb: 3 } },
    objectives: [
      { id: "reach_phantom_town",  label: "Reach Phantom Town",       zoneId: "phantom-town" },
      { id: "reach_phantom_route", label: "Reach Phantom Route",      zoneId: "phantom-route" },
      { id: "catch_twenty_species", label: "Catch 20 Ewamon species", requiredCount: 20 },
    ],
  },
  ch7_iron_forge: {
    id: "ch7_iron_forge",
    title: "Ch.7 — Iron Forge",
    summary: "The foundry gates of Iron Route still glow. Cut through the smoke.",
    reward: { money: 10000, items: { aether_orb: 1, prism_orb: 5 } },
    objectives: [
      { id: "reach_iron_town",     label: "Reach Iron Town",          zoneId: "iron-town" },
      { id: "reach_iron_route",    label: "Reach Iron Route",         zoneId: "iron-route" },
      { id: "catch_twentyfour_species", label: "Catch 24 Ewamon species", requiredCount: 24 },
    ],
  },
  ch8_draco_zenith: {
    id: "ch8_draco_zenith",
    title: "Ch.8 — Draco Zenith",
    summary: "Vanguard Arena waits past Draco Route. Cross the peak, claim the crown.",
    reward: { money: 18000, items: { aether_orb: 1, rarecandy: 3, prism_orb: 5 } },
    objectives: [
      { id: "reach_draco_town",      label: "Reach Draco Town",       zoneId: "draco-town" },
      { id: "reach_draco_route",     label: "Reach Draco Route",      zoneId: "draco-route" },
      { id: "reach_vanguard_arena",  label: "Reach Vanguard Arena",   zoneId: "vanguard-arena" },
      { id: "catch_twentyeight_species", label: "Catch 28 Ewamon species", requiredCount: 28 },
    ],
  },
};

// NPC/trainer maps stay empty until live world markers come back. Keeping the
// exports prevents callers (e.g. battle resolution) from crashing on import.
const INTERACTION_OBJECTIVES = {};
const TRAINER_OBJECTIVES = {};

// Species-count milestone → objective id. Used by `updateQuestDerivedObjectives`.
const SPECIES_COUNT_OBJECTIVES = [
  { threshold: 3,  objectiveId: "catch_three_species" },
  { threshold: 5,  objectiveId: "catch_five_species" },
  { threshold: 8,  objectiveId: "catch_eight_species" },
  { threshold: 12, objectiveId: "catch_twelve_species" },
  { threshold: 16, objectiveId: "catch_sixteen_species" },
  { threshold: 20, objectiveId: "catch_twenty_species" },
  { threshold: 24, objectiveId: "catch_twentyfour_species" },
  { threshold: 28, objectiveId: "catch_twentyeight_species" },
];

function getQuestDefinition(questId) {
  return QUESTS[questId] || null;
}

function getNextQuestId(questId) {
  const index = QUEST_ORDER.indexOf(questId);
  if (index === -1) return null;
  return QUEST_ORDER[index + 1] || null;
}

function ensureQuestState(player) {
  if (!player.questState) {
    player.questState = {
      activeQuestId: QUEST_ORDER[0],
      completedQuestIds: [],
      objectives: {},
      rewardClaims: [],
      updatedAt: new Date(),
    };
  }
  if (!player.questState.objectives) player.questState.objectives = {};
  if (!player.questState.completedQuestIds) player.questState.completedQuestIds = [];
  if (!player.questState.rewardClaims) player.questState.rewardClaims = [];
  if (!player.questState.activeQuestId) player.questState.activeQuestId = QUEST_ORDER[0];
  syncActiveQuest(player);
  return player.questState;
}

function listIncludes(list, value) {
  if (!list) return false;
  if (Array.isArray(list)) return list.includes(value);
  if (typeof list.includes === "function") return list.includes(value);
  return false;
}

function syncActiveQuest(player) {
  const questState = player.questState || {};
  if (!questState.rewardClaims) questState.rewardClaims = [];
  if (!questState.completedQuestIds) questState.completedQuestIds = [];
  if (!questState.objectives) questState.objectives = {};
  let activeQuestId = questState.activeQuestId || QUEST_ORDER[0];

  // If the stored activeQuestId is not in the new QUEST_ORDER, start from Ch.1
  if (!QUEST_ORDER.includes(activeQuestId) && !listIncludes(questState.rewardClaims, activeQuestId)) {
    activeQuestId = QUEST_ORDER[0];
  }

  while (activeQuestId && listIncludes(questState.rewardClaims, activeQuestId)) {
    activeQuestId = getNextQuestId(activeQuestId);
  }

  questState.activeQuestId = activeQuestId || QUEST_ORDER[QUEST_ORDER.length - 1];
  return questState.activeQuestId;
}

function objectiveValue(objectives, key) {
  if (!objectives) return false;
  if (objectives instanceof Map) return Boolean(objectives.get(key));
  return Boolean(objectives[key]);
}

function setObjective(objectives, key, value = true) {
  if (objectives instanceof Map) {
    objectives.set(key, Boolean(value));
    return;
  }
  objectives[key] = Boolean(value);
}

function objectiveCompleted(player, objectiveId) {
  return objectiveValue(ensureQuestState(player).objectives, objectiveId);
}

function markObjective(player, objectiveId) {
  const questState = ensureQuestState(player);
  const before = objectiveCompleted(player, objectiveId);
  setObjective(questState.objectives, objectiveId, true);
  questState.updatedAt = new Date();
  return !before;
}

function markInteractionObjective(player, interactionId) {
  const objectiveId = INTERACTION_OBJECTIVES[interactionId];
  return objectiveId ? markObjective(player, objectiveId) : false;
}

function markTrainerObjective(player, interactionId) {
  const objectiveId = TRAINER_OBJECTIVES[interactionId];
  return objectiveId ? markObjective(player, objectiveId) : false;
}

function markZoneObjective(player, zoneId) {
  // Sweep the active quest's objectives for any matching `zoneId`. A quest
  // can re-use a zone trigger across chapters (e.g. revisits).
  let any = false;
  const activeQuestId = ensureQuestState(player).activeQuestId;
  const quest = getQuestDefinition(activeQuestId);
  if (quest) {
    for (const obj of quest.objectives) {
      if (obj.zoneId === zoneId && markObjective(player, obj.id)) any = true;
    }
  }
  return any;
}

function updateQuestDerivedObjectives(player) {
  const questState = ensureQuestState(player);
  const collectionCount = player.collection?.length || 0;

  for (const { threshold, objectiveId } of SPECIES_COUNT_OBJECTIVES) {
    if (collectionCount >= threshold) setObjective(questState.objectives, objectiveId, true);
  }

  return questState;
}

function isQuestComplete(player, questId = ensureQuestState(player).activeQuestId) {
  const quest = getQuestDefinition(questId);
  if (!quest) return false;
  return quest.objectives.every(objective => objectiveCompleted(player, objective.id));
}

function completeQuest(player, questId = ensureQuestState(player).activeQuestId) {
  const questState = ensureQuestState(player);
  if (!questState.completedQuestIds.includes(questId)) {
    questState.completedQuestIds.push(questId);
  }
  questState.updatedAt = new Date();
}

function rewardAlreadyClaimed(player, questId) {
  const rewardClaims = player?.questState?.rewardClaims;
  return listIncludes(rewardClaims, questId);
}

function claimQuestReward(player, questId) {
  const quest = getQuestDefinition(questId);
  if (!quest || rewardAlreadyClaimed(player, questId)) return null;

  const inventory = player.inventory instanceof Map
    ? player.inventory
    : new Map(Object.entries(player.inventory || {}));

  player.money = (player.money || 0) + (quest.reward.money || 0);
  for (const [itemId, quantity] of Object.entries(quest.reward.items || {})) {
    inventory.set(itemId, (inventory.get(itemId) || 0) + quantity);
  }
  player.inventory = inventory;

  const questState = ensureQuestState(player);
  questState.rewardClaims.push(questId);
  questState.updatedAt = new Date();
  if (questState.activeQuestId === questId) {
    const nextQuestId = getNextQuestId(questId);
    if (nextQuestId) questState.activeQuestId = nextQuestId;
  }
  syncActiveQuest(player);
  return quest.reward;
}

function buildQuestBoard(player) {
  const questState = ensureQuestState(player);
  const activeQuestId = questState.activeQuestId;
  const activeIndex = Math.max(0, QUEST_ORDER.indexOf(activeQuestId));

  return QUEST_ORDER.map((questId, index) => {
    const quest = getQuestDefinition(questId);
    const completed = isQuestComplete(player, quest.id);
    const rewardClaimed = rewardAlreadyClaimed(player, quest.id);
    const locked = index > activeIndex && !rewardClaimed && quest.id !== activeQuestId;
    const active = quest.id === activeQuestId;
    const objectives = quest.objectives.map(objective => ({
      id: objective.id,
      label: objective.label,
      completed: objectiveCompleted(player, objective.id),
      targetInteractionId: objective.targetInteractionId || null,
      zoneId: objective.zoneId || null,
      requiredCount: objective.requiredCount || null,
    }));
    const currentObjective = active
      ? objectives.find(objective => !objective.completed) || null
      : null;

    return {
      id: quest.id,
      title: quest.title,
      summary: quest.summary,
      active,
      locked,
      completed,
      rewardClaimed,
      reward: quest.reward,
      currentObjective,
      objectives,
    };
  });
}

module.exports = {
  QUEST_ORDER,
  QUESTS,
  buildQuestBoard,
  claimQuestReward,
  completeQuest,
  ensureQuestState,
  getQuestDefinition,
  isQuestComplete,
  markInteractionObjective,
  markObjective,
  markTrainerObjective,
  markZoneObjective,
  rewardAlreadyClaimed,
  syncActiveQuest,
  updateQuestDerivedObjectives,
};
