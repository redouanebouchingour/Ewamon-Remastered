const { v4: uuidv4 } = require("uuid");
const Player = require("../models/Player");
const Battle = require("../models/Battle");
const { socketAuth } = require("../middleware/auth");
const { createSocketLimiter } = require("../utils/socketRateLimit");

const battleLimiter = createSocketLimiter();
const { markOnline, markOffline } = require("./onlinePresence");
const { buildLeagueState } = require("../data/league");
const { calcDamage, createEwamonInstance, EWAMON_SPECIES, calcStat, calcMaxHp, MOVES, TYPE_CHART, ABILITIES, ITEMS } = require("../data/ewamon");
const { distributeExpAndEvolve } = require("../utils/expUtils");
const { applyAbilityDamageModifiers, applyHeldItemDamageModifiers, getBuffedStats, abilityBlocksStatus, getAbilityAbsorb, applyContactAbility, applySpeedBoost, applyRegenerator, wonderGuardBlocks, getHeldItemHealAmount } = require("../utils/teamBuildingUtils");
const { addStatus, removeStatus, hasStatus, hasAnyMajor, getMajorStatus, getStatuses } = require("../utils/statusUtils");
const {
  normalizePvpRank,
  getPlayerRating,
  calculateRankedBattleResult,
  applyRankDelta,
  buildRankChangeSummary,
} = require("../utils/rankUtils");
const {
  ensureLiveOpsState,
  applyLiveOpsEvent,
  buildCompactLiveOpsSummary,
  getActiveWeeklyCup,
  validateCupParty,
} = require("../utils/liveOps");

const battleRooms = new Map();    // roomId → BattleRoom
const matchmakingQueues = {
  standard: [],
  flat50: [],
  ranked: [],
  cup: [],
};
const playerToBattle = new Map(); // playerId → roomId  (reconnection)
const MATCHMAKING_TIMEOUT_MS = 90_000;
const PVP_MODES = {
  standard: { id: "standard", label: "Standard" },
  flat50: { id: "flat50", label: "Level 50 Cup", forceLevel: 50 },
  ranked: { id: "ranked", label: "Ranked Level 50", forceLevel: 50, ranked: true },
  cup: { id: "cup", label: "Weekly Cup", forceLevel: 50, cup: true },
};

// ── Status effect end-of-turn damage ─────────────────────────────────────────
function applyEndOfTurnStatus(ewamon, events, label) {
  // Multiple statuses can stack — apply each one's end-of-turn effect.
  if (hasStatus(ewamon, "burn")) {
    const dmg = Math.max(1, Math.floor(ewamon.maxHp / 16));
    ewamon.hp = Math.max(0, ewamon.hp - dmg);
    events.push({ type: "status", target: label, targetSlot: label, damage: dmg, targetHp: ewamon.hp, statusType: "burn", msg: `${ewamon.nickname} is hurt by its burn! (${dmg})` });
    if (ewamon.hp <= 0) return true;
  }
  if (hasStatus(ewamon, "poison")) {
    const dmg = Math.max(1, Math.floor(ewamon.maxHp / 8));
    ewamon.hp = Math.max(0, ewamon.hp - dmg);
    events.push({ type: "status", target: label, targetSlot: label, damage: dmg, targetHp: ewamon.hp, statusType: "poison", msg: `${ewamon.nickname} is hurt by poison! (${dmg})` });
    if (ewamon.hp <= 0) return true;
  }
  return false;
}

// Returns true if the Ewamon can't act this turn
function handlePreMoveEffects(ewamon, events, slot) {
  if (hasStatus(ewamon, "sleep")) {
    if ((ewamon._sleepTurns || 0) > 0) {
      ewamon._sleepTurns--;
      events.push({ type: "effect", effectType: "sleep", targetSlot: slot, msg: `${ewamon.nickname} is fast asleep!` });
      return true;
    }
    removeStatus(ewamon, "sleep");
    events.push({ type: "effect", effectType: "wake", targetSlot: slot, msg: `${ewamon.nickname} woke up!` });
  }
  if (ewamon._flinched) {
    ewamon._flinched = false;
    events.push({ type: "effect", effectType: "flinch", targetSlot: slot, msg: `${ewamon.nickname} flinched and couldn't move!` });
    return true;
  }
  if (hasStatus(ewamon, "paralyze") && Math.random() < 0.25) {
    events.push({ type: "effect", effectType: "paralyze_lock", targetSlot: slot, msg: `${ewamon.nickname} is paralyzed and can't move!` });
    return true;
  }
  if (hasStatus(ewamon, "freeze")) {
    if (Math.random() < 0.2) {
      removeStatus(ewamon, "freeze");
      events.push({ type: "effect", effectType: "thaw", targetSlot: slot, msg: `${ewamon.nickname} thawed out!` });
    } else {
      events.push({ type: "effect", effectType: "freeze", targetSlot: slot, msg: `${ewamon.nickname} is frozen solid!` });
      return true;
    }
  }
  if (ewamon._confused) {
    ewamon._confuseTurns = (ewamon._confuseTurns || 1) - 1;
    if (ewamon._confuseTurns <= 0) {
      ewamon._confused = false;
      events.push({ type: "effect", effectType: "confusion_end", targetSlot: slot, msg: `${ewamon.nickname} snapped out of confusion!` });
    } else if (Math.random() < 0.33) {
      const dmg = Math.max(1, Math.floor(ewamon.maxHp / 8));
      ewamon.hp = Math.max(0, ewamon.hp - dmg);
      events.push({ type: "effect", effectType: "confusion_self_hit", targetSlot: slot, damage: dmg, targetHp: ewamon.hp, msg: `${ewamon.nickname} hurt itself in confusion! (${dmg})` });
      return ewamon.hp <= 0;
    }
  }
  return false;
}

// Normalise Mongoose Map pp → plain JS object so it serialises correctly over socket.io
const normPp = pp => pp instanceof Map ? Object.fromEntries(pp) : (pp || {});
function normalizeEwamon(e) {
  const obj = e.toObject ? e.toObject() : { ...e };
  obj.pp = normPp(obj.pp);
  return obj;
}

function scaleEwamonForMode(ewamon, modeId) {
  const mode = PVP_MODES[modeId];
  const base = normalizeEwamon(ewamon);
  if (!mode?.forceLevel) return base;

  const species = EWAMON_SPECIES[base.speciesId];
  if (!species) return base;

  const previousMaxHp = Math.max(1, base.maxHp || 1);
  const hpRatio = Math.max(0, Math.min(1, (base.hp ?? previousMaxHp) / previousMaxHp));
  const scaledMaxHp = calcMaxHp(species.baseHp, mode.forceLevel);

  return {
    ...base,
    level: mode.forceLevel,
    maxHp: scaledMaxHp,
    hp: hpRatio === 0 ? 0 : Math.max(1, Math.min(scaledMaxHp, Math.round(scaledMaxHp * hpRatio))),
    atk: calcStat(species.baseAtk, mode.forceLevel),
    def: calcStat(species.baseDef, mode.forceLevel),
    spd: calcStat(species.baseSpd, mode.forceLevel),
    expToNext: mode.forceLevel * 100,
  };
}

function applyMoveEffect(effect, attacker, defender, events, attackerSlot, defenderSlot) {
  if (!effect) return;
  const roll = Math.random();
  switch (effect) {
    case "poison":
      if (roll < 0.7 && !abilityBlocksStatus(defender.selectedAbility, "poison") && addStatus(defender, "poison")) {
        events.push({ type: "effect", effectType: "poison", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "poison", msg: `${defender.nickname} was poisoned!` });
      } else if (defender.selectedAbility === "Immunity") {
        events.push({ type: "effect", effectType: "ability_block", sourceSlot: defenderSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s Immunity ability prevented poison!` });
      }
      break;
    case "burn":
      if (roll < 0.7 && !abilityBlocksStatus(defender.selectedAbility, "burn") && addStatus(defender, "burn")) {
        events.push({ type: "effect", effectType: "burn", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "burn", msg: `${defender.nickname} was burned!` });
      }
      break;
    case "paralyze":
      if (roll < 0.7 && !abilityBlocksStatus(defender.selectedAbility, "paralyze") && addStatus(defender, "paralyze")) {
        events.push({ type: "effect", effectType: "paralyze", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "paralyze", msg: `${defender.nickname} was paralyzed!` });
      }
      break;
    case "sleep":
      if (roll < 0.5 && !abilityBlocksStatus(defender.selectedAbility, "sleep") && addStatus(defender, "sleep")) {
        defender._sleepTurns = 1 + Math.floor(Math.random() * 3);
        events.push({ type: "effect", effectType: "sleep", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "sleep", msg: `${defender.nickname} fell asleep!` });
      }
      break;
    case "freeze":
      if (roll < 0.3 && !abilityBlocksStatus(defender.selectedAbility, "freeze") && addStatus(defender, "freeze")) {
        events.push({ type: "effect", effectType: "freeze", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "freeze", msg: `${defender.nickname} was frozen!` });
      }
      break;
    case "flinch":    defender._flinched = true; break;
    case "confuse":   if (!defender._confused && roll < 0.6) { defender._confused = true; defender._confuseTurns = 2 + Math.floor(Math.random() * 3); events.push({ type: "effect", effectType: "confuse", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname} became confused!` }); } break;
    case "lower_atk": attacker.atk = Math.max(1, Math.floor(attacker.atk * 0.8)); events.push({ type: "effect", effectType: "lower_atk", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s attack fell!` }); break;
    case "raise_def": attacker.def = Math.floor(attacker.def * 1.5); events.push({ type: "effect", effectType: "raise_def", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s defense rose!` }); break;
    case "lower_def": defender.def = Math.max(1, Math.floor(defender.def * 0.8)); events.push({ type: "effect", effectType: "lower_def", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s defense fell!` }); break;
    case "raise_atk": attacker.atk = Math.floor(attacker.atk * 1.5); events.push({ type: "effect", effectType: "raise_atk", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s attack rose!` }); break;
    case "raise_spd": attacker.spd = Math.floor(attacker.spd * 1.5); events.push({ type: "effect", effectType: "raise_spd", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s speed rose!` }); break;
    case "lower_spd": defender.spd = Math.max(1, Math.floor(defender.spd * 0.8)); events.push({ type: "effect", effectType: "lower_spd", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s speed fell!` }); break;
    default: break;
  }
}

function getEffectivenessMultiplier(moveType, defenderSpeciesId) {
  const defenderTypes = EWAMON_SPECIES[defenderSpeciesId]?.type || ["Normal"];
  return defenderTypes.reduce((mult, defenderType) => mult * (TYPE_CHART[moveType]?.[defenderType] ?? 1), 1);
}

function describeEffectiveness(multiplier) {
  if (multiplier === 0) return "No effect";
  if (multiplier >= 4) return "Devastating";
  if (multiplier >= 2) return "Super effective";
  if (multiplier <= 0.25) return "Barely effective";
  if (multiplier < 1) return "Not very effective";
  return "Neutral";
}

function buildSpeedHint(firstActor, secondActor, reason = "speed") {
  if (!firstActor || !secondActor) return null;
  if (reason === "priority") {
    return `${firstActor.ewamon.nickname} moved first on priority.`;
  }
  const speedGap = Math.abs((firstActor.ewamon?.spd || 0) - (secondActor.ewamon?.spd || 0));
  if (speedGap <= 0) {
    return `${firstActor.ewamon.nickname} won the speed tie.`;
  }
  return `${firstActor.ewamon.nickname} moved first with ${speedGap} more Speed.`;
}

function sanitizeRoom(room) {
  const sanitizeSlot = s => ({
    username: s.username,
    ewamon: { ...s.ewamon, pp: normPp(s.ewamon.pp) },
    activeIndex: s.activeIndex,
    pvpRank: normalizePvpRank(s.pvpRank),
    trainerIdentity: s.trainerIdentity || null,
    party: s.party.map(e => ({ speciesId: e.speciesId, nickname: e.nickname, hp: e.hp, maxHp: e.maxHp, level: e.level, status: e.status, moves: e.moves, pp: normPp(e.pp) })),
  });
  return {
    roomId: room.roomId,
    turn: room.turn,
    mode: room.mode || "standard",
    ruleSetId: room.ruleSetId || null,
    cup: room.cup || null,
    awaitingSwitch: room.awaitingSwitch,
    player1: sanitizeSlot(room.player1),
    player2: sanitizeSlot(room.player2),
  };
}

function getSlots(room, playerId) {
  const isP1 = room.player1.playerId.toString() === playerId.toString();
  return { isP1, mySlot: isP1 ? "p1" : "p2", oppSlot: isP1 ? "p2" : "p1", myData: isP1 ? room.player1 : room.player2, oppData: isP1 ? room.player2 : room.player1 };
}

function getAliveIndex(party = [], preferredIndex = 0) {
  if (party[preferredIndex]?.hp > 0) return preferredIndex;
  return party.findIndex(ewamon => ewamon.hp > 0);
}

function getQueue(modeId = "standard") {
  return matchmakingQueues[modeId] || matchmakingQueues.standard;
}

function getModeLabel(modeId = "standard") {
  return PVP_MODES[modeId]?.label || PVP_MODES.standard.label;
}

function getAllowedMatchGap(queueEntry, now = Date.now()) {
  const waitedMs = Math.max(0, now - Number(queueEntry?.queuedAt || now));
  const expansionSteps = Math.floor(waitedMs / 15_000);
  return 150 + (expansionSteps * 100);
}

function findBestMatchIndex(queue, rating) {
  if (!queue.length) return -1;
  const now = Date.now();
  let bestIndex = -1;
  let bestGap = Number.POSITIVE_INFINITY;

  queue.forEach((entry, index) => {
    const gap = Math.abs((entry.rating ?? 0) - rating);
    if (gap <= getAllowedMatchGap(entry, now) && gap < bestGap) {
      bestGap = gap;
      bestIndex = index;
    }
  });

  if (bestIndex !== -1) return bestIndex;

  return queue.findIndex(entry => now - Number(entry?.queuedAt || now) >= 60_000);
}

function buildTurnHighlight(room, a1, a2, events) {
  const pieces = [];
  if (a1?.type === "move") pieces.push(`${room.player1.ewamon.nickname} used ${a1.moveName}`);
  else if (a1?.type === "switch") pieces.push(`${room.player1.username} switched`);
  else if (a1?.type === "item") pieces.push(`${room.player1.username} used ${a1.itemId}`);

  if (a2?.type === "move") pieces.push(`${room.player2.ewamon.nickname} used ${a2.moveName}`);
  else if (a2?.type === "switch") pieces.push(`${room.player2.username} switched`);
  else if (a2?.type === "item") pieces.push(`${room.player2.username} used ${a2.itemId}`);

  const faints = events
    .filter(event => event.type === "player_fainted" || event.type === "wild_fainted")
    .map(event => event.msg);
  if (faints.length) pieces.push(...faints);
  return pieces.join(" | ");
}

function appendBattleHistory(player, entry) {
  player.battleHistory = [...(player.battleHistory || []), entry].slice(-50);
}

function updatePartyBattleStats(player, roomParty = [], { won = false, cup = false, friend = false } = {}) {
  const statKeys = {
    wins: won ? 1 : 0,
    losses: won ? 0 : 1,
    friendWins: won && friend ? 1 : 0,
    cupWins: won && cup ? 1 : 0,
  };
  const partyIds = new Set((roomParty || []).map(member => String(member._id)).filter(Boolean));
  (player.party || []).forEach(member => {
    if (!partyIds.has(String(member._id))) return;
    member.battleStats = member.battleStats || { wins: 0, losses: 0, friendWins: 0, cupWins: 0 };
    Object.entries(statKeys).forEach(([key, value]) => {
      member.battleStats[key] = Number(member.battleStats[key] || 0) + value;
    });
  });
}

function removeFromMatchmaking(playerId) {
  Object.values(matchmakingQueues).forEach(queue => {
    const idx = queue.findIndex(entry => entry.playerId.toString() === playerId.toString());
    if (idx !== -1) {
      clearTimeout(queue[idx].timeoutId);
      queue.splice(idx, 1);
    }
  });
}

function findBattleSocket(ns, playerId) {
  return [...ns.sockets.values()].find(socket => socket.player?._id?.toString() === playerId.toString()) || null;
}

function pickTrainerIdentity(identity) {
  if (!identity) return null;
  return {
    spriteSlot: identity.spriteSlot || "male",
    avatarEwamon: identity.avatarEwamon || null,
    title: identity.title || null,
  };
}

async function createBattleRoom(ns, challengerPlayer, targetPlayer) {
  const modeId = PVP_MODES[targetPlayer.modeId || challengerPlayer.modeId] ? (targetPlayer.modeId || challengerPlayer.modeId) : "standard";
  const activeCup = modeId === "cup" ? getActiveWeeklyCup() : null;
  const challengerParty = challengerPlayer.party.map(ewamon => scaleEwamonForMode(ewamon, modeId));
  const targetParty = targetPlayer.party.map(ewamon => scaleEwamonForMode(ewamon, modeId));
  const challengerIndex = getAliveIndex(challengerParty, challengerPlayer.activeIndex || 0);
  const targetIndex = getAliveIndex(targetParty, targetPlayer.activeIndex || 0);

  if (challengerIndex === -1 || targetIndex === -1) {
    throw new Error("Both trainers need at least one healthy Ewamon");
  }

  removeFromMatchmaking(challengerPlayer._id);
  removeFromMatchmaking(targetPlayer._id);

  const roomId = uuidv4();
  const challengerSocket = findBattleSocket(ns, challengerPlayer._id);
  const targetSocket = findBattleSocket(ns, targetPlayer._id);
  const room = {
    roomId,
    type: "pvp",
    mode: modeId,
    ruleSetId: activeCup?.id || challengerPlayer.ruleSetId || targetPlayer.ruleSetId || null,
    cup: activeCup,
    isFriendBattle: Boolean(challengerPlayer.isFriendBattle || targetPlayer.isFriendBattle),
    status: "active",
    turn: 1,
    turnSummaries: [],
    awaitingSwitch: null,
    turnTimerId: null,
    player1: {
      playerId: challengerPlayer._id,
      username: challengerPlayer.username,
      socketId: challengerSocket?.id || null,
      pvpRank: normalizePvpRank(challengerPlayer.pvpRank),
      trainerIdentity: pickTrainerIdentity(challengerPlayer.trainerIdentity),
      party: challengerParty,
      activeIndex: challengerIndex,
      ewamon: challengerParty[challengerIndex],
      submittedAction: null,
    },
    player2: {
      playerId: targetPlayer._id,
      username: targetPlayer.username,
      socketId: targetSocket?.id || null,
      pvpRank: normalizePvpRank(targetPlayer.pvpRank),
      trainerIdentity: pickTrainerIdentity(targetPlayer.trainerIdentity),
      party: targetParty,
      activeIndex: targetIndex,
      ewamon: targetParty[targetIndex],
      submittedAction: null,
    },
  };

  battleRooms.set(roomId, room);
  playerToBattle.set(challengerPlayer._id.toString(), roomId);
  playerToBattle.set(targetPlayer._id.toString(), roomId);

  await new Battle({
    roomId,
    type: "pvp",
    format: modeId,
    status: "active",
    player1: { playerId: challengerPlayer._id, username: challengerPlayer.username, activeEwamon: room.player1.ewamon },
    player2: { playerId: targetPlayer._id, username: targetPlayer.username, activeEwamon: room.player2.ewamon },
  }).save();

  if (challengerSocket) {
    challengerSocket.join(roomId);
    ns.to(challengerSocket.id).emit("battle_start", { roomId, role: "p1", room: sanitizeRoom(room), mode: modeId, modeLabel: getModeLabel(modeId), cup: activeCup });
  }
  if (targetSocket) {
    targetSocket.join(roomId);
    ns.to(targetSocket.id).emit("battle_start", { roomId, role: "p2", room: sanitizeRoom(room), mode: modeId, modeLabel: getModeLabel(modeId), cup: activeCup });
  }

  return room;
}

// Check for fainted Ewamon; prompt switch or end battle. Returns true if battle state changed.
function checkFaints(ns, room) {
  const p1Dead = room.player1.ewamon.hp <= 0;
  const p2Dead = room.player2.ewamon.hp <= 0;
  if (!p1Dead && !p2Dead) return false;

  const p1HasMore = room.player1.party.some((e, i) => i !== room.player1.activeIndex && e.hp > 0);
  const p2HasMore = room.player2.party.some((e, i) => i !== room.player2.activeIndex && e.hp > 0);

  if (p1Dead && !p1HasMore) { endBattle(ns, room, "p2", "combat"); return true; }
  if (p2Dead && !p2HasMore) { endBattle(ns, room, "p1", "combat"); return true; }

  room.awaitingSwitch = p1Dead && p2Dead ? "both" : p1Dead ? "p1" : "p2";

  if (p1Dead) {
    ns.to(room.player1.socketId).emit("switch_required", { msg: `${room.player1.ewamon.nickname} fainted! Choose your next Ewamon.`, party: room.player1.party });
    ns.to(room.player2.socketId).emit("opponent_switching", { msg: `${room.player1.username}'s ${room.player1.ewamon.nickname} fainted!` });
  }
  if (p2Dead) {
    ns.to(room.player2.socketId).emit("switch_required", { msg: `${room.player2.ewamon.nickname} fainted! Choose your next Ewamon.`, party: room.player2.party });
    ns.to(room.player1.socketId).emit("opponent_switching", { msg: `${room.player2.username}'s ${room.player2.ewamon.nickname} fainted!` });
  }
  return true;
}

// ── Turn timer ─────────────────────────────────────────────────────────────────
const TURN_TIMEOUT_MS = 60_000; // 60 seconds per turn

function clearTurnTimer(room) {
  if (room.turnTimerId) {
    clearTimeout(room.turnTimerId);
    room.turnTimerId = null;
  }
}

function startTurnTimer(ns, room) {
  clearTurnTimer(room);
  room.turnTimerId = setTimeout(async () => {
    if (room.status !== "active") return;
    const p1Submitted = Boolean(room.player1.submittedAction);
    const p2Submitted = Boolean(room.player2.submittedAction);
    // Forfeit the player(s) who didn't act in time
    let winnerSlot = null;
    if (p1Submitted && !p2Submitted) winnerSlot = "p1";
    else if (!p1Submitted && p2Submitted) winnerSlot = "p2";
    else winnerSlot = "p1"; // both idle — arbitrary; notified below
    ns.to(room.roomId).emit("turn_timer_expired", {
      username: winnerSlot === "p1" ? room.player2.username : room.player1.username,
    });
    await endBattle(ns, room, winnerSlot, "timeout");
  }, TURN_TIMEOUT_MS);
}

function setupBattleSocket(io) {
  const battleNS = io.of("/battle");
  battleNS.use(socketAuth);

  battleNS.on("connection", socket => {
    const player = socket.player;
    markOnline(socket.id, player);

    // ── Reconnect to active battle ─────────────────────────────────────────────
    const activeRoomId = playerToBattle.get(player._id.toString());
    if (activeRoomId) {
      const room = battleRooms.get(activeRoomId);
      if (room?.status === "active") {
        const isP1 = room.player1.playerId.toString() === player._id.toString();
        const slot = isP1 ? room.player1 : room.player2;
        slot.socketId = socket.id;
        socket.join(activeRoomId);
        socket.emit("battle_reconnect", { roomId: activeRoomId, role: isP1 ? "p1" : "p2", room: sanitizeRoom(room), mode: room.mode || "standard", modeLabel: getModeLabel(room.mode || "standard"), cup: room.cup || null });
      }
    }

    // ── Matchmaking ────────────────────────────────────────────────────────────
    socket.on("join_matchmaking", async ({ activeEwamonIndex = 0, mode = "standard", ruleSetId = null }) => {
      try {
        const queueMode = PVP_MODES[mode] ? mode : "standard";
        const queue = getQueue(queueMode);
        const freshPlayer = await Player.findById(player._id);
        ensureLiveOpsState(freshPlayer);
        const aliveParty = freshPlayer.party.filter(e => e.hp > 0);
        if (aliveParty.length === 0) return socket.emit("error", { msg: "All Ewamon fainted! Heal them first." });
        const validIndex = freshPlayer.party[activeEwamonIndex]?.hp > 0 ? activeEwamonIndex : freshPlayer.party.findIndex(e => e.hp > 0);
        if (queueMode === "ranked") {
          const leagueState = buildLeagueState(freshPlayer);
          if ((leagueState.summary?.gymsCleared || 0) < 8) {
            return socket.emit("error", { msg: "Ranked unlocks after you clear all 8 Ewa League gyms." });
          }
          if ((freshPlayer.party?.length || 0) < 6) {
            return socket.emit("error", { msg: "Ranked requires a full party of 6 Ewamon." });
          }
        } else if (queueMode === "cup") {
          const cup = getActiveWeeklyCup();
          const cupValidation = validateCupParty(freshPlayer.party, cup);
          if (!cupValidation.ok) {
            return socket.emit("error", { msg: cupValidation.error });
          }
        }

        removeFromMatchmaking(player._id);

        const playerRating = getPlayerRating(freshPlayer);
        const matchIndex = queueMode === "ranked"
          ? findBestMatchIndex(queue, playerRating)
          : (queue.length > 0 ? 0 : -1);

        if (matchIndex !== -1) {
          const [opp] = queue.splice(matchIndex, 1);
          clearTimeout(opp.timeoutId);
          await createBattleRoom(
            battleNS,
            {
              _id: opp.playerId,
              username: opp.username,
              party: opp.party,
              activeIndex: opp.activeIndex,
              modeId: queueMode,
              ruleSetId: opp.ruleSetId || null,
              pvpRank: opp.pvpRank,
              trainerIdentity: opp.trainerIdentity,
            },
            {
              _id: player._id,
              username: player.username,
              party: freshPlayer.party,
              activeIndex: validIndex,
              modeId: queueMode,
              ruleSetId,
              pvpRank: freshPlayer.pvpRank,
              trainerIdentity: freshPlayer.trainerIdentity,
            }
          );
        } else {
          const timeoutId = setTimeout(() => {
            const idx = queue.findIndex(e => e.playerId.toString() === player._id.toString());
            if (idx !== -1) { queue.splice(idx, 1); socket.emit("matchmaking_timeout"); }
          }, MATCHMAKING_TIMEOUT_MS);
          queue.push({
            playerId: player._id,
            username: player.username,
            socketId: socket.id,
            party: freshPlayer.party.map(normalizeEwamon),
            activeIndex: validIndex,
            timeoutId,
            mode: queueMode,
            ruleSetId,
            rating: playerRating,
            pvpRank: normalizePvpRank(freshPlayer.pvpRank),
            trainerIdentity: freshPlayer.trainerIdentity,
            queuedAt: Date.now(),
          });
          socket.emit("matchmaking_waiting", {
            position: queue.length,
            mode: queueMode,
            modeLabel: getModeLabel(queueMode),
            cup: queueMode === "cup" ? getActiveWeeklyCup() : null,
          });
        }
      } catch (err) { console.error(err); socket.emit("error", { msg: "Matchmaking error" }); }
    });

    socket.on("cancel_matchmaking", () => {
      removeFromMatchmaking(player._id);
      socket.emit("matchmaking_cancelled");
    });

    // ── Submit move ────────────────────────────────────────────────────────────
    socket.on("submit_move", async ({ roomId, moveName }) => {
      if (!battleLimiter.check(socket.id, "submit_move", { windowMs: 2000, max: 3 })) return;
      try {
        const room = battleRooms.get(roomId);
        if (!room || room.status !== "active") return socket.emit("error", { msg: "Battle not found" });
        if (room.awaitingSwitch) return socket.emit("error", { msg: "Must switch Ewamon first" });
        const { myData, oppData } = getSlots(room, player._id);
        if (myData.submittedAction) return socket.emit("error", { msg: "Already submitted" });
        if (!myData.ewamon.moves.includes(moveName)) return socket.emit("error", { msg: "Invalid move" });
        const pp = myData.ewamon.pp?.[moveName] ?? 0;
        if (pp <= 0) return socket.emit("error", { msg: "No PP left" });
        myData.submittedAction = { type: "move", moveName };
        socket.emit("move_accepted", { moveName });
        if (oppData.submittedAction) { clearTurnTimer(room); await resolveTurn(battleNS, room); }
        else { startTurnTimer(battleNS, room); battleNS.to(oppData.socketId).emit("opponent_move_submitted"); }
      } catch (err) { console.error(err); socket.emit("error", { msg: "Move error" }); }
    });

    // ── Submit switch ──────────────────────────────────────────────────────────
    socket.on("submit_switch", async ({ roomId, partyIndex }) => {
      try {
        const room = battleRooms.get(roomId);
        if (!room || room.status !== "active") return socket.emit("error", { msg: "Battle not found" });
        const { mySlot, myData, oppData } = getSlots(room, player._id);
        const newEwamon = myData.party[partyIndex];
        if (!newEwamon) return socket.emit("error", { msg: "Invalid party slot" });
        if (newEwamon.hp <= 0) return socket.emit("error", { msg: "That Ewamon has fainted" });
        if (partyIndex === myData.activeIndex) return socket.emit("error", { msg: "Already active" });

        const isForced = room.awaitingSwitch === mySlot || room.awaitingSwitch === "both";
        if (isForced) {
          myData.activeIndex = partyIndex;
          myData.ewamon = myData.party[partyIndex];
          const wasAwaitingBoth = room.awaitingSwitch === "both";
          room.awaitingSwitch = wasAwaitingBoth ? (mySlot === "p1" ? "p2" : "p1") : null;
          battleNS.to(room.roomId).emit("switch_done", { slot: mySlot, newEwamon: myData.ewamon, msg: `${myData.username} sent out ${myData.ewamon.nickname}!` });
          if (!room.awaitingSwitch) {
            // Both switches done — fresh turn
            room.player1.submittedAction = null;
            room.player2.submittedAction = null;
          }
        } else {
          if (myData.submittedAction) return socket.emit("error", { msg: "Already submitted" });
          myData.submittedAction = { type: "switch", partyIndex };
          socket.emit("move_accepted", { moveName: `Switch → ${newEwamon.nickname}` });
          if (oppData.submittedAction) { clearTurnTimer(room); await resolveTurn(battleNS, room); }
          else { startTurnTimer(battleNS, room); battleNS.to(oppData.socketId).emit("opponent_move_submitted"); }
        }
      } catch (err) { console.error(err); socket.emit("error", { msg: "Switch error" }); }
    });

    // ── Use item in battle ─────────────────────────────────────────────────────
    socket.on("use_item_battle", async ({ roomId, itemId, partyIndex }) => {
      try {
        const room = battleRooms.get(roomId);
        if (!room || room.status !== "active") return socket.emit("error", { msg: "Battle not found" });
        if (room.awaitingSwitch) return socket.emit("error", { msg: "Must switch first" });
        const { myData, oppData } = getSlots(room, player._id);
        if (myData.submittedAction) return socket.emit("error", { msg: "Already submitted" });

        const dbPlayer = await Player.findById(player._id);
        const qty = dbPlayer.inventory.get(itemId) || 0;
        if (qty <= 0) return socket.emit("error", { msg: "No item in inventory" });

        const target = myData.party[partyIndex];
        if (!target) return socket.emit("error", { msg: "Invalid party slot" });

        let healed = 0;
        if (itemId === "potion") { if (target.hp >= target.maxHp) return socket.emit("error", { msg: "Already full HP" }); healed = Math.min(20, target.maxHp - target.hp); target.hp += healed; }
        else if (itemId === "superpotion") { if (target.hp >= target.maxHp) return socket.emit("error", { msg: "Already full HP" }); healed = Math.min(50, target.maxHp - target.hp); target.hp += healed; }
        else if (itemId === "revive") { if (target.hp > 0) return socket.emit("error", { msg: "Not fainted" }); target.hp = Math.floor(target.maxHp / 2); healed = target.hp; }
        else return socket.emit("error", { msg: "Can't use that in battle" });

        dbPlayer.inventory.set(itemId, qty - 1);
        await dbPlayer.save();
        if (partyIndex === myData.activeIndex) myData.ewamon = target;

        myData.submittedAction = { type: "item", itemId, partyIndex, healed };
        socket.emit("item_used_battle", { itemId, partyIndex, healed, party: myData.party });
        if (oppData.submittedAction) { clearTurnTimer(room); await resolveTurn(battleNS, room); }
        else { startTurnTimer(battleNS, room); battleNS.to(oppData.socketId).emit("opponent_move_submitted"); }
      } catch (err) { console.error(err); socket.emit("error", { msg: "Item error" }); }
    });

    // ── Forfeit ────────────────────────────────────────────────────────────────
    socket.on("forfeit", async ({ roomId }) => {
      try {
        const room = battleRooms.get(roomId);
        if (!room) return;
        clearTurnTimer(room);
        const isP1 = room.player1.playerId.toString() === player._id.toString();
        await endBattle(battleNS, room, isP1 ? "p2" : "p1", "forfeit");
      } catch (err) {
        console.error("Forfeit error:", err);
        socket.emit("error", { msg: "Forfeit failed" });
      }
    });

    socket.on("disconnect", () => {
      battleLimiter.evict(socket.id);
      markOffline(socket.id);
      removeFromMatchmaking(player._id);
    });
  });
}

// ── Turn resolution ────────────────────────────────────────────────────────────
async function resolveTurn(ns, room) {
  const p1 = room.player1, p2 = room.player2;
  const a1 = p1.submittedAction, a2 = p2.submittedAction;
  p1.submittedAction = null; p2.submittedAction = null;
  const events = [];
  const turnMeta = { orderHint: null, firstActorSlot: null, orderReason: null };

  // Switches execute first (no damage)
  if (a1?.type === "switch") {
    const oldEwamon = p1.ewamon;
    const healed = applyRegenerator(oldEwamon);
    if (healed > 0) events.push({ type: "ability", abilityName: "Regenerator", targetSlot: "p1", msg: `${oldEwamon.nickname}'s Regenerator restored HP! (+${healed})` });
    p1.activeIndex = a1.partyIndex; p1.ewamon = p1.party[a1.partyIndex];
    events.push({ type: "switch", slot: "p1", actorSlot: "p1", targetSlot: "p1", speciesId: p1.ewamon.speciesId, msg: `${p1.username} switched to ${p1.ewamon.nickname}!` });
    if (p1.ewamon.selectedAbility === "Intimidate") {
      p2.ewamon.atk = Math.max(1, Math.floor(p2.ewamon.atk * 0.8));
      events.push({ type: "ability", abilityName: "Intimidate", targetSlot: "p2", msg: `${p1.ewamon.nickname}'s Intimidate lowered ${p2.ewamon.nickname}'s Attack!` });
    }
  }
  if (a2?.type === "switch") {
    const oldEwamon = p2.ewamon;
    const healed = applyRegenerator(oldEwamon);
    if (healed > 0) events.push({ type: "ability", abilityName: "Regenerator", targetSlot: "p2", msg: `${oldEwamon.nickname}'s Regenerator restored HP! (+${healed})` });
    p2.activeIndex = a2.partyIndex; p2.ewamon = p2.party[a2.partyIndex];
    events.push({ type: "switch", slot: "p2", actorSlot: "p2", targetSlot: "p2", speciesId: p2.ewamon.speciesId, msg: `${p2.username} switched to ${p2.ewamon.nickname}!` });
    if (p2.ewamon.selectedAbility === "Intimidate") {
      p1.ewamon.atk = Math.max(1, Math.floor(p1.ewamon.atk * 0.8));
      events.push({ type: "ability", abilityName: "Intimidate", targetSlot: "p1", msg: `${p2.ewamon.nickname}'s Intimidate lowered ${p1.ewamon.nickname}'s Attack!` });
    }
  }

  // Item use events (already applied)
  if (a1?.type === "item") events.push({ type: "item", slot: "p1", actorSlot: "p1", targetSlot: "p1", itemId: a1.itemId, healed: a1.healed, targetHp: p1.party[a1.partyIndex].hp, msg: `${p1.username} used ${a1.itemId} on ${p1.party[a1.partyIndex].nickname}! (+${a1.healed} HP)` });
  if (a2?.type === "item") events.push({ type: "item", slot: "p2", actorSlot: "p2", targetSlot: "p2", itemId: a2.itemId, healed: a2.healed, targetHp: p2.party[a2.partyIndex].hp, msg: `${p2.username} used ${a2.itemId} on ${p2.party[a2.partyIndex].nickname}! (+${a2.healed} HP)` });

  // Moves
  const m1 = a1?.type === "move" ? a1.moveName : null;
  const m2 = a2?.type === "move" ? a2.moveName : null;

  function doMove(attacker, defender, moveName, attackerSlot, defenderSlot) {
    if (handlePreMoveEffects(attacker.ewamon, events, attackerSlot)) return;
    const move = MOVES[moveName];
    if (!move) return;
    attacker.ewamon.pp[moveName] = Math.max(0, (attacker.ewamon.pp[moveName] || 0) - 1);
    const effectiveness = getEffectivenessMultiplier(move.type, defender.ewamon.speciesId);
    const effectivenessLabel = describeEffectiveness(effectiveness);

    if (move.power > 0) {
      // Check ability absorption (Water Absorb, Volt Absorb, Flash Fire)
      const absorb = getAbilityAbsorb(defender.ewamon.selectedAbility, move.type, defender.ewamon.maxHp);
      if (absorb !== 0) {
        if (absorb > 0) {
          const actualHeal = Math.min(absorb, defender.ewamon.maxHp - defender.ewamon.hp);
          defender.ewamon.hp = Math.min(defender.ewamon.maxHp, defender.ewamon.hp + actualHeal);
          events.push({ type: "ability", abilityName: defender.ewamon.selectedAbility, targetSlot: defenderSlot, msg: `${defender.ewamon.nickname}'s ${defender.ewamon.selectedAbility} absorbed the attack! (+${actualHeal} HP)` });
        } else {
          events.push({ type: "ability", abilityName: defender.ewamon.selectedAbility, targetSlot: defenderSlot, msg: `${defender.ewamon.nickname}'s ${defender.ewamon.selectedAbility} made it immune!` });
        }
        return;
      }

      // Check Wonder Guard (only super-effective moves hit)
      if (wonderGuardBlocks(defender.ewamon, effectiveness)) {
        events.push({ type: "ability", abilityName: "Wonder Guard", targetSlot: defenderSlot, msg: `${defender.ewamon.nickname}'s Wonder Guard blocked the attack!` });
        return;
      }

      // Apply buffed stats for damage calculation
      const atkStats = getBuffedStats(attacker.ewamon, defender.ewamon);
      const defStats = getBuffedStats(defender.ewamon, attacker.ewamon);
      const savedAtk = attacker.ewamon.atk, savedDef = defender.ewamon.def;
      attacker.ewamon.atk = atkStats.atk;
      defender.ewamon.def = defStats.def;

      let dmg = calcDamage(attacker.ewamon, defender.ewamon, moveName);

      // Restore original stats
      attacker.ewamon.atk = savedAtk;
      defender.ewamon.def = savedDef;

      // Apply ability damage modifiers
      dmg = applyAbilityDamageModifiers(attacker.ewamon, defender.ewamon, dmg, move.type);
      // Apply held item damage modifiers
      dmg = applyHeldItemDamageModifiers(attacker.ewamon, dmg, move.type);

      defender.ewamon.hp = Math.max(0, defender.ewamon.hp - dmg);
      events.push({
        type: "move", move: moveName, moveType: move.type,
        attackerSlot, targetSlot: defenderSlot,
        damage: dmg, targetHp: defender.ewamon.hp,
        targetStatus: getMajorStatus(defender.ewamon),
        targetStatuses: getStatuses(defender.ewamon),
        effectiveness, effectivenessLabel,
        attackerName: attacker.ewamon.nickname, targetName: defender.ewamon.nickname,
        msg: `${attacker.ewamon.nickname} used ${moveName}! (${dmg} dmg)`,
      });

      // Contact ability effects (Flame Body, Poison Spores, Rough Skin)
      if (defender.ewamon.hp > 0) {
        applyContactAbility(attacker.ewamon, defender.ewamon, events, attackerSlot, defenderSlot);
      }
    } else {
      events.push({
        type: "move", move: moveName, moveType: move.type,
        attackerSlot, targetSlot: defenderSlot,
        damage: 0, targetHp: defender.ewamon.hp,
        targetStatus: getMajorStatus(defender.ewamon),
        targetStatuses: getStatuses(defender.ewamon),
        effectiveness, effectivenessLabel,
        attackerName: attacker.ewamon.nickname, targetName: defender.ewamon.nickname,
        msg: `${attacker.ewamon.nickname} used ${moveName}!`,
      });
    }
    applyMoveEffect(move.effect, attacker.ewamon, defender.ewamon, events, attackerSlot, defenderSlot);
  }

  if (m1 && m2) {
    const mv1 = MOVES[m1], mv2 = MOVES[m2];
    const pri1 = mv1?.effect === "first" ? 1 : 0, pri2 = mv2?.effect === "first" ? 1 : 0;
    // Use buffed speed for turn order
    const p1Spd = getBuffedStats(p1.ewamon, p2.ewamon).spd;
    const p2Spd = getBuffedStats(p2.ewamon, p1.ewamon).spd;
    const p1First = pri1 > pri2 ? true : pri2 > pri1 ? false : p1Spd >= p2Spd;
    turnMeta.firstActorSlot = p1First ? "p1" : "p2";
    turnMeta.orderReason = pri1 !== pri2 ? "priority" : (p1Spd === p2Spd ? "speed_tie" : "speed");
    turnMeta.orderHint = buildSpeedHint(p1First ? p1 : p2, p1First ? p2 : p1, pri1 !== pri2 ? "priority" : "speed");
    if (p1First) {
      doMove(p1, p2, m1, "p1", "p2");
      if (p2.ewamon.hp > 0) doMove(p2, p1, m2, "p2", "p1");
    } else {
      doMove(p2, p1, m2, "p2", "p1");
      if (p1.ewamon.hp > 0) doMove(p1, p2, m1, "p1", "p2");
    }
  } else if (m1) doMove(p1, p2, m1, "p1", "p2");
  else if (m2) doMove(p2, p1, m2, "p2", "p1");

  // End-of-turn: Speed Boost
  if (p1.ewamon.hp > 0) applySpeedBoost(p1.ewamon, events, "p1");
  if (p2.ewamon.hp > 0) applySpeedBoost(p2.ewamon, events, "p2");

  // End-of-turn status damage
  if (p1.ewamon.hp > 0) applyEndOfTurnStatus(p1.ewamon, events, "p1");
  if (p2.ewamon.hp > 0) applyEndOfTurnStatus(p2.ewamon, events, "p2");

  // End-of-turn held item healing (berries)
  [{ p: p1, slot: "p1" }, { p: p2, slot: "p2" }].forEach(({ p, slot }) => {
    if (p.ewamon.hp > 0) {
      const heal = getHeldItemHealAmount(p.ewamon);
      if (heal > 0) {
        const actual = Math.min(heal, p.ewamon.maxHp - p.ewamon.hp);
        p.ewamon.hp = Math.min(p.ewamon.maxHp, p.ewamon.hp + actual);
        const itemName = ITEMS[p.ewamon.heldItem]?.name || p.ewamon.heldItem;
        events.push({ type: "item_heal", targetSlot: slot, heal: actual, targetHp: p.ewamon.hp, msg: `${p.ewamon.nickname}'s ${itemName} restored ${actual} HP!` });
        p.ewamon.heldItem = null; // Berry consumed
      }
    }
  });

  // Sync party with active ewamon
  p1.party[p1.activeIndex] = p1.ewamon;
  p2.party[p2.activeIndex] = p2.ewamon;
  room.turn++;

  ns.to(room.roomId).emit("turn_result", {
    events,
    turnMeta,
    p1Hp: p1.ewamon.hp, p2Hp: p2.ewamon.hp,
    p1Status: getMajorStatus(p1.ewamon), p2Status: getMajorStatus(p2.ewamon),
    p1Statuses: getStatuses(p1.ewamon), p2Statuses: getStatuses(p2.ewamon),
    p1Party: p1.party.map(e => ({ hp: e.hp, maxHp: e.maxHp, status: getMajorStatus(e), statuses: getStatuses(e) })),
    p2Party: p2.party.map(e => ({ hp: e.hp, maxHp: e.maxHp, status: getMajorStatus(e), statuses: getStatuses(e) })),
    p1Pp: normPp(p1.ewamon.pp), p2Pp: normPp(p2.ewamon.pp),
    turn: room.turn,
    room: sanitizeRoom(room),
  });

  const summary = buildTurnHighlight(room, a1, a2, events);
  if (summary) {
    room.turnSummaries = [...(room.turnSummaries || []), `Turn ${room.turn - 1}: ${summary}`].slice(-8);
  }

  checkFaints(ns, room);
}

async function endBattle(ns, room, winnerSlot, reason) {
  if (room.status === "finished") return;
  room.status = "finished";
  clearTurnTimer(room);
  const winnerData = winnerSlot === "p1" ? room.player1 : room.player2;
  const loserData = winnerSlot === "p1" ? room.player2 : room.player1;
  const reward = { money: 200, exp: 150 };

  playerToBattle.delete(winnerData.playerId.toString());
  playerToBattle.delete(loserData.playerId.toString());

  try {
    await Battle.findOneAndUpdate({ roomId: room.roomId }, { status: "finished", winner: winnerData.username, finishedAt: new Date() });
    const [winnerPlayer, loserPlayer] = await Promise.all([
      Player.findById(winnerData.playerId),
      Player.findById(loserData.playerId),
    ]);
    ensureLiveOpsState(winnerPlayer);
    ensureLiveOpsState(loserPlayer);
    const rankedMode = Boolean(PVP_MODES[room.mode || "standard"]?.ranked);
    const cupMode = Boolean(PVP_MODES[room.mode || "standard"]?.cup);
    let winnerRankResult = null;
    let loserRankResult = null;
    let winnerRankChange = null;
    let loserRankChange = null;

    if (rankedMode) {
      const winnerMatches = (winnerPlayer.wins || 0) + (winnerPlayer.losses || 0);
      const loserMatches = (loserPlayer.wins || 0) + (loserPlayer.losses || 0);
      const rankedResult = calculateRankedBattleResult({
        winnerRating: getPlayerRating(winnerPlayer),
        loserRating: getPlayerRating(loserPlayer),
        winnerMatches,
        loserMatches,
      });
      winnerRankResult = applyRankDelta(winnerPlayer, rankedResult.winnerDelta);
      loserRankResult = applyRankDelta(loserPlayer, rankedResult.loserDelta);
      winnerRankChange = buildRankChangeSummary(winnerRankResult.before, winnerRankResult.after);
      loserRankChange = buildRankChangeSummary(loserRankResult.before, loserRankResult.after);
    }

    winnerPlayer.wins += 1;
    winnerPlayer.money += reward.money;
    loserPlayer.losses += 1;
    updatePartyBattleStats(winnerPlayer, winnerSlot === "p1" ? room.player1.party : room.player2.party, { won: true, cup: cupMode, friend: room.isFriendBattle });
    updatePartyBattleStats(loserPlayer, winnerSlot === "p1" ? room.player2.party : room.player1.party, { won: false, cup: cupMode, friend: room.isFriendBattle });
    const winnerLiveOps = applyLiveOpsEvent(winnerPlayer, "pvp_win", { mode: room.mode });
    let loserLiveOps = { summary: buildCompactLiveOpsSummary(loserPlayer), rewardEntries: [] };
    if (room.isFriendBattle) {
      const winnerFriend = applyLiveOpsEvent(winnerPlayer, "friend_battle_complete");
      const loserFriend = applyLiveOpsEvent(loserPlayer, "friend_battle_complete");
      winnerLiveOps.rewardEntries.push(...winnerFriend.rewardEntries);
      loserLiveOps = loserFriend;
    }

    const historyBase = {
      roomId: room.roomId,
      mode: room.mode || "standard",
      reason,
      rewardMoney: reward.money,
      rewardExp: reward.exp,
      turnCount: Math.max(0, (room.turn || 1) - 1),
      highlights: room.turnSummaries || [],
      happenedAt: new Date(),
    };
    appendBattleHistory(winnerPlayer, {
      ...historyBase,
      opponentUsername: loserData.username,
      result: "win",
      ratingBefore: winnerRankResult?.before?.rating ?? null,
      ratingAfter: winnerRankResult?.after?.rating ?? null,
      ratingDelta: winnerRankChange?.delta ?? 0,
      tierBefore: winnerRankResult?.before?.tierLabel ?? null,
      tierAfter: winnerRankResult?.after?.tierLabel ?? null,
    });
    appendBattleHistory(loserPlayer, {
      ...historyBase,
      opponentUsername: winnerData.username,
      result: "loss",
      rewardMoney: 0,
      ratingBefore: loserRankResult?.before?.rating ?? null,
      ratingAfter: loserRankResult?.after?.rating ?? null,
      ratingDelta: loserRankChange?.delta ?? 0,
      tierBefore: loserRankResult?.before?.tierLabel ?? null,
      tierAfter: loserRankResult?.after?.tierLabel ?? null,
    });

    await Promise.all([winnerPlayer.save(), loserPlayer.save()]);
    const wRes = await distributeExpAndEvolve(winnerData.playerId, reward.exp);
    const lRes = await distributeExpAndEvolve(loserData.playerId, Math.floor(reward.exp / 2));
    ns.to(winnerData.socketId).emit("battle_end", {
      winner: winnerData.username,
      winnerSlot,
      reason,
      reward,
      levelUps: wRes.levelUps,
      evolutions: wRes.evolutions,
      rankUpdate: winnerRankChange,
      liveOpsSummary: buildCompactLiveOpsSummary(winnerPlayer),
      rewardEntries: winnerLiveOps.rewardEntries,
      summary: {
        title: "Battle Complete",
        cta: room.mode === "cup" ? "Queue Again" : "Queue Again",
        rewards: winnerLiveOps.rewardEntries,
      },
      cup: room.cup || null,
    });
    ns.to(loserData.socketId).emit("battle_end", {
      winner: winnerData.username,
      winnerSlot,
      reason,
      reward: { ...reward, money: 0 },
      levelUps: lRes.levelUps,
      evolutions: lRes.evolutions,
      rankUpdate: loserRankChange,
      liveOpsSummary: buildCompactLiveOpsSummary(loserPlayer),
      rewardEntries: loserLiveOps.rewardEntries,
      summary: {
        title: "Battle Complete",
        cta: "Queue Again",
        rewards: loserLiveOps.rewardEntries,
      },
      cup: room.cup || null,
    });
  } catch (err) {
    console.error("DB error:", err);
    ns.to(room.roomId).emit("battle_end", { winner: winnerData.username, winnerSlot, reason, reward });
  }
  battleRooms.delete(room.roomId);
}

async function createDirectBattle(io, challengerPlayerId, targetPlayerId) {
  const battleNS = io.of("/battle");
  if (playerToBattle.has(challengerPlayerId.toString()) || playerToBattle.has(targetPlayerId.toString())) {
    throw new Error("One of the trainers is already in a battle");
  }

  const [challengerPlayer, targetPlayer] = await Promise.all([
    Player.findById(challengerPlayerId),
    Player.findById(targetPlayerId),
  ]);

  if (!challengerPlayer || !targetPlayer) throw new Error("Trainer not found");
  const isFriendBattle = (challengerPlayer.friends || []).some(id => String(id) === String(targetPlayer._id))
    && (targetPlayer.friends || []).some(id => String(id) === String(challengerPlayer._id));
  return createBattleRoom(
    battleNS,
    { ...(challengerPlayer.toObject ? challengerPlayer.toObject() : challengerPlayer), modeId: "standard", isFriendBattle },
    { ...(targetPlayer.toObject ? targetPlayer.toObject() : targetPlayer), modeId: "standard", isFriendBattle }
  );
}

module.exports = { setupBattleSocket, createDirectBattle };
