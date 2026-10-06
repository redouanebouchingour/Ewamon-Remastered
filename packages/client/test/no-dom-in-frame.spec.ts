/**
 * §50.4.7 `no-dom-in-frame.spec.ts` (Phase E5; legacy-render-audit Q15 / A-3) — the overworld frame never touches the
 * DOM: the HUD is the canvas layer. Against a real server + client (`e2e/stack.ts`), a fresh account stands in mirevale;
 * once its arrival toasts have expired and the background shader-compile pill is gone, a `MutationObserver` on `document.body` (subtree, attributes, character data)
 * records 0 mutations during 10 s of idle overworld play. Then, during walking (`__ewaWorld.walkTo` along an A* path) and a chat line,
 * every recorded mutation lies inside the chat input or the toast host — nothing else in the page changes.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { debug, registerAndEnter, uniqueName, until, walkPath } from './e2e/game';
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

interface MutationRecordLite { readonly type: string; readonly where: string; readonly allowed: boolean }

/** Installs the observer; mutations inside the chat form or a toast / notification host count as allowed. */
async function observe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __mut: { type: string; where: string; allowed: boolean }[]; __mo?: MutationObserver };
    w.__mo?.disconnect();
    w.__mut = [];
    const describe = (n: Node | null): string => {
      const parts: string[] = [];
      let el: Element | null = n instanceof Element ? n : (n?.parentElement ?? null);
      for (let i = 0; el !== null && i < 5; i++, el = el.parentElement) {
        const tid = el.getAttribute('data-testid');
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
        parts.push(`${el.tagName.toLowerCase()}${tid ? `[data-testid=${tid}]` : ''}${cls ? `.${cls}` : ''}`);
      }
      return parts.join(' < ');
    };
    const allowed = (n: Node | null): boolean => {
      const el: Element | null = n instanceof Element ? n : (n?.parentElement ?? null);
      if (el === null) return false;
      return el.closest('[data-testid="chatinput"]') !== null || el.closest('[aria-live], [role="status"], [role="alert"], [data-testid*="toast"], [data-testid*="notification"]') !== null;
    };
    w.__mo = new MutationObserver((list) => {
      for (const m of list) {
        // a removed / added node: judge by the mutation's target (its old parent) as well as the node itself
        const nodes = [...m.addedNodes, ...m.removedNodes];
        const ok = allowed(m.target) || (nodes.length > 0 && nodes.every((x) => allowed(x)));
        w.__mut.push({ type: m.type, where: describe(m.target), allowed: ok });
      }
    });
    w.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

const records = (page: Page): Promise<MutationRecordLite[]> =>
  page.evaluate(() => (window as unknown as { __mut: MutationRecordLite[] }).__mut.slice());

test('a static overworld HUD mutates no DOM in 10 s; walking + chat mutate only the chat input and toasts', async ({ browser }) => {
  test.setTimeout(900_000);
  const { page, errors } = await registerAndEnter(browser, stack, uniqueName('nodom'));
  // Prof. Wynn's tutorial card (Phase D12) advances a step on real events (8 m walked…) — event-driven guidance, not
  // frame output; it is skipped up front so the walking window holds the spec's strict rule (chat input + toasts only)
  const skip = page.getByRole('button', { name: 'Skip tutorial' });
  if ((await skip.count()) > 0) await skip.click();
  // arrival toasts / the boot overlay finish first (toasts expire on their own timers)
  await until(page, 'no toasts on screen', (d) => d.toasts.length === 0 && (d.modal === null || d.modal === 'none'), 60_000);
  // the zone's background shader compile shows a progress pill (WorldBoot, role=status) until it finishes — a loading
  // surface, not the HUD; the static-HUD window starts once it is gone
  await expect(page.locator('[data-testid="background-compile"]')).toHaveCount(0, { timeout: 420_000 });
  await page.waitForTimeout(3_000);

  await observe(page);
  await page.waitForTimeout(10_000);
  const idle = await records(page);
  expect(idle, JSON.stringify(idle.slice(0, 20), null, 1)).toEqual([]);
  // the world kept rendering through those 10 s (the canvas, not the DOM, carries the frame)
  expect((await debug(page))?.firstFrame).toBe(true);

  // walking + chatting
  await observe(page);
  const p0 = (await debug(page))!.pose;
  await walkPath(page, 'mirevale', p0.x + 6, p0.z - 6);
  await page.keyboard.press('KeyT');
  const input = page.getByLabel('Say');
  await input.fill('quiet frame check');
  await input.press('Enter');
  await until(page, 'the chat line in the HUD log', (d) => d.chat.some((c) => c.endsWith('quiet frame check')), 15_000);
  await walkPath(page, 'mirevale', p0.x, p0.z);
  const active = await records(page);
  const stray = active.filter((m) => !m.allowed);
  expect(stray, JSON.stringify(stray.slice(0, 20), null, 1)).toEqual([]);
  // the chat input itself did mutate (the observer was live)
  expect(active.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
