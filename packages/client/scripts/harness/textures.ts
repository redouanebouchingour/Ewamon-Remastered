/**
 * `pnpm --filter @ewa/client harness:textures -- --residency managed --grace 25000 --out .screenshots/textures/after.json`
 * — the creature texture-memory runs (client IMPLEMENTATION-NOTES "Creature textures"; SPEC §50.2.2 texture cap) on the
 * offline harness page (`/harness/budget?zone=mirevale&residency=<r>`), leak-test style:
 *
 * - (a) Mirevale idle after boot;
 * - (b) a scripted wild battle zenryu (the player's) vs raikitsune in Mirevale, then after it and after the grace period;
 * - (c) galvan_route with both legendary statics standing (`badge:circuit`, `champion:zeon:beaten`), the player at
 *   raikitsune, then at voltaura, then back in Mirevale, then after the grace period;
 * - (d) `--cycles` rounds of one evolution sequence (skipped through) + one legendary battle each, then after the
 *   grace period.
 *
 * Every step reads `HarnessWorld.textureReadout()` once the binds landed: render's corrected `texturesSize`, the same
 * before the sprite level-0 correction (`rawTexturesSize`, render IMPLEMENTATION-NOTES Part 9), the sprite pool's GPU
 * bytes / atlases, and (managed) what the residency holds, idles and refuses. `--residency legacy` replays the binding
 * before the residency (every atlas of a species, never released) for the before column.
 *
 * Options: `--residency managed|legacy` (default managed) · `--grace <ms>` wait after leaving (default 25000; the
 * residency's grace is 20 s) · `--cycles 10` · `--only abcd` · `--out <file>` (default
 * `.screenshots/textures/<residency>.json`) · `--width 1440 --height 900` · `--serve dev|build` (default dev) · `--no-build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { argNum, argStr, evaluate, log, machine, openSession, parseArgs, userPath } from './common';

interface Readout {
  readonly texturesSize: number;
  readonly rawTexturesSize: number;
  readonly textures: number;
  readonly spriteBytes: number;
  readonly spriteAtlases: number;
  readonly liveBillboards: number;
  readonly managed: { readonly boundBytes: number; readonly budgetBytes: number; readonly idle: number; readonly denied: number; readonly held: readonly string[]; readonly idleIds: readonly string[] } | null;
}

/** The 8 legendaries and 2 mythicals (all animated): battle i is LEGENDS[i] (the player's) vs LEGENDS[i + 3]. */
const LEGENDS = ['raikitsune', 'bankaiser', 'galaxion', 'sunjaw', 'glacinid', 'voltaura', 'zenryu', 'voidraxis', 'lumyth', 'noxmyth'];
const CAP = 734_003_200;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const MB = (b: number): string => (b / 1e6).toFixed(1);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const residency = argStr(args, 'residency', 'managed') === 'legacy' ? 'legacy' : 'managed';
  const graceWaitMs = argNum(args, 'grace', 25_000);
  const cycles = argNum(args, 'cycles', 10);
  const only = argStr(args, 'only', 'abcd');
  const width = argNum(args, 'width', 1440);
  const height = argNum(args, 'height', 900);
  const out = userPath(argStr(args, 'out', `.screenshots/textures/${residency}.json`));
  const session = await openSession({
    zone: 'mirevale', route: 'budget', width, height, serve: argStr(args, 'serve', 'dev') === 'build' ? 'build' : 'dev', build: args['no-build'] !== true,
    query: { residency },
  });
  const cdp = session.browser.cdp;
  const ev = <T>(expr: string): Promise<T> => evaluate<T>(cdp, expr);
  const H = 'window.__ewaHarness';
  const rows: { step: string; tex: Readout; extra?: unknown }[] = [];
  const tex = (): Promise<Readout> => ev<Readout>(`${H}.world.textureReadout()`);
  const frames = (n: number): Promise<number> => ev<number>(`${H}.world.runWhile(() => true, ${n})`);
  /** frames until texturesSize and the pool's atlas count hold for 3 reads 20 frames apart (the binds landed) */
  const settle = async (min = 40): Promise<Readout> => {
    await frames(min);
    let last = '';
    let same = 0;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      await frames(20);
      const t = await tex();
      const k = `${t.texturesSize}:${t.spriteAtlases}`;
      if (k === last) same++;
      else { same = 0; last = k; }
      if (same >= 2) return t;
    }
    return tex();
  };
  const save = (): void => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ residency, width, height, graceWaitMs, cycles, capBytes: CAP, machine: { ...machine(), chrome: session.browser.version }, adapter: session.info['caps'], rows }, null, 2)}\n`);
  };
  const record = async (step: string, t?: Readout, extra?: unknown): Promise<Readout> => {
    const v = t ?? (await tex());
    rows.push({ step, tex: v, ...(extra !== undefined ? { extra } : {}) });
    const m = v.managed;
    log(`${residency} ${step}: texturesSize ${MB(v.texturesSize)} MB (raw ${MB(v.rawTexturesSize)}), sprites ${MB(v.spriteBytes)} MB in ${v.spriteAtlases} atlases, ${v.liveBillboards} billboards`
      + (m === null ? '' : ` | budget ${MB(m.budgetBytes)} | held ${m.held.join(' ')} | idle ${m.idleIds.join(' ')} | waits ${m.denied}`));
    save();
    return v;
  };
  const graceWait = async (): Promise<void> => {
    if (graceWaitMs <= 0) return;
    await sleep(graceWaitMs);
    await frames(10);
  };
  const billboards = (): Promise<unknown> => ev(`${H}.billboards()`);
  const battle = async (mine: string, foe: string, step: string): Promise<Readout> => {
    await ev(`(() => { const w = ${H}.world; w.startBattle(w.scriptBattle(${JSON.stringify(mine)}, ${JSON.stringify(foe)}, 50)); return 0; })()`);
    const t = await settle(90);
    await record(step, t, { billboards: await billboards() });
    await ev(`(() => { ${H}.world.endBattle(); return 0; })()`);
    return t;
  };
  const evolve = async (from: string, to: string, step: string): Promise<Readout> => {
    await ev(`(() => { ${H}.evolve(${JSON.stringify(from)}, ${JSON.stringify(to)}); return 0; })()`);
    await frames(60);
    let peak = await tex();
    const space = `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))`;
    await ev(space);
    for (let i = 0; i < 30; i++) {
      if (!(await ev<boolean>(`${H}.world.evolution?.active === true`))) break;
      await frames(20);
      const t = await tex();
      if (t.texturesSize > peak.texturesSize) peak = t;
      if (i === 5) await ev(space);
    }
    await record(step, peak);
    return peak;
  };

  try {
    await record('boot (mirevale)', await settle(30));
    if (only.includes('a')) await record('(a) mirevale idle', await settle(60));
    if (only.includes('b')) {
      await battle('zenryu', 'raikitsune', '(b) battle zenryu vs raikitsune (mirevale)');
      await record('(b) after the battle', await settle(30));
      await graceWait();
      await record('(b) after the battle + grace', await settle(20));
    }
    if (only.includes('c')) {
      await ev(`(() => { const f = ${H}.world.flags; f.add('badge:circuit'); f.add('champion:zeon:beaten'); return 0; })()`);
      await ev(`${H}.world.loadZone('galvan_route').then(() => 0)`);
      await record('(c) galvan_route loaded (statics stand)', await settle(60), { billboards: await billboards() });
      await ev(`(() => { ${H}.world.place(-84, 92, 0); return 0; })()`);
      await record('(c) at raikitsune', await settle(40), { billboards: await billboards() });
      await ev(`(() => { ${H}.world.place(92, -44, 0); return 0; })()`);
      await record('(c) at voltaura', await settle(40), { billboards: await billboards() });
      await ev(`${H}.world.loadZone('mirevale').then(() => 0)`);
      await record('(c) back in mirevale', await settle(60));
      await graceWait();
      await record('(c) back in mirevale + grace', await settle(20));
    }
    if (only.includes('d')) {
      const pairs = await ev<[string, string][]>(`${H}.evolutionPairs(${cycles})`);
      let peak = 0;
      for (let i = 0; i < cycles; i++) {
        const p = pairs[i % pairs.length]!;
        const mine = LEGENDS[i % LEGENDS.length]!;
        const foe = LEGENDS[(i + 3) % LEGENDS.length]!;
        const e = await evolve(p[0], p[1], `(d) ${i + 1} evolve ${p[0]} -> ${p[1]}`);
        const b = await battle(mine, foe, `(d) ${i + 1} battle ${mine} vs ${foe}`);
        peak = Math.max(peak, e.texturesSize, b.texturesSize);
      }
      await record(`(d) after ${cycles} cycles`, await settle(30), { peak });
      await graceWait();
      await record(`(d) after ${cycles} cycles + grace`, await settle(20), { peak });
    }
    save();
    const over = rows.filter((r) => r.tex.texturesSize > CAP);
    log(`wrote ${out}; ${over.length === 0 ? 'every step under' : `${over.length} step(s) over`} the ${MB(CAP)} MB cap`);
  } finally {
    await session.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
