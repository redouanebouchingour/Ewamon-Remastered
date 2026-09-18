/**
 * The only migration runner (§5.4): `pnpm --filter @ewa/persist db:migrate`.
 * DATABASE_URL set → node-postgres; unset → an in-memory PGlite, which only proves the SQL applies.
 */
import process from 'node:process';
import { createDb, runMigrations } from './db';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  const db = await createDb(url ? { url } : {});
  try {
    await runMigrations(db);
    process.stdout.write(`migrations applied (${db.kind}${url ? '' : ', in-memory — set DATABASE_URL for a real database'})\n`);
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
