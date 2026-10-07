/**
 * Dev tool: give a player a creature directly in the database.
 *
 *   pnpm --filter @ewa/server grant:creature <username> <species> <level> [--moves "A,B,C,D"] [--box] [--shiny]
 *   (env: DATA_DIR — PGlite at DATA_DIR/pglite, default ./.data — or DATABASE_URL)
 *
 * The creature goes to the first free party slot (the box when the party is full or with --box), with the species'
 * default moveset unless --moves names up to four moves (each must exist in content). The dex marks it caught. PGlite
 * allows one process: stop the server that holds the database first, or the open fails.
 */
import { resolve } from 'node:path';
import { createContentIndex } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';
import { newCreature } from '../src/game/creatures';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`grant-creature: ${msg}`);
  console.error('usage: grant-creature <username> <species> <level> [--moves "A,B,C,D"] [--box] [--shiny]  (env: DATA_DIR | DATABASE_URL)');
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
  const toBox = argv.includes('--box');
  const shiny = argv.includes('--shiny');

  const content = createContentIndex();
  try {
    content.species(speciesId);
  } catch {
    usage(`unknown species '${speciesId}'`);
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
