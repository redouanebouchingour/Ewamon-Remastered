/**
 * The whole @ewa/persist schema (§5.1): 17 tables + 5 enums, plus the later migrations' tables. drizzle.config.ts globs this folder;
 * every table must be exported from here so `drizzle-kit generate` sees it.
 */
export * from './enums';
export * from './players';
export * from './creatures';
export * from './inventory';
export * from './progress';
export * from './social';
export * from './market';
export * from './history';
export * from './auth';
export * from './audit';
export * from './streaks';
export * from './daily';
export * from './runs';
export * from './seasons';
export * from './worldHonor';
export * from './factions';
export * from './legends';
export * from './ghosts';
export * from './breeding';
