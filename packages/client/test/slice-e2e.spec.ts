/**
 * §50.4.7 `slice-e2e.spec.ts` (Phase E5) — the vertical slice end to end against a real server + client pair on
 * PGlite (`e2e/stack.ts`: free ports, a fresh temp database), two browser contexts in Chrome with WebGPU:
 *
 * 1. both players register through the `/register` form (starter picked on its card) and land in `/play` → mirevale;
 * 2. they meet: each client holds the other's `PlayerState` as a spawned remote (same AOI cell at the spawn);
 * 3. chat: a line typed in A's chat box reaches B's HUD chat log; A's own log shows it exactly once;
 * 4. A walks to Prof. Wynn with `window.__ewaWorld.walkTo` (the real prediction + server path) and presses the
 *    interact key: the `first_witness` beat plays and the server grants `met_wynn` (read back over REST `/me`);
 * 5. A walks to the gym door, interacts, is warped into the Mirevale gym hall, walks to Gardener Fen and interacts: a
 *    trainer battle starts (the battle UI reaches move selection; the server marks A in battle).
 *
 * Not covered here (spec row items that need a scripted battle win or a two-sided trade / PvP UI drive): the trade,
 * the PvP rating swap and clearing `verdant_gym` — the server suites drive those flows over the same messages
 * (`challenge-trade.test.ts`, `ranked.test.ts`, `progression-act1.test.ts`).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { interiorTrainers, interiorWarps, zone } from '@ewa/content';
import { debug, me, registerAndEnter, uniqueName, until, walkPath } from './e2e/game';
import { startStack } from './e2e/stack';
import type { Stack } from './e2e/stack';

test.use({ actionTimeout: 30_000 });

let stack: Stack;
test.beforeAll(async () => {
  stack = await startStack();
});
test.afterAll(async () => {
  await stack?.stop();
});

/** Walks an A* path (content's walkable field) to (x, z) through `__ewaWorld.walkTo`. */
async function walk(page: Page, x: number, z: number, what: string): Promise<void> {
  await page.bringToFront();
  try {
    await walkPath(page, 'mirevale', x, z);
  } catch (e) {
    throw new Error(`walking to ${what}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Presses interact once the wanted target is the current one. */
async function interact(page: Page, targetId: string): Promise<void> {
  await until(page, `${targetId} as the interaction target`, (d) => d.target?.id === targetId, 15_000);
  await page.keyboard.press('KeyE');
}

test('slice: register two players, meet, chat, Wynn beat, gym hall battle', async ({ browser }) => {
  test.setTimeout(600_000);
  const nameA = uniqueName('slicea');
  const a = await registerAndEnter(browser, stack, nameA);
  const b = await registerAndEnter(browser, stack, uniqueName('sliceb'));

  // 2. meet
  await until(a.page, 'A sees B', (d) => d.spawnedRemotes >= 1, 30_000);
  await until(b.page, 'B sees A', (d) => d.spawnedRemotes >= 1, 30_000);

  // 3. chat: T opens the chat box (the `chat` binding), Enter sends
  const line = `hello from a ${Date.now() % 1000}`;
  await a.page.bringToFront();
  await a.page.keyboard.press('KeyT');
  const input = a.page.getByLabel('Say');
  await input.fill(line);
  await input.press('Enter');
  await until(b.page, 'B receives the chat line', (d) => d.chat.some((c) => c.endsWith(line)), 15_000);
  await until(a.page, 'A sees its own line once', (d) => d.chat.filter((c) => c.endsWith(line)).length === 1, 15_000);
  expect(b.errors).toEqual([]);
  // B's part is done: closing its page frees the GPU for A's walk
  await b.page.context().close();

  // 4. Wynn: walk next to him, interact; the server grants met_wynn
  const wynn = zone('mirevale').npcs.find((n) => n.id === 'mirevale.wynn')!;
  await walk(a.page, wynn.x, wynn.z + 2, 'Wynn');
  await interact(a.page, wynn.id);
  await expect.poll(async () => (await me(stack, nameA)).flags?.includes('met_wynn') ?? false, { timeout: 30_000 }).toBe(true);
  // step through the beat's dialogue until it closes
  for (let i = 0; i < 20 && (await debug(a.page))?.dialogue; i++) {
    await a.page.keyboard.press('Space');
    await a.page.waitForTimeout(400);
  }

  // 5. the gym: the door warp, then Gardener Fen in the hall
  const door = interiorWarps('mirevale').find((w) => w.id === 'mirevale.gym.in')!;
  await walk(a.page, door.x, door.z + 1.5, 'the gym door');
  await interact(a.page, door.id);
  await until(a.page, 'warped into the gym hall', (d) => Math.hypot(d.pose.x - door.toX, d.pose.z - door.toZ) < 3, 15_000);
  const fen = interiorTrainers('mirevale').find((t) => t.id === 'mirevale.gym.t1')!;
  await walk(a.page, fen.x, fen.z + 2, 'Gardener Fen');
  await interact(a.page, fen.id);
  await until(a.page, 'the trainer battle at move selection', (d) => d.battle?.phase === 'selecting', 90_000);
  expect((await debug(a.page))?.server?.inBattle).toBe(true);

  expect(a.errors).toEqual([]);
});
