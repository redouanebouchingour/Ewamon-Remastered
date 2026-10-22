/**
 * Dev tool for camp bases (content camps.ts): give a trainer one trophy of every kind to set at their camp, send an
 * owner "away" so a raider who wins takes the camp over, or list the camps.
 *
 *   pnpm --filter @ewa/server camp trophies <username>   (a nemesis beaten, a bounty brought in, an achievement claimed,
 *                                                         a Gold ranked peak; legendaries and the Champion's medal come
 *                                                         from play or seed:progression)
 *   pnpm --filter @ewa/server camp away <username> <days> (their last_seen_at that many days back)
 *   pnpm --filter @ewa/server camp list                   (every held camp, its guard and trophies)
 *   (env: DATA_DIR · PGlite at DATA_DIR/pglite, default ./.data · or DATABASE_URL)
 *
 * PGlite allows one process: stop the server that holds the database first, a second writer opens silently and
 * corrupts the WAL.
 */
import { resolve } from 'node:path';
import { ACHIEVEMENTS } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`camp: ${msg}`);
  console.error('usage: camp trophies <username> | camp away <username> <days> | camp list  (env: DATA_DIR | DATABASE_URL)');
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, name, days] = process.argv.slice(2);
  if (cmd !== 'trophies' && cmd !== 'away' && cmd !== 'list') usage();
  const url = process.env['DATABASE_URL'];
  const db = await createDb(url !== undefined ? { url } : { pgliteDir: resolve(process.env['DATA_DIR'] ?? './.data', 'pglite') });
  await runMigrations(db);
  const repos = createRepos(db);
  const now = new Date();
  const raw = async (text: string, params: unknown[]): Promise<void> => {
    if (db.kind === 'pglite') await db.client.query(text, params);
    else await db.pool.query(text, params);
  };

  if (cmd === 'trophies' || cmd === 'away') {
    if (name === undefined) usage(`${cmd} needs <username>`);
    const done = await db.transaction(async (tx) => {
      const p = await repos.players.byUsername(tx, name.toLowerCase());
      if (p === null) return false;
      if (cmd === 'away') {
        const d = Number(days);
        if (!Number.isFinite(d) || d < 0) usage('away needs <days>');
        return p.id;
      }
      const memory = { how: 'ko' as const, zoneId: 'tide_route', foeSpecies: 'dustcub', foeName: null, move: null, orb: null };
      const { nemesis } = await repos.nemeses.rise(
        tx,
        { ownerId: p.id, speciesId: 'brookrawl', level: 24, name: 'Murkjaw', title: 'the Drowned', scar: 'torn_ear', move: null, ability: 'torrent', variantKey: 'normal', isShiny: false, isAlpha: false, bornZone: 'tide_route', memory },
        3,
        now,
      );
      await repos.nemeses.end(tx, nemesis.id, 'beaten', 'mire_route', now);
      await repos.bounties.recordNemesis(tx, { targetName: 'Rootjaw the Slippery', speciesId: 'snapling', level: 20, zoneId: 'mire_route', rank: 2, reward: 800, claimerId: p.id, claimerName: p.username, payout: 800, bonus: false }, now);
      const ach = ACHIEVEMENTS[0]!;
      for (const o of ach.objectives) await repos.progress.advance(tx, p.id, ach.id, o.id, 1, true);
      await repos.progress.claim(tx, p.id, ach.id, now);
      return p.id;
    });
    if (done === false) usage(`no trainer '${name}'`);
    if (cmd === 'away') await raw('update players set last_seen_at = $2 where id = $1', [done, new Date(now.getTime() - Number(days) * 86_400_000)]);
    else await raw('update players set peak_rating = greatest(peak_rating, 1300) where id = $1', [done]);
    console.log(cmd === 'away' ? `${name} last seen ${days} days ago` : `${name}: a nemesis beaten, a bounty brought in, '${ACHIEVEMENTS[0]!.title}' claimed, a Gold ranked peak`);
  }
  const camps = await db.transaction((tx) => repos.camps.all(tx));
  for (const c of camps) console.log(`  ${c.zoneId.padEnd(16)} ${c.ownerName.padEnd(20)} ${c.name.padEnd(24)} guard Lv ${c.guardTop} (${c.guard.length})  ${c.trophies.map((t) => t.kind).join(', ') || 'no trophies'}`);
  if (camps.length === 0) console.log('  (no camps held)');
  process.exit(0);
}

void main();
