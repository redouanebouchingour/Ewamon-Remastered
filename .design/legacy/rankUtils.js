const DEFAULT_RATING = 1000;
const MIN_RATING = 0;

const RANK_TIERS = [
  { key: "bronze", label: "Bronze", minRating: 0 },
  { key: "silver", label: "Silver", minRating: 1100 },
  { key: "gold", label: "Gold", minRating: 1250 },
  { key: "platinum", label: "Platinum", minRating: 1400 },
  { key: "diamond", label: "Diamond", minRating: 1600 },
  { key: "master", label: "Master", minRating: 1800 },
];

function clampRating(value) {
  const rating = Number.isFinite(Number(value)) ? Math.round(Number(value)) : DEFAULT_RATING;
  return Math.max(MIN_RATING, rating);
}

function getTierForRating(rating) {
  const normalizedRating = clampRating(rating);
  for (let index = RANK_TIERS.length - 1; index >= 0; index -= 1) {
    if (normalizedRating >= RANK_TIERS[index].minRating) return RANK_TIERS[index];
  }
  return RANK_TIERS[0];
}

function normalizePvpRank(rawRank = null) {
  const rating = clampRating(rawRank?.rating);
  const peakRating = Math.max(rating, clampRating(rawRank?.peakRating));
  const tier = getTierForRating(rating);
  const nextTier = RANK_TIERS.find(candidate => candidate.minRating > rating) || null;

  return {
    rating,
    peakRating,
    lastDelta: Number.isFinite(Number(rawRank?.lastDelta)) ? Math.round(Number(rawRank.lastDelta)) : 0,
    tierKey: tier.key,
    tierLabel: tier.label,
    nextTierKey: nextTier?.key || null,
    nextTierLabel: nextTier?.label || null,
    nextTierRating: nextTier?.minRating ?? null,
  };
}

function getDefaultPvpRank() {
  return normalizePvpRank();
}

function getPlayerRating(player) {
  return normalizePvpRank(player?.pvpRank).rating;
}

function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + (10 ** ((opponentRating - playerRating) / 400)));
}

function getKFactor(matchCount = 0) {
  if (matchCount < 10) return 40;
  if (matchCount < 30) return 32;
  return 24;
}

function calculateRankedBattleResult({
  winnerRating,
  loserRating,
  winnerMatches = 0,
  loserMatches = 0,
}) {
  const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
  const expectedLoser = calculateExpectedScore(loserRating, winnerRating);
  const winnerK = getKFactor(winnerMatches);
  const loserK = getKFactor(loserMatches);
  const winnerDelta = Math.max(10, Math.round(winnerK * (1 - expectedWinner)));
  const loserDelta = Math.max(10, Math.round(loserK * (0 - expectedLoser)));

  return {
    winnerDelta,
    loserDelta,
  };
}

function applyRankDelta(player, delta) {
  const current = normalizePvpRank(player?.pvpRank);
  const rating = clampRating(current.rating + delta);
  const peakRating = Math.max(current.peakRating, rating);
  const next = normalizePvpRank({
    rating,
    peakRating,
    lastDelta: delta,
  });

  if (player) {
    player.pvpRank = {
      rating: next.rating,
      peakRating: next.peakRating,
      lastDelta: next.lastDelta,
      tierKey: next.tierKey,
      tierLabel: next.tierLabel,
    };
  }

  return { before: current, after: next };
}

function buildRankChangeSummary(beforeRank, afterRank) {
  const delta = afterRank.rating - beforeRank.rating;
  const tierChanged = beforeRank.tierKey !== afterRank.tierKey;
  return {
    delta,
    tierChanged,
    previousTierKey: beforeRank.tierKey,
    previousTierLabel: beforeRank.tierLabel,
    tierKey: afterRank.tierKey,
    tierLabel: afterRank.tierLabel,
    rating: afterRank.rating,
    peakRating: afterRank.peakRating,
  };
}

module.exports = {
  DEFAULT_RATING,
  RANK_TIERS,
  getTierForRating,
  normalizePvpRank,
  getDefaultPvpRank,
  getPlayerRating,
  calculateRankedBattleResult,
  applyRankDelta,
  buildRankChangeSummary,
};
