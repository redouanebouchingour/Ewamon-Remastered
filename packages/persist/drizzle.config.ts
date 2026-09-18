import { defineConfig } from 'drizzle-kit';

/**
 * `pnpm --filter @ewa/persist db:generate` diffs ./src/schema against the snapshots in ./drizzle
 * and writes a new SQL migration. Generation needs no database (no dbCredentials); only
 * `db:migrate` (src/migrate.ts) connects, and it reads DATABASE_URL itself.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
