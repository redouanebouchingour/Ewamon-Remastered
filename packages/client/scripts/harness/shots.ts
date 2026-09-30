/**
 * `pnpm --filter @ewa/client harness:shots -- --zone <id> --set M<n>` — SPEC §50.6.1: the audit shots of the table
 * that belong to `<id>`, each captured three times (full effects, reduced effects, DOF mask as greyscale), written to
 * `.screenshots/audit/M<n>/<zone>/<shotId>-<x>_<z>-<variant>.png`, plus one JSON sidecar per shot
 * (`<shotId>-<x>_<z>.json`: the table row, the resolved anchor and its rule, `layoutSeed`, the camera, the post plan,
 * counts, HUD / battle state, notes, and per variant the PNG checks) and a per-zone `index.json`.
 *
 * Options: `--shots all|<id,id>` (default all of the zone's table rows) · `--variants full,reduced,mask` ·
 * `--out-dir .screenshots/audit` · `--width 1440 --height 900` · `--settle 90` (min settle frames) ·
 * `--serve build|dev` (default build) · `--no-build` (reuse `dist/harness`) · `--headings words|rig` (default words: the
 * table's '0 = +z forward' reading; rig = the numbers straight to CameraRig.setHeading, written under `headings-rig/`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIT_SHOTS, VARIANTS, shotFileStem } from '../../src/harness/shotTable';
import type { ResolvedAnchor } from '../../src/harness/anchors';
import type { ShotId, Variant } from '../../src/harness/shotTable';
import type { StageResult } from '../../src/harness/stage';
import { argNum, argStr, decodePng, evaluate, fullShareIn, imageStats, log, machine, openSession, parseArgs, userPath } from './common';
import type { ImageStats } from './common';

interface VariantRecord {
  readonly variant: Variant;
  readonly file: string;
  readonly png: ImageStats;
  readonly checks: readonly string[];
  readonly maskCoverage: { readonly player: number | null; readonly battlers: readonly { readonly side: number; readonly full: number | null }[] } | null;
  readonly stage: Omit<StageResult, 'anchor'>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const zone = argStr(args, 'zone', '');
  if (zone === '') throw new Error('--zone <id> is required');
  const set = argStr(args, 'set', 'M2');
  const width = argNum(args, 'width', 1440);
  const height = argNum(args, 'height', 900);
  const settle = argNum(args, 'settle', 90);
  const outRoot = userPath(argStr(args, 'out-dir', '.screenshots/audit'));
  const variants = argStr(args, 'variants', VARIANTS.join(',')).split(',').filter((v): v is Variant => (VARIANTS as readonly string[]).includes(v));
  const want = argStr(args, 'shots', 'all');
  const tableShots = AUDIT_SHOTS.filter((s) => s.zone === zone);
  const shots = want === 'all' ? tableShots : tableShots.filter((s) => want.split(',').includes(s.id));
  if (shots.length === 0) throw new Error(`no §50.6.1 shot belongs to zone ${zone} (table zones: ${[...new Set(AUDIT_SHOTS.map((s) => s.zone))].join(', ')})`);
  const headings = argStr(args, 'headings', 'words') === 'rig' ? 'rig' : 'words';
  const outDir = headings === 'rig' ? join(outRoot, set, zone, 'headings-rig') : join(outRoot, set, zone);
  mkdirSync(outDir, { recursive: true });

  const session = await openSession({ zone, route: 'shots', width, height, serve: argStr(args, 'serve', 'build') === 'dev' ? 'dev' : 'build', build: args['no-build'] !== true, headings });
  const index: Record<string, unknown>[] = [];
  let failures = 0;
  try {
    const cdp = session.browser.cdp;
    const anchors = await evaluate<ResolvedAnchor[]>(cdp, 'window.__ewaHarness.anchors()');
    for (const shot of shots) {
      const anchor = anchors.find((a) => a.shot === shot.id);
      if (anchor === undefined) { log(`${shot.id}: no anchor in ${zone} — skipped`); failures++; continue; }
      const stem = shotFileStem(shot.id as ShotId, anchor.x, anchor.z);
      const records: VariantRecord[] = [];
      for (const variant of variants) {
        const t0 = Date.now();
        const st = await evaluate<StageResult>(cdp, `window.__ewaHarness.stage(${JSON.stringify(shot.id)}, ${JSON.stringify(variant)}, { settleFrames: ${settle} })`);
        const shotPng = await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        const buf = Buffer.from(shotPng.data, 'base64');
        const file = `${stem}-${variant}.png`;
        writeFileSync(join(outDir, file), buf);
        const img = decodePng(buf);
        const png = imageStats(img);
        const checks: string[] = [];
        if (img.width !== width || img.height !== height) checks.push(`size ${img.width}x${img.height} != ${width}x${height}`);
        if (variant !== 'mask' && png.blackShare > 0.6) checks.push(`${Math.round(png.blackShare * 100)} % black pixels (camera inside geometry / nothing drawn?)`);
        let maskCoverage: VariantRecord['maskCoverage'] = null;
        if (variant === 'mask') {
          if (png.greyShare < 1) checks.push(`mask not greyscale: ${Math.round((1 - png.greyShare) * 1e4) / 100} % coloured pixels`);
          if (png.levels.full === 0) checks.push('mask has no DOF-sharp pixel (player / battlers not visible?)');
          maskCoverage = {
            player: st.rects.player === null ? null : fullShareIn(img, st.rects.player),
            battlers: st.rects.battlers.map((b) => ({ side: b.side, full: fullShareIn(img, b.rect) })),
          };
        } else if (png.greyShare > 0.95) checks.push('beauty frame is greyscale (mask output left on?)');
        const { anchor: _a, ...rest } = st;
        records.push({ variant, file, png, checks, maskCoverage, stage: rest });
        log(`${file}  ${((Date.now() - t0) / 1000).toFixed(1)} s  luma ${png.meanLuma}  draws ${st.counts.drawCalls}  ${checks.length === 0 ? 'ok' : checks.join('; ')}`);
      }
      const sidecar = {
        set, zone, shot: shot.id, n: shot.n, table: shot, layoutSeed: anchor.layoutSeed, anchor,
        resolution: { width, height, devicePixelRatio: 1 },
        machine: machine(), adapter: session.info['caps'], adapterInfo: session.info['adapterInfo'], chrome: session.browser.version,
        variants: records,
      };
      writeFileSync(join(outDir, `${stem}.json`), `${JSON.stringify(sidecar, null, 2)}\n`);
      index.push({ shot: shot.id, n: shot.n, x: anchor.x, z: anchor.z, layoutSeed: anchor.layoutSeed, files: records.map((r) => r.file), sidecar: `${stem}.json`, checks: records.flatMap((r) => r.checks.map((c) => `${r.variant}: ${c}`)) });
    }
    writeFileSync(join(outDir, 'index.json'), `${JSON.stringify({
      set, zone, layoutSeed: session.info['layoutSeed'], generatedAt: new Date().toISOString(), resolution: { width, height, devicePixelRatio: 1 },
      machine: machine(), adapter: session.info['caps'], adapterInfo: session.info['adapterInfo'], chrome: session.browser.version, bootMs: session.bootMs,
      harvest: session.info['harvest'], headingConvention: headings, shots: index,
    }, null, 2)}\n`);
    const log2 = await evaluate<string[]>(cdp, 'window.__ewaHarness.log');
    writeFileSync(join(outDir, 'harness.log'), `${log2.join('\n')}\n`);
  } finally {
    await session.close();
  }
  log(`wrote ${index.length} shots × ${variants.length} variants to ${outDir}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  log(`FAILED: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
