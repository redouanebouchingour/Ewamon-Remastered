const Player = require("../../models/Player");
const { EWAMON_SPECIES, MOVES, calcDamage, TYPE_CHART, createEwamonInstance, ORBS, resolveOrbId, getOrbCatchMultiplier } = require("../../data/ewamon");
const TOTAL_SPECIES = Object.keys(EWAMON_SPECIES).length;
const { distributeExpAndEvolve, applyRareCandyLevel } = require("../../utils/expUtils");
const {
  completeQuest,
  isQuestComplete,
  markTrainerObjective,
  updateQuestDerivedObjectives,
} = require("../../utils/questUtils");
const { markLeagueTrainerDefeated, getLeagueTrainer } = require("../../data/league");
const { normPp, normalizePartyEwamon } = require("./wildEncounterService");
const { ensureLiveOpsState, applyLiveOpsEvent, buildCompactLiveOpsSummary, markTrainerRematchUsed } = require("../../utils/liveOps");
const { addStatus, removeStatus, hasStatus, getMajorStatus, getStatuses } = require("../../utils/statusUtils");

function getOpponentLabel(battle, wild) {
  return battle.encounterType === "trainer"
    ? `${battle.trainerName}'s ${wild.nickname}`
    : `Wild ${wild.nickname}`;
}

function applyMoveEffect(effect, attacker, defender, events, attackerSlot, defenderSlot) {
  if (!effect) return;
  const roll = Math.random();
  switch (effect) {
    case "poison":
      if (roll < 0.7 && addStatus(defender, "poison")) {
        events.push({ type: "effect", effectType: "poison", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "poison", msg: `${defender.nickname} was poisoned!` });
      }
      break;
    case "burn":
      if (roll < 0.7 && addStatus(defender, "burn")) {
        events.push({ type: "effect", effectType: "burn", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "burn", msg: `${defender.nickname} was burned!` });
      }
      break;
    case "paralyze":
      if (roll < 0.7 && addStatus(defender, "paralyze")) {
        events.push({ type: "effect", effectType: "paralyze", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "paralyze", msg: `${defender.nickname} was paralyzed!` });
      }
      break;
    case "sleep":
      if (roll < 0.5 && addStatus(defender, "sleep")) {
        defender._sleepTurns = 1 + Math.floor(Math.random() * 3);
        events.push({ type: "effect", effectType: "sleep", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "sleep", msg: `${defender.nickname} fell asleep!` });
      }
      break;
    case "freeze":
      if (roll < 0.3 && addStatus(defender, "freeze")) {
        events.push({ type: "effect", effectType: "freeze", sourceSlot: attackerSlot, targetSlot: defenderSlot, targetStatus: "freeze", msg: `${defender.nickname} was frozen solid!` });
      }
      break;
    case "confuse":
      if (!defender._confused && roll < 0.6) {
        defender._confused = true;
        defender._confuseTurns = 2 + Math.floor(Math.random() * 3);
        events.push({ type: "effect", effectType: "confuse", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname} became confused!` });
      }
      break;
    case "lower_atk":
      defender.atk = Math.max(1, Math.floor(defender.atk * 0.8));
      events.push({ type: "effect", effectType: "lower_atk", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s attack fell!` });
      break;
    case "lower_def":
      defender.def = Math.max(1, Math.floor(defender.def * 0.8));
      events.push({ type: "effect", effectType: "lower_def", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s defense fell!` });
      break;
    case "raise_def":
      attacker.def = Math.floor(attacker.def * 1.5);
      events.push({ type: "effect", effectType: "raise_def", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s defense rose!` });
      break;
    case "raise_atk":
      attacker.atk = Math.floor(attacker.atk * 1.5);
      events.push({ type: "effect", effectType: "raise_atk", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s attack rose!` });
      break;
    case "raise_spd":
      attacker.spd = Math.floor(attacker.spd * 1.5);
      events.push({ type: "effect", effectType: "raise_spd", sourceSlot: attackerSlot, targetSlot: attackerSlot, msg: `${attacker.nickname}'s speed rose!` });
      break;
    case "lower_spd":
      defender.spd = Math.max(1, Math.floor(defender.spd * 0.8));
      events.push({ type: "effect", effectType: "lower_spd", sourceSlot: attackerSlot, targetSlot: defenderSlot, msg: `${defender.nickname}'s speed fell!` });
      break;
    default:
      break;
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

function getPlayerEwamon(battle) {
  return battle.party?.[battle.activeIndex] || battle.playerEwamon;
}

async function persistBattleParty(playerId, battle) {
  if (!battle.party) return;
  await Player.findByIdAndUpdate(playerId, { party: battle.party });
}

function getTrainerExpReward(battle) {
  const enemyTeam = battle.enemyParty?.length ? battle.enemyParty : (battle.wild ? [battle.wild] : []);
  return enemyTeam.reduce((total, enemy) => {
    const species = EWAMON_SPECIES[enemy.speciesId];
    const expYield = species?.expYield ? Math.floor(species.expYield * enemy.level / 7) : 20;
    return total + expYield;
  }, 0);
}

function getNextEnemyIndex(battle) {
  const party = battle.enemyParty || [];
  return party.findIndex((enemy, index) => index !== battle.enemyActiveIndex && enemy.hp > 0);
}

function playerOwnsSpecies(player, speciesId) {
  if (!player || !speciesId) return false;
  if (player.collection?.includes(speciesId)) return true;
  if ((player.party || []).some(ewamon => ewamon?.speciesId === speciesId)) return true;
  if ((player.box || []).some(ewamon => ewamon?.speciesId === speciesId)) return true;
  return false;
}

async function finalizeTrainerVictory({ battle, playerId, playerEwamon, events }) {
  const rewardPlayer = await Player.findById(playerId);
  ensureLiveOpsState(rewardPlayer);
  rewardPlayer.party = battle.party;
  rewardPlayer.money += battle.rewardMoney || 0;

  if (battle.interactionId && !rewardPlayer.defeatedMapEvents.includes(battle.interactionId)) {
    rewardPlayer.defeatedMapEvents.push(battle.interactionId);
  }
  if (battle.isRematch && battle.interactionId) {
    markTrainerRematchUsed(rewardPlayer, battle.interactionId);
  }
  if (battle.interactionId) {
    markTrainerObjective(rewardPlayer, battle.interactionId);
  }
  let clearedLeagueTrainer = false;
  if (battle.leagueTrainerId) {
    clearedLeagueTrainer = markLeagueTrainerDefeated(rewardPlayer, battle.leagueTrainerId);
  }
  // On a FIRST league clear, award the 3D campaign badge id + story flags.
  // `badges` (e.g. "bloom") is what the 3D overworld's travel gating reads; it
  // stays in lockstep with leagueProgress.defeatedTrainerIds (set just above).
  if (clearedLeagueTrainer && battle.leagueTrainerId) {
    const leagueTrainer = getLeagueTrainer(battle.leagueTrainerId);
    if (leagueTrainer) {
      if (leagueTrainer.awardBadge && !rewardPlayer.badges.includes(leagueTrainer.awardBadge)) {
        rewardPlayer.badges.push(leagueTrainer.awardBadge);
        events.push({ type: "gold", targetSlot: "player", msg: `You earned the ${leagueTrainer.badgeName}!` });
      }
      if (Array.isArray(leagueTrainer.awardFlags) && leagueTrainer.awardFlags.length) {
        if (!(rewardPlayer.storyFlags instanceof Map)) {
          rewardPlayer.storyFlags = new Map(Object.entries(rewardPlayer.storyFlags || {}));
        }
        for (const flag of leagueTrainer.awardFlags) rewardPlayer.storyFlags.set(flag, true);
        rewardPlayer.markModified("storyFlags");
      }
    }
  }
  const shouldGrantSignatureReward = battle.rewardSpeciesId && !playerOwnsSpecies(rewardPlayer, battle.rewardSpeciesId);
  if (shouldGrantSignatureReward) {
    const rewardSpecies = EWAMON_SPECIES[battle.rewardSpeciesId];
    if (rewardSpecies) {
      const rewardLevel = Math.max(5, Number(battle.rewardSpeciesLevel) || 5);
      const rewardEwamon = createEwamonInstance(battle.rewardSpeciesId, rewardLevel);
      if (rewardPlayer.party.length < 6) rewardPlayer.party.push(rewardEwamon);
      else rewardPlayer.box.push(rewardEwamon);

      if (!rewardPlayer.collection.includes(battle.rewardSpeciesId)) {
        rewardPlayer.collection.push(battle.rewardSpeciesId);
      }
      if (!rewardPlayer.seen.includes(battle.rewardSpeciesId)) {
        rewardPlayer.seen.push(battle.rewardSpeciesId);
      }

      events.push({
        type: "catch",
        targetSlot: "player",
        msg: `You received ${rewardSpecies.name}, ${battle.trainerName}'s ace signature Ewamon!`,
      });
    }
  }

  updateQuestDerivedObjectives(rewardPlayer);
  const liveOpsResult = applyLiveOpsEvent(rewardPlayer, "trainer_win", {
    isRematch: Boolean(battle.isRematch),
    isLeague: Boolean(battle.leagueTrainerId),
    zoneId: battle.zoneId,
  });
  if (isQuestComplete(rewardPlayer)) completeQuest(rewardPlayer);
  await rewardPlayer.save();

  const expGained = getTrainerExpReward(battle);
  try {
    const expResult = await distributeExpAndEvolve(playerId, expGained, battle.wild?.level || 1);
    events.push({ type: "exp_gain", targetSlot: "player", msg: `${playerEwamon.nickname} gained ${expGained} EXP!` });
    if (expResult.goldEarned) events.push({ type: "gold", targetSlot: "player", msg: `Got ${expResult.goldEarned}G!` });
    expResult.levelUps.forEach(levelUp => events.push({ type: "level_up", targetSlot: "player", msg: `${levelUp.nickname} grew to Lv.${levelUp.level}!` }));
    expResult.evolutions.forEach(evolution => events.push({ type: "evolution", targetSlot: "player", msg: `${evolution.nickname} evolved into ${evolution.to}!` }));
  } catch (error) {
    // Keep battle result resilient to persistence errors.
  }

  if (battle.rewardMoney) {
    events.push({ type: "gold", targetSlot: "player", msg: `${battle.trainerName} paid out ${battle.rewardMoney}G.` });
  }
  liveOpsResult.rewardEntries.forEach(entry => {
    events.push({ type: "gold", targetSlot: "player", msg: `Reward unlocked: ${entry.summary}` });
  });
  events.push({ type: "trainer_defeat", targetSlot: "wild", msg: `${battle.trainerName} was defeated!` });

  return liveOpsResult;
}

async function resolveWildMove({ battle, playerId, moveName }) {
  const { wild } = battle;
  const playerEwamon = getPlayerEwamon(battle);
  battle.playerEwamon = playerEwamon;
  const events = [];
  const opponentLabel = getOpponentLabel(battle, wild);

  const move = MOVES[moveName];
  if (!move || !playerEwamon.moves.includes(moveName)) return { error: { msg: "Invalid move" } };
  const pp = playerEwamon.pp?.[moveName] ?? 0;
  if (pp <= 0) return { error: { msg: "No PP left" } };
  playerEwamon.pp[moveName] = Math.max(0, pp - 1);

  if (move.power > 0) {
    const effectiveness = getEffectivenessMultiplier(move.type, wild.speciesId);
    const dmg = calcDamage(playerEwamon, wild, moveName);
    wild.hp = Math.max(0, wild.hp - dmg);
    events.push({ type: "player_attack", move: moveName, moveType: move.type, attackerSlot: "player", targetSlot: "wild", damage: dmg, targetHp: wild.hp, targetStatus: getMajorStatus(wild), targetStatuses: getStatuses(wild), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: playerEwamon.nickname, targetName: wild.nickname, msg: `${playerEwamon.nickname} used ${moveName}! (${dmg} dmg)` });
  } else {
    const effectiveness = getEffectivenessMultiplier(move.type, wild.speciesId);
    events.push({ type: "player_attack", move: moveName, moveType: move.type, attackerSlot: "player", targetSlot: "wild", damage: 0, targetHp: wild.hp, targetStatus: getMajorStatus(wild), targetStatuses: getStatuses(wild), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: playerEwamon.nickname, targetName: wild.nickname, msg: `${playerEwamon.nickname} used ${moveName}!` });
  }

  if (move.effect) applyMoveEffect(move.effect, playerEwamon, wild, events, "player", "wild");

  if (wild.hp <= 0) {
    await persistBattleParty(playerId, battle);
    events.push({ type: "wild_fainted", targetSlot: "wild", msg: `${opponentLabel} fainted!` });

    if (battle.encounterType === "trainer") {
      const nextEnemyIndex = getNextEnemyIndex(battle);
      if (nextEnemyIndex !== -1) {
        battle.enemyActiveIndex = nextEnemyIndex;
        battle.wild = battle.enemyParty[nextEnemyIndex];
        events.push({
          type: "trainer_send_out",
          targetSlot: "wild",
          speciesId: battle.wild.speciesId,
          msg: `${battle.trainerName} sent out ${battle.wild.nickname}!`,
        });

        return {
          payload: {
            battleId: battle.id,
            events,
            wildHp: battle.wild.hp,
            playerHp: playerEwamon.hp,
            wild: battle.wild,
            playerEwamon: normalizePartyEwamon(playerEwamon),
            encounterType: battle.encounterType,
            trainerName: battle.trainerName,
            party: battle.party,
            activeIndex: battle.activeIndex,
          },
          battleEnded: false,
        };
      }

      const trainerLiveOps = await finalizeTrainerVictory({ battle, playerId, playerEwamon, events });
      battle.liveOpsSummary = trainerLiveOps?.summary || null;
    } else {
      const wildSpecies = EWAMON_SPECIES[wild.speciesId];
      const expGained = wildSpecies?.expYield ? Math.floor(wildSpecies.expYield * wild.level / 7) : 20;
      try {
        const expResult = await distributeExpAndEvolve(playerId, expGained, wild.level);
        events.push({ type: "exp_gain", targetSlot: "player", msg: `${playerEwamon.nickname} gained ${expGained} EXP!` });
        if (expResult.goldEarned) events.push({ type: "gold", targetSlot: "player", msg: `Got ${expResult.goldEarned}G!` });
        expResult.levelUps.forEach(levelUp => events.push({ type: "level_up", targetSlot: "player", msg: `${levelUp.nickname} grew to Lv.${levelUp.level}!` }));
        expResult.evolutions.forEach(evolution => events.push({ type: "evolution", targetSlot: "player", msg: `${evolution.nickname} evolved into ${evolution.to}!` }));
      } catch (error) {
        // Keep battle result resilient to persistence errors.
      }
    }

    return {
      payload: {
        battleId: battle.id,
        events,
        wildHp: 0,
        playerHp: playerEwamon.hp,
        wild,
        playerEwamon: normalizePartyEwamon(playerEwamon),
        wildFainted: true,
        encounterType: battle.encounterType,
        trainerName: battle.trainerName,
        party: battle.party,
        activeIndex: battle.activeIndex,
        liveOpsSummary: battle.liveOpsSummary || null,
      },
      battleEnded: true,
    };
  }

  const wildMove = wild.moves[Math.floor(Math.random() * wild.moves.length)];
  const wildMoveData = MOVES[wildMove];
  if (wildMoveData?.power > 0) {
    const effectiveness = getEffectivenessMultiplier(wildMoveData.type, playerEwamon.speciesId);
    const dmg = calcDamage(wild, playerEwamon, wildMove);
    playerEwamon.hp = Math.max(0, playerEwamon.hp - dmg);
    events.push({ type: "wild_attack", move: wildMove, moveType: wildMoveData.type, attackerSlot: "wild", targetSlot: "player", damage: dmg, targetHp: playerEwamon.hp, targetStatus: getMajorStatus(playerEwamon), targetStatuses: getStatuses(playerEwamon), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: wild.nickname, targetName: playerEwamon.nickname, msg: `${opponentLabel} used ${wildMove}! (${dmg} dmg)` });
  } else {
    const effectiveness = getEffectivenessMultiplier(wildMoveData.type, playerEwamon.speciesId);
    events.push({ type: "wild_attack", move: wildMove, moveType: wildMoveData.type, attackerSlot: "wild", targetSlot: "player", damage: 0, targetHp: playerEwamon.hp, targetStatus: getMajorStatus(playerEwamon), targetStatuses: getStatuses(playerEwamon), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: wild.nickname, targetName: playerEwamon.nickname, msg: `${opponentLabel} used ${wildMove}!` });
  }

  if (wildMoveData?.effect) applyMoveEffect(wildMoveData.effect, wild, playerEwamon, events, "wild", "player");

  battle.turn++;

  if (playerEwamon.hp <= 0) {
    const nextActiveIndex = battle.party.findIndex((ewamon, index) => index !== battle.activeIndex && ewamon.hp > 0);
    await persistBattleParty(playerId, battle);
    if (nextActiveIndex !== -1) {
      events.push({ type: "player_fainted", targetSlot: "player", msg: `${playerEwamon.nickname} fainted! Choose another Ewamon.` });
      return {
        payload: {
          battleId: battle.id,
          events,
          wildHp: wild.hp,
          playerHp: 0,
          wild,
          playerEwamon: normalizePartyEwamon(playerEwamon),
          playerFainted: true,
          mustSwitch: true,
          party: battle.party,
          activeIndex: battle.activeIndex,
        },
        battleEnded: false,
      };
    }

    events.push({ type: "player_fainted", targetSlot: "player", msg: `${playerEwamon.nickname} fainted! You fled!` });
    return {
      payload: { battleId: battle.id, events, wildHp: wild.hp, playerHp: 0, wild, playerEwamon: normalizePartyEwamon(playerEwamon), playerFainted: true, party: battle.party, activeIndex: battle.activeIndex },
      battleEnded: true,
    };
  }

  await persistBattleParty(playerId, battle);

  return {
    payload: {
      battleId: battle.id,
      events,
      wildHp: wild.hp,
      playerHp: playerEwamon.hp,
      wild,
      playerEwamon: normalizePartyEwamon(playerEwamon),
      wildStatus: getMajorStatus(wild),
      wildStatuses: getStatuses(wild),
      playerPp: normPp(playerEwamon.pp),
      party: battle.party,
      activeIndex: battle.activeIndex,
    },
    battleEnded: false,
  };
}

async function attemptCatch({ battle, playerId, ballType = "spark_orb" }) {
  const { wild } = battle;
  const playerEwamon = getPlayerEwamon(battle);
  battle.playerEwamon = playerEwamon;
  if (battle.encounterType === "trainer" || battle.canCatch === false) {
    return { payload: { battleId: battle.id, success: false, reason: "trainer_battle" } };
  }
  const dbPlayer = await Player.findById(playerId);
  ensureLiveOpsState(dbPlayer);
  if (!(dbPlayer.inventory instanceof Map)) {
    dbPlayer.inventory = new Map(Object.entries(dbPlayer.inventory || {}));
  }

  // Accept new IDs (spark_orb…) and legacy IDs (ewamon_ball, ultra_ball, etc).
  // Read from whichever key the player still has stock in.
  const newId = resolveOrbId(ballType);
  if (!ORBS[newId]) return { payload: { battleId: battle.id, success: false, reason: "unknown_orb" } };

  let keyToUse = newId;
  let balls = dbPlayer.inventory.get(newId) || 0;
  if (balls <= 0) {
    // Fall back to any legacy key that maps to the same orb.
    for (const [legacy, modern] of Object.entries(require("../../data/ewamon").LEGACY_ORB_ID_MAP)) {
      if (modern === newId) {
        const legacyQty = dbPlayer.inventory.get(legacy) || 0;
        if (legacyQty > 0) { balls = legacyQty; keyToUse = legacy; break; }
      }
    }
  }
  if (balls <= 0) return { payload: { battleId: battle.id, success: false, reason: "no_balls" } };
  if (dbPlayer.party.length >= 6 && dbPlayer.box.length >= 100) return { payload: { battleId: battle.id, success: false, reason: "storage_full" } };

  dbPlayer.inventory.set(keyToUse, balls - 1);

  const species = EWAMON_SPECIES[wild.speciesId];
  let chance;
  if (newId === "aether_orb") {
    chance = 1; // Aether Orb always catches
  } else {
    const catchRate = species?.catchRate || 45;
    const ballBonus = getOrbCatchMultiplier(newId, wild, species);
    // hpFactor: 0.5 at full HP → 1.0 at 0 HP (lower HP = easier to catch)
    const hpFactor = 1 - (wild.hp / wild.maxHp) * 0.5;
    // Alpha penalty only applies when no alpha-specific bonus is active.
    const orb = ORBS[newId];
    const alphaConsumed = orb?.bonus?.kind === "alpha_or_variant";
    const alphaPenalty = wild.isAlpha && !alphaConsumed ? 0.75 : 1;
    chance = (catchRate / 100) * hpFactor * ballBonus * alphaPenalty;
  }

  if (Math.random() < chance) {
    const sentToBox = dbPlayer.party.length >= 6;
    const wasNew = !dbPlayer.collection.includes(wild.speciesId);
    if (wasNew) dbPlayer.collection.push(wild.speciesId);
    if (!dbPlayer.seen.includes(wild.speciesId)) dbPlayer.seen.push(wild.speciesId);
    if (!sentToBox) dbPlayer.party = [...battle.party, wild];
    else dbPlayer.box.push(wild);
    updateQuestDerivedObjectives(dbPlayer);
    if (isQuestComplete(dbPlayer)) completeQuest(dbPlayer);

    // Check for dex completion reward
    let dexComplete = false;
    if (wasNew && dbPlayer.collection.length === TOTAL_SPECIES) {
      dexComplete = true;
      dbPlayer.money += 100000;
      dbPlayer.inventory.set("aether_orb", (dbPlayer.inventory.get("aether_orb") || 0) + 1);
    }

    const liveOpsResult = applyLiveOpsEvent(dbPlayer, "catch", {
      speciesId: wild.speciesId,
      variantKey: wild.variantKey || "normal",
      isAlpha: Boolean(wild.isAlpha),
      zoneId: battle.zoneId || wild.caughtZoneId,
      mapId: wild.caughtMapId,
      newSpeciesCaught: wasNew,
    });
    await dbPlayer.save();
    return {
      payload: {
        battleId: battle.id,
        success: true,
        ewamon: wild,
        sentToBox,
        dexComplete,
        liveOpsSummary: liveOpsResult.summary,
        rewardEntries: liveOpsResult.rewardEntries,
        summary: {
          title: `Caught ${wild.nickname}!`,
          cta: "Continue Exploring",
          rewards: liveOpsResult.rewardEntries,
        },
      },
      battleEnded: true,
    };
  }

  const wildMove = wild.moves[Math.floor(Math.random() * wild.moves.length)];
  const wildMoveData = MOVES[wildMove];
  const catchEvents = [];

  if (wildMoveData?.power > 0) {
    const effectiveness = getEffectivenessMultiplier(wildMoveData.type, playerEwamon.speciesId);
    const dmg = calcDamage(wild, playerEwamon, wildMove);
    playerEwamon.hp = Math.max(0, playerEwamon.hp - dmg);
    catchEvents.push({ type: "wild_attack", move: wildMove, moveType: wildMoveData.type, attackerSlot: "wild", targetSlot: "player", damage: dmg, targetHp: playerEwamon.hp, targetStatus: getMajorStatus(playerEwamon), targetStatuses: getStatuses(playerEwamon), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: wild.nickname, targetName: playerEwamon.nickname, msg: `${getOpponentLabel(battle, wild)} used ${wildMove}! (${dmg} dmg)` });
  } else {
    const effectiveness = getEffectivenessMultiplier(wildMoveData.type, playerEwamon.speciesId);
    catchEvents.push({ type: "wild_attack", move: wildMove, moveType: wildMoveData.type, attackerSlot: "wild", targetSlot: "player", damage: 0, targetHp: playerEwamon.hp, targetStatus: getMajorStatus(playerEwamon), targetStatuses: getStatuses(playerEwamon), effectiveness, effectivenessLabel: describeEffectiveness(effectiveness), attackerName: wild.nickname, targetName: playerEwamon.nickname, msg: `${getOpponentLabel(battle, wild)} used ${wildMove}!` });
  }

  const playerFainted = playerEwamon.hp <= 0;
  if (playerFainted) {
    const hasBackup = battle.party.findIndex((ewamon, index) => index !== battle.activeIndex && ewamon.hp > 0) !== -1;
    catchEvents.push({ type: "player_fainted", targetSlot: "player", msg: hasBackup ? `${playerEwamon.nickname} fainted! Choose another Ewamon.` : `${playerEwamon.nickname} fainted! You fled!` });
  }

  dbPlayer.party = battle.party;
  await dbPlayer.save();

  return {
    payload: {
      battleId: battle.id,
      success: false,
      reason: "broke_free",
      catchEvents,
      playerHp: playerEwamon.hp,
      wild,
      playerEwamon: normalizePartyEwamon(playerEwamon),
      playerFainted,
      mustSwitch: playerFainted && battle.party.findIndex((ewamon, index) => index !== battle.activeIndex && ewamon.hp > 0) !== -1,
      party: battle.party,
      activeIndex: battle.activeIndex,
      liveOpsSummary: buildCompactLiveOpsSummary(dbPlayer),
    },
    battleEnded: playerFainted && battle.party.findIndex((ewamon, index) => index !== battle.activeIndex && ewamon.hp > 0) === -1,
  };
}

async function useWildItem({ battle, playerId, itemId }) {
  const playerEwamon = getPlayerEwamon(battle);
  battle.playerEwamon = playerEwamon;
  const events = [];
  const dbPlayer = await Player.findById(playerId);
  ensureLiveOpsState(dbPlayer);
  if (!(dbPlayer.inventory instanceof Map)) dbPlayer.inventory = new Map(Object.entries(dbPlayer.inventory || {}));
  const qty = dbPlayer.inventory.get(itemId) || 0;
  if (qty <= 0) return { payload: { battleId: battle.id, success: false, msg: "You don't have that item!" } };

  if (itemId === "potion") {
    if (playerEwamon.hp >= playerEwamon.maxHp) return { payload: { battleId: battle.id, success: false, msg: "Already at full HP!" } };
    const healed = Math.min(20, playerEwamon.maxHp - playerEwamon.hp);
    playerEwamon.hp += healed;
    events.push({ type: "item_use", actorSlot: "player", targetSlot: "player", itemId, healed, targetHp: playerEwamon.hp, msg: `Used Potion! ${playerEwamon.nickname} recovered ${healed} HP!` });
  } else if (itemId === "superpotion") {
    if (playerEwamon.hp >= playerEwamon.maxHp) return { payload: { battleId: battle.id, success: false, msg: "Already at full HP!" } };
    const healed = Math.min(50, playerEwamon.maxHp - playerEwamon.hp);
    playerEwamon.hp += healed;
    events.push({ type: "item_use", actorSlot: "player", targetSlot: "player", itemId, healed, targetHp: playerEwamon.hp, msg: `Used Super Potion! ${playerEwamon.nickname} recovered ${healed} HP!` });
  } else if (itemId === "rarecandy") {
    const result = applyRareCandyLevel(playerEwamon, dbPlayer.collection, dbPlayer.seen);
    events.push({ type: "item_use", actorSlot: "player", targetSlot: "player", itemId, newLevel: playerEwamon.level, msg: `Used Rare Candy! ${playerEwamon.nickname} grew to Lv.${playerEwamon.level}!` });
    if (result.evolution) {
      events.push({ type: "evolution", targetSlot: "player", msg: `${result.evolution.nickname} evolved into ${result.evolution.to}!`, evolution: result.evolution });
    }
  } else {
    return { payload: { battleId: battle.id, success: false, msg: "Can't use that item here!" } };
  }

  dbPlayer.inventory.set(itemId, qty - 1);
  dbPlayer.party = battle.party;
  if (itemId !== "rarecandy") applyLiveOpsEvent(dbPlayer, "heal");
  await dbPlayer.save();
  return {
    payload: {
      battleId: battle.id,
      success: true,
      events,
      playerHp: playerEwamon.hp,
      playerEwamon: normalizePartyEwamon(playerEwamon),
      party: battle.party,
      activeIndex: battle.activeIndex,
      inventory: Object.fromEntries(dbPlayer.inventory),
      liveOpsSummary: buildCompactLiveOpsSummary(dbPlayer),
    },
  };
}

async function switchWildParty({ battle, playerId, partyIndex }) {
  const party = battle.party || [];
  if (!party[partyIndex]) return { error: { msg: "Invalid party slot" } };
  if (partyIndex === battle.activeIndex) return { payload: { battleId: battle.id, success: false, msg: "That Ewamon is already active!" } };

  const target = party[partyIndex];
  if (target.hp <= 0) return { payload: { battleId: battle.id, success: false, msg: "That Ewamon has fainted!" } };

  // Determine forced (post-faint) vs voluntary. A forced switch is free; a
  // voluntary one costs a turn — the switch resolves with priority, then the
  // opposing wild Ewamon (or trainer's active Ewamon) attacks the new active.
  const outgoing = party[battle.activeIndex];
  const isForcedSwitch = !outgoing || outgoing.hp <= 0;

  const events = [];

  // Step 1 — switch (priority)
  battle.activeIndex = partyIndex;
  battle.playerEwamon = party[partyIndex];
  const newActive = party[partyIndex];
  events.push({
    type: "switch",
    actorSlot: "player",
    targetSlot: "player",
    speciesId: newActive.speciesId,
    msg: `Go, ${newActive.nickname}!`,
  });

  // Forced post-faint switch — no enemy turn, just like the old behavior and
  // the PvP `room.awaitingSwitch` path.
  if (isForcedSwitch) {
    await persistBattleParty(playerId, battle);
    return {
      payload: {
        battleId: battle.id,
        success: true,
        newEwamon: normalizePartyEwamon(newActive),
        party: battle.party,
        activeIndex: battle.activeIndex,
        events,
      },
    };
  }

  // Step 2 — opposing Ewamon's turn against the new active.
  const { wild } = battle;
  const opponentLabel = getOpponentLabel(battle, wild);

  if (wild && wild.hp > 0 && Array.isArray(wild.moves) && wild.moves.length > 0) {
    const wildMove = wild.moves[Math.floor(Math.random() * wild.moves.length)];
    const wildMoveData = MOVES[wildMove];
    if (wildMoveData) {
      if (wildMoveData.power > 0) {
        const effectiveness = getEffectivenessMultiplier(wildMoveData.type, newActive.speciesId);
        const dmg = calcDamage(wild, newActive, wildMove);
        newActive.hp = Math.max(0, newActive.hp - dmg);
        events.push({
          type: "wild_attack",
          move: wildMove,
          moveType: wildMoveData.type,
          attackerSlot: "wild",
          targetSlot: "player",
          damage: dmg,
          targetHp: newActive.hp,
          targetStatus: getMajorStatus(newActive),
          targetStatuses: getStatuses(newActive),
          effectiveness,
          effectivenessLabel: describeEffectiveness(effectiveness),
          attackerName: wild.nickname,
          targetName: newActive.nickname,
          msg: `${opponentLabel} used ${wildMove}! (${dmg} dmg)`,
        });
      } else {
        const effectiveness = getEffectivenessMultiplier(wildMoveData.type, newActive.speciesId);
        events.push({
          type: "wild_attack",
          move: wildMove,
          moveType: wildMoveData.type,
          attackerSlot: "wild",
          targetSlot: "player",
          damage: 0,
          targetHp: newActive.hp,
          targetStatus: getMajorStatus(newActive),
          targetStatuses: getStatuses(newActive),
          effectiveness,
          effectivenessLabel: describeEffectiveness(effectiveness),
          attackerName: wild.nickname,
          targetName: newActive.nickname,
          msg: `${opponentLabel} used ${wildMove}!`,
        });
      }
      if (wildMoveData.effect) applyMoveEffect(wildMoveData.effect, wild, newActive, events, "wild", "player");
    }
    battle.turn++;
  }

  // Step 3 — did the new active just get KO'd by the response hit?
  if (newActive.hp <= 0) {
    const hasReserve = battle.party.some((ewamon, index) => index !== battle.activeIndex && ewamon.hp > 0);
    await persistBattleParty(playerId, battle);
    if (hasReserve) {
      events.push({ type: "player_fainted", targetSlot: "player", msg: `${newActive.nickname} fainted! Choose another Ewamon.` });
      return {
        payload: {
          battleId: battle.id,
          success: true,
          newEwamon: normalizePartyEwamon(newActive),
          party: battle.party,
          activeIndex: battle.activeIndex,
          events,
          wildHp: wild.hp,
          playerHp: 0,
          wild,
          playerEwamon: normalizePartyEwamon(newActive),
          playerFainted: true,
          mustSwitch: true,
        },
      };
    }
    events.push({ type: "player_fainted", targetSlot: "player", msg: `${newActive.nickname} fainted! You fled!` });
    return {
      payload: {
        battleId: battle.id,
        success: true,
        newEwamon: normalizePartyEwamon(newActive),
        party: battle.party,
        activeIndex: battle.activeIndex,
        events,
        wildHp: wild.hp,
        playerHp: 0,
        wild,
        playerEwamon: normalizePartyEwamon(newActive),
        playerFainted: true,
      },
      battleEnded: true,
    };
  }

  await persistBattleParty(playerId, battle);
  return {
    payload: {
      battleId: battle.id,
      success: true,
      newEwamon: normalizePartyEwamon(newActive),
      party: battle.party,
      activeIndex: battle.activeIndex,
      events,
      wildHp: wild?.hp,
      playerHp: newActive.hp,
      wild,
      playerEwamon: normalizePartyEwamon(newActive),
      wildStatus: wild ? getMajorStatus(wild) : null,
      wildStatuses: wild ? getStatuses(wild) : [],
      playerPp: normPp(newActive.pp),
    },
  };
}

async function useLegacyWildItem({ battle, playerId, itemId }) {
  const playerEwamon = getPlayerEwamon(battle);
  battle.playerEwamon = playerEwamon;
  const dbPlayer = await Player.findById(playerId);
  ensureLiveOpsState(dbPlayer);
  if (!(dbPlayer.inventory instanceof Map)) dbPlayer.inventory = new Map(Object.entries(dbPlayer.inventory || {}));
  const qty = dbPlayer.inventory.get(itemId) || 0;
  if (qty <= 0) return { payload: { battleId: battle.id, success: false, msg: `No ${itemId} left!` } };

  const healAmt = itemId === "superpotion" ? 50 : 20;
  const oldHp = playerEwamon.hp;
  playerEwamon.hp = Math.min(playerEwamon.maxHp, playerEwamon.hp + healAmt);
  const healed = playerEwamon.hp - oldHp;

  dbPlayer.inventory.set(itemId, qty - 1);
  dbPlayer.party = battle.party;
  applyLiveOpsEvent(dbPlayer, "heal");
  await dbPlayer.save();

  return {
    payload: {
      battleId: battle.id,
      success: true,
      playerHp: playerEwamon.hp,
      playerMaxHp: playerEwamon.maxHp,
      party: battle.party,
      activeIndex: battle.activeIndex,
      events: [{ type: "item_use", actorSlot: "player", targetSlot: "player", itemId, healed, targetHp: playerEwamon.hp, msg: `Used ${itemId === "superpotion" ? "Super Potion" : "Potion"} on ${playerEwamon.nickname}! +${healed} HP` }],
      liveOpsSummary: buildCompactLiveOpsSummary(dbPlayer),
    },
  };
}

module.exports = {
  resolveWildMove,
  attemptCatch,
  useWildItem,
  switchWildParty,
  useLegacyWildItem,
};
