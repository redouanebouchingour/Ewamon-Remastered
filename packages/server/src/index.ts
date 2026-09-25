/**
 * @ewa/server — the authoritative game server (SPEC §30). `main.ts` is the process entry; this module
 * exports the pieces tests and tools (the netcode harness contract, §30.10.3) compose.
 */
export { boot } from './server';
export type { Booted } from './server';
export { EnvSchema, parseEnv, testEnv } from './env';
export type { Env } from './env';
export type { ServerDeps, Runtime, RoomDeps, AccessClaims, BanCache } from './deps';
export { createLogger, silentLogger } from './log';
export { buildRest } from './rest/app';
export { LIMITS, allow, createLimiterState, localRateLimiter, presenceRateLimiter, shouldNotify } from './rest/rateLimit';
export { ARGON2, hashPassword, verifyPassword } from './rest/auth';
export { AoiGrid, AOI_CELL, cellOf, neighbours } from './rooms/aoi';
export { validateInput, WALK_SPEED, RUN_SPEED, SPEED_TOLERANCE, MAX_WALK_STEP, MAX_RUN_STEP, BUDGET_MIN_MS, BUDGET_MAX_MS } from './rooms/movement';
export { SpawnDirector, tuningFor } from './rooms/spawnDirector';
export type { SpawnRecord, LiveOpsMods } from './rooms/spawnDirector';
export { ChallengeStore, CHALLENGE_TTL_MS } from './rooms/challengeStore';
export { PresenceStore } from './rooms/presenceStore';
export { BattleCoordinator, TURN_DEADLINE_MS, REPLACEMENT_DEADLINE_MS, CHAMPION_ID } from './rooms/battleSession';
export { ZoneRoom, bindZoneRoom } from './rooms/ZoneRoom';
export type { ZoneMeta, ZoneJoinOptions, ZoneAuth, ZoneUserData } from './rooms/ZoneRoom';
export { sanitizeChat, censor, containsBlocked, normalizeLeet } from './chat/filter';
export { BLOCKED_WORDS, LEET_MAP } from './chat/blocklist';
export { PresenceMirror } from './rooms/presenceMirror';
export { TradeSession, TradeCoordinator, TRADE_IDLE_MS } from './rooms/tradeSession';
export { RaidSession, RaidRunner, RAID_ROUND_MS, RAID_LOBBY_MS, RAID_MAX_PLAYERS, RAID_CATCH_WINDOW_MS, RAID_ENRAGE_HP, RAID_ENRAGE_ATK_STAGES } from './rooms/raidSession';
export type { RaidView, RaidPhase } from './rooms/raidSession';
export { runMarketExpiry, startMarketExpiry, MARKET_EXPIRY_MS } from './jobs/marketExpiry';
export { DAILY_MISSIONS, WEEKLY_GOALS, LOGIN_STREAK, dailyMissionsFor } from './liveops/missions';
export type { DailyMission, DailyMetric } from './liveops/missions';
export { liveOpsModsFor, liveOpsSummary, hotspotOpen, dayKey, weekKey } from './liveops/schedule';
export { dailyLogin } from './liveops/login';
export { rolloverTick, startLiveOpsRollover } from './liveops/rollover';
export { MetricsRegistry, createRoomMetrics, rollRoomMetrics, percentile, timedDb } from './metrics';
export type { RoomMetrics, ProcessMetrics } from './metrics';
export { checkRun, checkScaling, powerLawExponent, quadraticModel, PLAYER_DELTA_BYTES, EXPONENT_MAX, QUADRATIC_SHARE_MAX, TICK_P99_MAX_MS } from './netcode/harness';
export type { ClientSample, HarnessRun, RunReport } from './netcode/harness';
