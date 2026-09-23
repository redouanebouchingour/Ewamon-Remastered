/**
 * @ewa/server — the authoritative game server (SPEC §30). `main.ts` is the process entry; this module
 * exports the pieces tests and tools (netcode harness, part 2) compose.
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
export { sanitizeChat, censor, containsBlocked } from './chat/filter';
