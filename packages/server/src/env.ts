/**
 * §30.1.2 Environment — zod-parsed `process.env`. `parseEnv` throws at boot on any invalid value; nothing
 * else in the server reads `process.env`.
 */
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT_WS: z.coerce.number().int().min(0).max(65535).default(2567),
  PORT_REST: z.coerce.number().int().min(0).max(65535).default(4000),
  /** host[:port] the SDK should reach; required when REDIS_URL is set */
  PUBLIC_ADDRESS: z.string().min(1).optional(),
  /** absent → PGlite at DATA_DIR/pglite (dev/test only; refused in production) */
  DATABASE_URL: z.string().url().optional(),
  DATA_DIR: z.string().min(1).default('./.data'),
  REDIS_URL: z.string().url().optional(),
  /** ≥ 32 bytes; no default, boot fails without it */
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_S: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TTL_D: z.coerce.number().int().min(1).max(90).default(30),
  /** comma-separated exact origins */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.union([z.literal('false'), z.literal('loopback'), z.string()]).default('loopback'),
  /** world rng seed; absent → fnv1a32(`${processId}:${bootMs}`) logged at boot */
  SERVER_SEED: z.string().min(1).optional(),
  ZONE_CAPACITY: z.coerce.number().int().min(2).max(500).default(200),
  /** Phase D7: the scheduled overworld weather ('off' keeps every zone at 'none'; testEnv defaults to 'off' so room tests stay clock-independent) */
  WORLD_WEATHER: z.enum(['on', 'off']).default('on'),
  /** Ranked seasons: the job that closes an ended season ('off' in testEnv, so a test clock crossing a season never resets ratings) */
  SEASON_ROLLOVER: z.enum(['on', 'off']).default('on'),
  /**
   * The roaming legendary and ghost trainers in tall grass ('off' in testEnv, so a grass test meets only the zone's
   * own table; their own tests call the room's encounter methods directly)
   */
  ROAMING_ENCOUNTERS: z.enum(['on', 'off']).default('on'),
  /**
   * Wild creatures: 'grass' (the default since 2026-10-20) = none stand in the overworld, walking in tall grass or surfing
   * rolls a random encounter; 'overworld' = the visible spawn director (§30.3). testEnv keeps 'overworld' for the suites
   * and the progression walker written against visible spawns.
   */
  WILD_ENCOUNTERS: z.enum(['grass', 'overworld']).default('grass'),
  /** 'on' = an unbeaten trainer who sees the player starts the fight (the default); testEnv keeps 'off'. */
  TRAINER_SIGHT: z.enum(['on', 'off']).default('on'),
  /**
   * Nemeses (content nemesis.ts): 'on' (the default) = a wild creature that beats or escapes a player may rise as their
   * nemesis and ambush them later; 'off' = never (testEnv, so wild battles end as they always did); 'always' = every
   * qualifying escape promotes and every grass / surf encounter that can be an ambush is one (dev and live checks).
   */
  NEMESES: z.enum(['on', 'off', 'always']).default('on'),
  /**
   * A living ecosystem (content ecosystem.ts): 'on' (the default) = wild catches and knockouts are tallied per zone and
   * week, and each zone rolls its encounters on this week's table (food chain pressure, the season's migrants, the honor
   * tilt); 'off' = nothing is tallied and every zone rolls its authored table (testEnv, so the progression walker and
   * the spawn / encounter tests and pins see today's tables).
   */
  ECOSYSTEM: z.enum(['on', 'off']).default('on'),
  /**
   * The bounty board (content bounties.ts): 'on' (the default) = the board posts the game's bounties, a beaten ghost or
   * nemesis is claimed and paid, and a wanted ghost steps out of its zone's grass more often; 'off' = the board reads
   * empty, posting is refused and fights end as they always did (testEnv, so the walker and the ghost / nemesis tests
   * see today's behaviour); 'always' = a wanted ghost steps out of every grass encounter it can (live checks).
   */
  BOUNTIES: z.enum(['on', 'off', 'always']).default('on'),
  /**
   * NPC talk's tools (`POST /npc/act`): 'on' = an NPC in the player's zone can give / take money and Ewamon;
   * 'off' = refused (409 npcToolsOff). Unset = on except in production, where anyone could call the route without the
   * local model.
   */
  NPC_TOOLS: z.enum(['on', 'off']).optional(),
  /**
   * Followers with field powers (content fieldPowers.ts, SPEC §3.18): 'on' (the default) = a Flying lead glides off a
   * cliff (movement validation accepts the glide line), unburnt brambles block like hall gates, and the burn / dig / dive /
   * sense powers work; 'off' = the world moves as it always did and every power is refused (testEnv, so the progression
   * walker's movement and the handover-landing tests see today's world). The follower itself is visual and always on.
   */
  FIELD_POWERS: z.enum(['on', 'off']).default('on'),
  /**
   * Camp bases (content camps.ts, SPEC §3.19): 'on' (the default) = a route's travellers' camp can be claimed, decorated
   * and raided (a fight with the owner's guard, the cut, the honor hit, the shadow deed, the held points); 'off' = the
   * camps stand empty: nothing can be claimed, edited or raided and the zone shows no owner (testEnv, so the walker and
   * every other test see today's world).
   */
  CAMPS: z.enum(['on', 'off']).default('on'),
  /** not configurable in v1; present so the value is visible */
  TICK_HZ: z.literal('20').default('20'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  /** dev only: sets is_admin on this username at boot */
  ADMIN_BOOTSTRAP_USERNAME: z.string().optional(),
  // ---- Phase C6 mail (password reset + email verification) ----
  /** `smtp(s)://user:pass@host:port` — wins over the SMTP_HOST group. Neither set → mail is written as .eml under DATA_DIR/mail. */
  SMTP_URL: z.string().url().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  /** 'true' = implicit TLS (port 465); default: STARTTLS when the server offers it */
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  MAIL_FROM: z.string().min(3).default('Ewamon <no-reply@localhost>'),
  /** the web client's origin, for the links in emails (`${PUBLIC_WEB_URL}/reset?token=…`) */
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
});
export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and cross-checks the environment. `NODE_ENV=production` additionally requires `DATABASE_URL`,
 * `PUBLIC_ADDRESS` when `REDIS_URL` is set, refuses `ADMIN_BOOTSTRAP_USERNAME` and a `*` CORS origin (§30.6.1).
 */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const env = EnvSchema.parse(source);
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.DATABASE_URL === undefined) problems.push('DATABASE_URL is required in production (PGlite is dev/test only)');
    if (env.REDIS_URL !== undefined && env.PUBLIC_ADDRESS === undefined) problems.push('PUBLIC_ADDRESS is required when REDIS_URL is set');
    if (env.ADMIN_BOOTSTRAP_USERNAME !== undefined) problems.push('ADMIN_BOOTSTRAP_USERNAME is refused in production');
    if (corsOrigins(env).includes('*')) problems.push('CORS_ORIGINS may not contain * in production');
    if (problems.length > 0) throw new Error(`invalid environment: ${problems.join('; ')}`);
  }
  return env;
}

/** Phase C6: true when SMTP_URL or SMTP_HOST is set (else the dev .eml transport is used). */
export function smtpConfigured(env: Pick<Env, 'SMTP_URL' | 'SMTP_HOST'>): boolean {
  return env.SMTP_URL !== undefined || env.SMTP_HOST !== undefined;
}

/**
 * Non-fatal configuration findings logged at boot. Mail is optional by design (a deployment without SMTP still
 * runs; reset/verification emails then land as .eml files under DATA_DIR/mail), so production only WARNS.
 */
export function envWarnings(env: Env): string[] {
  const out: string[] = [];
  if (env.NODE_ENV !== 'production') return out;
  if (!smtpConfigured(env)) out.push('SMTP is not configured (SMTP_URL or SMTP_HOST): password-reset and verification emails are written to DATA_DIR/mail instead of being sent');
  if (smtpConfigured(env) && env.MAIL_FROM.includes('@localhost')) out.push('MAIL_FROM still uses the @localhost default');
  if (/^https?:\/\/(localhost|127\.)/.test(env.PUBLIC_WEB_URL)) out.push('PUBLIC_WEB_URL points at localhost: links in emails will not work for players');
  return out;
}

export function corsOrigins(env: Pick<Env, 'CORS_ORIGINS'>): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A complete test/dev environment with a fixed secret; tests override fields as needed. */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return EnvSchema.parse({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    SERVER_SEED: 'test-seed',
    LOG_LEVEL: 'error',
    WORLD_WEATHER: 'off',
    SEASON_ROLLOVER: 'off',
    ROAMING_ENCOUNTERS: 'off',
    WILD_ENCOUNTERS: 'overworld',
    TRAINER_SIGHT: 'off',
    NEMESES: 'off',
    ECOSYSTEM: 'off',
    BOUNTIES: 'off',
    FIELD_POWERS: 'off',
    CAMPS: 'off',
    ...overrides,
  });
}
