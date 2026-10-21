/**
 * Dev tool for the bounty board (content bounties.ts): give a ghost a record and post the game's bounties now.
 *
 *   pnpm --filter @ewa/server bounty wins <username> <n>   (n won fights by n different trainers, then post)
 *   pnpm --filter @ewa/server bounty post                  (post the game's bounties now, as the schedule would)
 *   pnpm --filter @ewa/server bounty list                  (the open posters)
 *   (env: DATA_DIR · PGlite at DATA_DIR/pglite, default ./.data · or DATABASE_URL)
 *
 * `wins` needs the trainer's ghost (they left the world). A running server sees new posters on its next board read
 * and its zone rooms within a minute. PGlite allows one process: stop the server that holds the database first, a
 * second writer opens silently and corrupts the WAL.
 */
import { resolve } from 'node:path';
import { createDb, createRepos, runMigrations } from '@ewa/persist';
import { postGameBounties } from '../src/game/bounties';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`bounty: ${msg}`);
  console.error('usage: bounty wins <username> <n> | bounty post | bounty list  (env: DATA_DIR | DATABASE_URL)');
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, name, count] = process.argv.slice(2);
  if (cmd !== 'wins' && cmd !== 'post' && cmd !== 'list') usage();
  const url = process.env['DATABASE_URL'];
  const db = await createDb(url !== undefined ? { url } : { pgliteDir: resolve(process.env['DATA_DIR'] ?? './.data', 'pglite') });
  await runMigrations(db);
  const repos = createRepos(db);
  const now = Date.now();

  if (cmd === 'wins') {
    const n = Number(count);
    if (name === undefined || !Number.isInteger(n) || n < 1 || n > 200) usage('wins needs <username> <n> (1..200)');
    const ok = await db.transaction(async (tx) => {
      const p = await repos.players.byUsername(tx, name.toLowerCase());
      const g = p === null ? null : await repos.ghosts.of(tx, p.id);
      if (g === null) return false;
      for (let i = 0; i < n; i++) await repos.ghosts.record(tx, g.playerId, `rival_${i + 1}`, g.zoneId, true, new Date(now - (n - i) * 1000));
      return true;
    });
    if (!ok) usage(`'${name}' has no ghost (they must leave the world first)`);
  }
  if (cmd !== 'list') console.log(`posted or raised: ${await db.transaction((tx) => postGameBounties(repos, tx, now))}`);
  const open = await db.transaction((tx) => repos.bounties.open(tx, new Date(now), 40));
  for (const b of open) console.log(`  ${b.kind.padEnd(6)} ${b.targetName.padEnd(20)} ${String(b.reward).padStart(6)}  ${b.zoneId}  ${b.posterName ?? 'the board'}  until ${b.expiresAt.toISOString()}`);
  if (open.length === 0) console.log('  (no open posters)');
  process.exit(0);
}

void main();
