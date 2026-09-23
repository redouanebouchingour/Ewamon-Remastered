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
  /** not configurable in v1; present so the value is visible */
  TICK_HZ: z.literal('20').default('20'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  /** dev only: sets is_admin on this username at boot */
  ADMIN_BOOTSTRAP_USERNAME: z.string().optional(),
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
    ...overrides,
  });
}
