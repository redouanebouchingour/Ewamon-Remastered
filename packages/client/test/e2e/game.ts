/**
 * Phase E5 — page helpers shared by the client game specs: register through the `/register` form and wait for the
 * world in mirevale, read `window.__ewaWorld.debug()` (dev / `?dev=1` builds), poll it, walk with
 * `window.__ewaWorld.walkTo` (the real prediction + server path), and read `/me` with an independent REST login.
 */
import type { Browser, Page } from '@playwright/test';
import { getZoneSurface } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { Stack } from './stack';

export const PASSWORD = 'correct-horse-battery';

export interface WorldDebug {
  ready: boolean;
  zone: string | null;
  zoneLoaded: boolean;
  firstFrame: boolean;
  pose: { x: number; z: number; angle: number };
  placed: boolean;
  server: { x: number; z: number; seq: number; inBattle: boolean } | null;
  remotes: number;
  spawnedRemotes: number;
  target: { id: string; kind: string } | null;
  battle: { phase: string; turn: string | null; result: unknown } | null;
  modal: unknown;
  dialogue: unknown;
  chat: string[];
  connection: unknown;
  toasts: string[];
}

export const debug = (page: Page): Promise<WorldDebug | null> =>
  page.evaluate(() => {
    const w = (window as unknown as { __ewaWorld?: { debug(): unknown } }).__ewaWorld;
    return w === undefined ? null : (w.debug() as never);
  });

export async function until<T>(page: Page, what: string, fn: (d: WorldDebug) => T | null | undefined | false, timeoutMs: number): Promise<T> {
  const t0 = Date.now();
  let last: WorldDebug | null = null;
  for (;;) {
    last = await debug(page);
    if (last !== null) {
      const v = fn(last);
      if (v !== null && v !== undefined && v !== false) return v;
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what}; last debug: ${JSON.stringify(last)?.slice(0, 1500)}`);
    await page.waitForTimeout(250);
  }
}

/** Walks with the real input path; generous timeout — the dev iGPU can drop to a few fps with two WebGPU pages. */
export const walkTo = (page: Page, x: number, z: number, run = true, timeoutMs = 150_000): Promise<boolean> =>
  page.evaluate(
    ([x, z, run, t]) => (window as unknown as { __ewaWorld: { walkTo(x: number, z: number, run?: boolean, t?: number): Promise<boolean> } }).__ewaWorld.walkTo(x as number, z as number, run as boolean, t as number),
    [x, z, run, timeoutMs] as const,
  );

/** Registers through the form (Bramblecub card), lands in /play?dev=1 and waits until the player stands in mirevale. */
export async function registerAndEnter(browser: Browser, stack: Stack, name: string): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${stack.origin}/register?dev=1`);
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Email').fill(`${name}@e2e.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('radiogroup', { name: 'Starter' }).getByRole('button', { name: /Bramblecub/ }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/play/, { timeout: 60_000 });
  if (!page.url().includes('dev=1')) await page.goto(`${stack.origin}/play?dev=1`);
  await until(page, `${name} in mirevale`, (d) => d.ready && d.zone === 'mirevale' && d.zoneLoaded && d.placed && d.server !== null, 240_000);
  return { page, errors };
}

/** GET /me over REST with an independent login (never touches the page's own refresh-token family). */
export async function me(stack: Stack, name: string): Promise<{ flags?: string[]; [k: string]: unknown }> {
  const r = await fetch(`${stack.rest}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: name, password: PASSWORD }) });
  const t = (await r.json()) as { access: string };
  const m = await fetch(`${stack.rest}/me`, { headers: { authorization: `Bearer ${t.access}` } });
  return (await m.json()) as never;
}

/** A username that is unique per run and valid for `/^[a-z0-9_]{3,20}$/`. */
export const uniqueName = (prefix: string): string => `${prefix}${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 100)}`;

// ---- paths -----------------------------------------------------------------------------------------------------

type Pt = readonly [number, number];

/**
 * A* over the zone's content walkable field (what client prediction and the server's `validateInput` both read),
 * 8-connected on the 0.5 m samples, every node keeping one sample of clearance (the mover radius is 0.35 m); the
 * result is shortened to the waypoints a straight `walkTo` can follow (line of sight checked every 0.25 m).
 */
export function planPath(zoneId: ZoneId, from: Pt, to: Pt): Pt[] {
  const h = getZoneSurface(zoneId).heightfield;
  const { res, step, originX, originZ } = h;
  const walk = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < res && r < res && h.walkable[r * res + c] === 1;
  const clear = (c: number, r: number): boolean => walk(c, r) && walk(c + 1, r) && walk(c - 1, r) && walk(c, r + 1) && walk(c, r - 1);
  const cell = (p: Pt): [number, number] => [Math.round((p[0] - originX) / step), Math.round((p[1] - originZ) / step)];
  const near = (p: Pt): [number, number] => {
    const [c0, r0] = cell(p);
    for (let k = 0; k < 12; k++) for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (clear(c0 + dc, r0 + dr)) return [c0 + dc, r0 + dr];
    throw new Error(`${zoneId}: nothing clear near (${p[0]}, ${p[1]})`);
  };
  const [sc, sr] = near(from);
  const [gc, gr] = near(to);
  const n = res * res;
  const g = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const open: { i: number; f: number }[] = [];
  const s = sr * res + sc;
  const goal = gr * res + gc;
  g[s] = 0;
  open.push({ i: s, f: 0 });
  const H = (i: number): number => Math.hypot((i % res) - gc, Math.floor(i / res) - gr);
  while (open.length > 0) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k]!.f < open[bi]!.f) bi = k;
    const { i } = open.splice(bi, 1)[0]!;
    if (i === goal) break;
    const c = i % res;
    const r = (i - c) / res;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!clear(nc, nr) || (dc !== 0 && dr !== 0 && (!clear(c + dc, r) || !clear(c, r + dr)))) continue;
        const j = nr * res + nc;
        const cost = g[i]! + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (cost < g[j]!) {
          g[j] = cost;
          prev[j] = i;
          open.push({ i: j, f: cost + H(j) });
        }
      }
    }
  }
  if (prev[goal] === -1 && goal !== s) throw new Error(`${zoneId}: no path (${from}) → (${to})`);
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = prev[i]!) cells.push(i);
  cells.reverse();
  const pt = (i: number): Pt => [originX + (i % res) * step, originZ + Math.floor(i / res) * step];
  const sight = (a: Pt, b: Pt): boolean => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(d / 0.25));
    for (let t = 0; t <= k; t++) {
      const [c, r] = cell([a[0] + ((b[0] - a[0]) * t) / k, a[1] + ((b[1] - a[1]) * t) / k]);
      if (!clear(c, r)) return false;
    }
    return true;
  };
  const out: Pt[] = [];
  let anchor = pt(cells[0]!);
  for (let k = 1; k < cells.length; k++) {
    const next = pt(cells[k]!);
    if (!sight(anchor, next)) {
      anchor = pt(cells[k - 1]!);
      out.push(anchor);
    }
  }
  out.push(pt(goal));
  return out;
}

/** Walks a planned path waypoint by waypoint from the player's current pose. */
export async function walkPath(page: Page, zoneId: ZoneId, x: number, z: number): Promise<void> {
  const d = await debug(page);
  if (d === null) throw new Error('no __ewaWorld');
  for (const [wx, wz] of planPath(zoneId, [d.pose.x, d.pose.z], [x, z])) {
    if (!(await walkTo(page, wx, wz))) throw new Error(`walkTo (${wx}, ${wz}) on the way to (${x}, ${z}) failed; debug: ${JSON.stringify(await debug(page))?.slice(0, 1200)}`);
  }
}
