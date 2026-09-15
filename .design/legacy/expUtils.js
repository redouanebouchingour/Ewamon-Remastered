const Player = require("../models/Player");
const { EWAMON_SPECIES, MOVES, calcStat, calcMaxHp } = require("../data/ewamon");

const MAX_LEVEL = 100;

const normPp = pp => pp instanceof Map ? Object.fromEntries(pp) : (pp || {});

function recalcEwamonStats(ewamon, species) {
  if (!species) return;
  const newMaxHp = calcMaxHp(species.baseHp, ewamon.level);
  ewamon.hp = Math.min(ewamon.hp + Math.max(0, newMaxHp - (ewamon.maxHp || 0)), newMaxHp);
  ewamon.maxHp = newMaxHp;
  ewamon.atk = calcStat(species.baseAtk, ewamon.level);
  ewamon.def = calcStat(species.baseDef, ewamon.level);
  ewamon.spd = calcStat(species.baseSpd, ewamon.level);
}

function resolveEvolutionTarget(ewamon, sp) {
  if (sp.splitEvolvesInto) {
    // Check conditional branches first, then fall through to default
    for (const branch of sp.splitEvolvesInto) {
      if (!branch.condition) return branch.into; // default branch
      if (branch.condition === "ability" && ewamon.selectedAbility === branch.value) {
        return branch.into;
      }
    }
    return null;
  }
  return sp.evolvesInto || null;
}

function tryEvolveEwamon(ewamon, collection, seen) {
  const sp = EWAMON_SPECIES[ewamon.speciesId];
  const canEvolve = (sp?.evolvesInto || sp?.splitEvolvesInto) && sp.evolvesAt && ewamon.level >= sp.evolvesAt;
  if (!canEvolve) return null;

  const targetId = resolveEvolutionTarget(ewamon, sp);
  const evolved = EWAMON_SPECIES[targetId];
  if (!evolved) return null;

  const from = ewamon.speciesId;
  const prevNickname = ewamon.nickname;
  ewamon.speciesId = targetId;
  if (prevNickname === sp.name) ewamon.nickname = evolved.name;
  ewamon.moves = evolved.moves.slice(0, 4);
  ewamon.pp = new Map(evolved.moves.slice(0, 4).map(m => [m, MOVES[m]?.pp || 20]));
  recalcEwamonStats(ewamon, evolved);

  if (collection && !collection.includes(targetId)) {
    collection.push(targetId);
  }
  if (seen && !seen.includes(targetId)) {
    seen.push(targetId);
  }

  return {
    from,
    to: targetId,
    nickname: ewamon.nickname,
    previousNickname: prevNickname,
  };
}

function applyRareCandyLevel(ewamon, collection, seen) {
  if (ewamon.level >= MAX_LEVEL) {
    return { levelUp: null, evolution: null };
  }
  ewamon.level += 1;
  ewamon.exp = 0;
  ewamon.expToNext = ewamon.level * 100;
  recalcEwamonStats(ewamon, EWAMON_SPECIES[ewamon.speciesId]);
  return {
    levelUp: { nickname: ewamon.nickname, level: ewamon.level },
    evolution: tryEvolveEwamon(ewamon, collection, seen),
  };
}

async function distributeExpAndEvolve(playerId, earnedExp, wildLevel = 1) {
  const player = await Player.findById(playerId);
  if (!player) return { evolutions: [], levelUps: [], goldEarned: 0 };
  const evolutions = [], levelUps = [];
  const goldEarned = wildLevel * 5 + Math.floor(Math.random() * 21) + 10;
  player.money = (player.money || 0) + goldEarned;
  for (const ewamon of player.party) {
    if (ewamon.hp <= 0) continue;
    ewamon.exp = (ewamon.exp || 0) + earnedExp;
    while (ewamon.exp >= ewamon.expToNext && ewamon.level < MAX_LEVEL) {
      ewamon.exp -= ewamon.expToNext;
      ewamon.level += 1;
      ewamon.expToNext = ewamon.level * 100;
      recalcEwamonStats(ewamon, EWAMON_SPECIES[ewamon.speciesId]);
      levelUps.push({ nickname: ewamon.nickname, level: ewamon.level });
      const evolution = tryEvolveEwamon(ewamon, player.collection, player.seen);
      if (evolution) evolutions.push(evolution);
    }
  }
  player.trainerExp = (player.trainerExp || 0) + Math.floor(earnedExp / 2);
  player.trainerLevel = Math.floor(player.trainerExp / 1000) + 1;
  await player.save();
  return { evolutions, levelUps, goldEarned };
}

module.exports = { distributeExpAndEvolve, recalcEwamonStats, tryEvolveEwamon, applyRareCandyLevel, normPp };
