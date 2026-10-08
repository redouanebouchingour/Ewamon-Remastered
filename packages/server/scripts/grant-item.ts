/**
 * Dev tool: give a player items directly in the database.
 *
 *   pnpm --filter @ewa/server grant:item <username> <item> <qty> [--set]
 *   (env: DATA_DIR — PGlite at DATA_DIR/pglite, default ./.data — or DATABASE_URL)
 *
 * Adds `qty` of `item` (a held item, consumable or orb id from content) to the player's bag; `--set` makes the bag hold
 * exactly `qty`. The bag holds at most 999 of an item (persist INVENTORY_MAX_QTY). PGlite allows one process: stop
 * the server that holds the database first — a second writer opens silently and corrupts the WAL.
 */
import { resolve } from 'node:path';
import { createContentIndex } from '@ewa/content';
import { createDb, createRepos, runMigrations } from '@ewa/persist';

function usage(msg?: string): never {
  if (msg !== undefined) console.error(`grant-item: ${msg}`);
  console.error('usage: grant-item <username> <item> <qty> [--set]  (env: DATA_DIR | DATABASE_URL)');
  process.exit(2);
}

function known(content: ReturnType<typeof createContentIndex>, id: string): string | null {
  // item() covers held items and consumables
  for (const get of [(x: string) => content.item(x).name, (x: string) => content.orb(x).name]) {
    try {
      return get(id);
    } catch {
      // not this kind
    }
  }
  return null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [username, itemId, qtyArg] = argv.filter((a) => !a.startsWith('--'));
  if (username === undefined || itemId === undefined || qtyArg === undefined) usage();
  const qty = Number(qtyArg);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) usage(`qty must be 1..999, got '${qtyArg}'`);
  const set = argv.includes('--set');
  const name = known(createContentIndex(), itemId);
  if (name === null) usage(`unknown item '${itemId}'`);

  const url = process.env['DATABASE_URL'];
  const db = await createDb(url !== undefined ? { url } : { pgliteDir: resolve(process.env['DATA_DIR'] ?? './.data', 'pglite') });
  await runMigrations(db);
  const repos = createRepos(db);
  const now = new Date();
  const out = await db.transaction(async (tx) => {
    const player = await repos.players.byUsername(tx, username.toLowerCase());
    if (player === null) return null;
    const have = await repos.inventory.qty(tx, player.id, itemId);
    const delta = set ? qty - have : Math.min(qty, 999 - have);
    const after = delta === 0 ? have : await repos.inventory.add(tx, player.id, itemId, delta);
    await repos.audit.write(tx, { actorId: player.id, action: 'dev.grantItem', subject: itemId, detail: { before: have, after } }, now);
    return { player: player.username, have, after };
  });
  if (out === null) {
    console.error(`grant-item: no player '${username}'`);
    process.exit(1);
  }
  console.log(`${out.player}: ${name} ${out.have} → ${out.after}`);
  process.exit(0);
}

void main();
