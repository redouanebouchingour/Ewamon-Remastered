/**
 * Dev tool for the living ecosystem (content ecosystem.ts): force pressure on a zone, and see what it does to the roll.
 *
 *   pnpm --filter @ewa/server eco take <zone> <species> <n> [--ko] [--last-week]
 *   pnpm --filter @ewa/server eco roll <zone> [n] [--night] [--water]
 *   (env: DATABASE_URL, default the dev database of docker-compose.yml)
 *
 * `take` adds `n` catches (or knockouts, `--ko`) of `species` to the zone's tally this week (or last week). `roll` reads
 * the zone's reading now, exactly as the zone room does (game/ecosystem.ts), and rolls `n` encounters (default 2000)
 * with the room's roll (`rollWild`) on the authored table and on this week's, on the same draws, printing both counts.
 * A running server picks a take up within a minute.
 */
import { ZONE_ORDER, createContentIndex, ecoWeek, encounterTableFor } from '@ewa/content';
import type { EncounterTable, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import { DEV_DATABASE_URL, createDb, createRepos, runMigrations } from '@ewa/persist';
import { readEcosystem } from '../src/game/ecosystem';
import { rollWild } from '../src/rooms/spawnDirector';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`eco: ${msg}`);
  console.error('usage: eco take <zone> <species> <n> [--ko] [--last-week] | eco roll <zone> [n] [--night] [--water]  (env: DATABASE_URL)');
  process.exit(2);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, zoneId, a, b] = argv.filter((x) => !x.startsWith('--'));
  if ((cmd !== 'take' && cmd !== 'roll') || zoneId === undefined) usage();
  if (!(ZONE_ORDER as readonly string[]).includes(zoneId) || encounterTableFor(zoneId as ZoneId) === null) usage(`'${zoneId}' is not a zone with wild creatures`);
  const zone = zoneId as ZoneId;
  const content = createContentIndex();
  const url = process.env['DATABASE_URL'];
  const db = await createDb({ url: url ?? DEV_DATABASE_URL });
  await runMigrations(db);
  const repos = createRepos(db);
  const now = Date.now();

  if (cmd === 'take') {
    const n = Number(b);
    if (a === undefined || !Number.isInteger(n) || n < 1 || n > 10_000) usage('take needs <species> <n> (1..10000)');
    try {
      content.species(a);
    } catch {
      usage(`unknown species '${a}'`);
    }
    const week = ecoWeek(now) - (argv.includes('--last-week') ? 1 : 0);
    const ko = argv.includes('--ko');
    await db.transaction((tx) => repos.ecosystem.add(tx, zone, week, a, ko ? 0 : n, ko ? n : 0));
    const rows = await db.transaction((tx) => repos.ecosystem.week(tx, zone, week));
    console.log(`${zoneId} week ${week}: ${rows.map((r) => `${r.speciesId} ${r.caught} caught / ${r.ko} ko`).join(', ')}`);
    process.exit(0);
  }

  const n = a === undefined ? 2000 : Number(a);
  if (!Number.isInteger(n) || n < 1 || n > 100_000) usage('n must be 1..100000');
  const time = argv.includes('--night') ? 0 : 0.5;
  const medium = argv.includes('--water') ? 'water' : 'land';
  const e = await db.transaction((tx) => readEcosystem(repos, tx, zone, now));
  const count = (t: EncounterTable): Map<string, number> => {
    const out = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const r = rollWild(t, medium, createRng(`eco-roll:${i}`), content, time, { x: 0, z: 0 }, `r${i}`, now);
      if (r !== null) out.set(r.speciesId, (out.get(r.speciesId) ?? 0) + 1);
    }
    return out;
  };
  const before = count(encounterTableFor(zone)!);
  const after = count(e!.table);
  console.log(`${zoneId}: ${e!.takes} takes this week (judged: ${e!.judged}), season ${e!.season}, shadow ${e!.shadow}, light ${e!.light}, migrants in: ${e!.migrantsIn.map((m) => m.species).join(', ') || 'none'}`);
  console.log(`${n} ${medium} rolls at ${time === 0 ? 'night' : 'noon'}: authored -> this week`);
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const s = e!.species.find((x) => x.speciesId === id);
    console.log(`  ${id.padEnd(12)} ${String(before.get(id) ?? 0).padStart(6)} -> ${String(after.get(id) ?? 0).padStart(6)}   x${(s?.factor ?? 1).toFixed(2)} ${s?.cause ?? ''}`);
  }
  process.exit(0);
}

void main();
