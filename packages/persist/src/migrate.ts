/**
 * The only migration runner (§5.4): `pnpm --filter @ewa/persist db:migrate` applies every pending migration to
 * DATABASE_URL (default: the dev database of docker-compose.yml, created when missing).
 */
import process from 'node:process';
import { createDb, runMigrations } from './db';
import { DEV_DATABASE_URL, ensureDatabase } from './scratch';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined) await ensureDatabase(DEV_DATABASE_URL);
  const db = await createDb({ url: url ?? DEV_DATABASE_URL });
  try {
    await runMigrations(db);
    process.stdout.write(`migrations applied${url === undefined ? ` (${DEV_DATABASE_URL})` : ''}\n`);
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
