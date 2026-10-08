/**
 * Dev tool: give a player a creature directly in the database.
 *
 *   pnpm --filter @ewa/server grant:creature <username> <species> <level> [--moves "A,B,C,D"] [--box] [--shiny]
 *   pnpm --filter @ewa/server grant:creature <username> all <level> [--missing] [--shiny]
 *   (env: DATA_DIR — PGlite at DATA_DIR/pglite, default ./.data — or DATABASE_URL)
 *
 * The creature goes to the first free party slot (the box when the party is full or with --box), with the species'
 * default moveset unless --moves names up to four moves (each must exist in content). The dex marks it caught.
 * `all` grants one of every species in dex order, into the box, in one transaction (`--missing`: only the species the
 * player owns none of). PGlite allows one process: stop the server that holds the database first, or the open fails.
 */
import { resolve } from 'node:path';
import { SPECIES, createContentIndex } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';
import { newCreature } from '../src/game/creatures';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`grant-creature: ${msg}`);
  console.error('usage: grant-creature <username> <species|all> <level> [--moves "A,B,C,D"] [--box] [--shiny] [--missing]  (env: DATA_DIR | DATABASE_URL)');
  process.exit(2);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--moves'));
  const [username, speciesId, levelArg] = pos;
  if (username === undefined || speciesId === undefined || levelArg === undefined) usage();
  const level = Number(levelArg);
  if (!Number.isInteger(level) || level < 1 || level > 100) usage(`level must be 1..100, got '${levelArg}'`);
  const mi = argv.indexOf('--moves');
  const moveIds = mi >= 0 ? (argv[mi + 1] ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0) : null;
  const all = speciesId === 'all';
  const toBox = all || argv.includes('--box');
  const shiny = argv.includes('--shiny');
  const missingOnly = argv.includes('--missing');
  if (all && mi >= 0) usage('--moves needs one species');

  const content = createContentIndex();
  if (!all) {
    try {
      content.species(speciesId);
    } catch {
      usage(`unknown species '${speciesId}'`);
    }
  }
  if (moveIds !== null) {
    if (moveIds.length < 1 || moveIds.length > 4) usage('--moves takes 1..4 moves');
    for (const m of moveIds) {
      try {
        content.move(m);
      } catch {
        usage(`unknown move '${m}'`);
      }
    }
  }

  const url = process.env['DATABASE_URL'];
  const db = await createDb(url !== undefined ? { url } : { pgliteDir: resolve(process.env['DATA_DIR'] ?? './.data', 'pglite') });
  await runMigrations(db);
  const repos = createRepos(db);
  const now = new Date();
  if (all) {
    const res = await db.transaction(async (tx) => {
      const player = await repos.players.byUsername(tx, username.toLowerCase());
      if (player === null) return null;
      const owned = new Set((await repos.creatures.byOwner(tx, player.id)).map((r) => r.speciesId));
      const granted: string[] = [];
      for (const sp of [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber)) {
        if (missingOnly && owned.has(sp.id)) continue;
        const base = newCreature(content, sp.id, level, { ownerId: player.id, moves: 'default' });
        await repos.creatures.insert(tx, shiny ? { ...base, isShiny: true } : base, { kind: 'box', index: 'nextBox' });
        await repos.progress.markCaught(tx, player.id, sp.id, 'normal', false, now, shiny);
        granted.push(sp.id);
      }
      await repos.audit.write(tx, { actorId: player.id, action: 'dev.grantCreature', subject: 'all', detail: { level, count: granted.length, missingOnly } }, now);
      return { player: player.username, granted, skipped: SPECIES.length - granted.length };
    });
    if (res === null) {
      console.error(`grant-creature: no player '${username}'`);
      process.exit(1);
    }
    console.log(`granted ${res.granted.length} species at L${level} to ${res.player}'s box${res.skipped > 0 ? ` (${res.skipped} already owned, skipped)` : ''}`);
    process.exit(0);
  }

  const out = await db.transaction(async (tx) => {
    const player = await repos.players.byUsername(tx, username.toLowerCase());
    if (player === null) return null;
    const base = newCreature(content, speciesId, level, { ownerId: player.id, moves: 'default' });
    const c = {
      ...base,
      ...(moveIds !== null ? { moves: moveIds.map((m) => ({ id: m, pp: content.move(m).pp, ppMax: content.move(m).pp })) } : {}),
      ...(shiny ? { isShiny: true } : {}),
    };
    const party = await repos.creatures.party(tx, player.id);
    const used = new Set((await repos.creatures.byOwner(tx, player.id)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
    let idx = 0;
    while (used.has(idx)) idx++;
    const slot = toBox || party.length >= 6 ? ({ kind: 'box', index: 'nextBox' } as const) : ({ kind: 'party', index: idx } as const);
    const row = await repos.creatures.insert(tx, c, slot);
    await repos.progress.markCaught(tx, player.id, speciesId, 'normal', false, now, shiny);
    await repos.audit.write(tx, { actorId: player.id, action: 'dev.grantCreature', subject: speciesId, detail: { level, moves: c.moves.map((m) => m.id) } }, now);
    return { player: player.username, row, slot };
  });
  if (out === null) {
    console.error(`grant-creature: no player '${username}'`);
    process.exit(1);
  }
  console.log(`granted ${speciesId} L${level} to ${out.player} (${out.slot.kind}${out.slot.kind === 'party' ? ` ${out.slot.index}` : ''}), moves: ${out.row.moves.map((m) => m.id).join(', ')}`);
  process.exit(0);
}

void main();
