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
 * table's '0 = +z forward' reading; rig = the numbers straight to CameraRig.setHeading, written under `headings-rig/`) ·
 * `--no-edge-scan`.
 *
 * Phase E3 (audit M2-sprite-edge-5): the `sprite-edge` shot also runs the §50.1 #6 edge scan — the page stages
 * `stage.inspect` on the shot's wild creature at ≥ 1.3× magnification (`stageEdgeScan`) and draws the scene pass's
 * `mask.y`; this runner captures it (`<stem>-edgemask.png`), scans 200 straight-edge pixels for intermediate values
 * (`src/harness/edgeScan.ts`, pixels are read here in Node, never in the client runtime), captures the same frame's
 * pre-TRAA `output` MRT (`<stem>-output.png`) and records `edgeScan` in the sidecar.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIT_SHOTS, VARIANTS, shotFileStem, shotsForZone } from '../../src/harness/shotTable';
import { scanSpriteEdges } from '../../src/harness/edgeScan';
import type { EdgeScanResult } from '../../src/harness/edgeScan';
import type { ResolvedAnchor } from '../../src/harness/anchors';
import type { ShotId, Variant } from '../../src/harness/shotTable';
import type { EdgeStage, StageResult } from '../../src/harness/stage';
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
  const tableShots = shotsForZone(zone, set);
  const shots = want === 'all' ? tableShots : tableShots.filter((s) => want.split(',').includes(s.id));
  if (shots.length === 0) throw new Error(`no §50.6.1 shot belongs to zone ${zone} (table zones: ${[...new Set(AUDIT_SHOTS.map((s) => s.zone))].join(', ')})`);
  const headings = argStr(args, 'headings', 'words') === 'rig' ? 'rig' : 'words';
  const outDir = headings === 'rig' ? join(outRoot, set, zone, 'headings-rig') : join(outRoot, set, zone);
  mkdirSync(outDir, { recursive: true });

  const session = await openSession({ zone, route: 'shots', width, height, serve: argStr(args, 'serve', 'build') === 'dev' ? 'dev' : 'build', build: args['no-build'] !== true, headings, set });
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
      let edgeScan: (EdgeStage & { readonly scan: EdgeScanResult; readonly files: readonly string[]; readonly checks: readonly string[] }) | null = null;
      if (shot.id === 'sprite-edge' && args['no-edge-scan'] !== true) {
        const t0 = Date.now();
        const es = await evaluate<EdgeStage>(cdp, `window.__ewaHarness.edgeScan(${JSON.stringify(shot.id)})`);
        const maskPng = Buffer.from((await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })).data, 'base64');
        const maskFile = `${stem}-edgemask.png`;
        writeFileSync(join(outDir, maskFile), maskPng);
        const scan = scanSpriteEdges(decodePng(maskPng), es.rect);
        await evaluate<void>(cdp, 'window.__ewaHarness.edgeOutput()');
        const outPng = Buffer.from((await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })).data, 'base64');
        const outFile = `${stem}-output.png`;
        writeFileSync(join(outDir, outFile), outPng);
        await evaluate<void>(cdp, 'window.__ewaHarness.edgeRestore()');
        const checks: string[] = [];
        if (es.magnification < 1.3) checks.push(`magnification ${es.magnification} < 1.3`);
        if (scan.sampled < scan.want) checks.push(`only ${scan.sampled} straight-edge pixels (want ${scan.want})`);
        if (scan.intermediateSampled > 0 || scan.intermediateInRect > 0) checks.push(`intermediate values: ${scan.intermediateSampled} sampled, ${scan.intermediateInRect} in rect`);
        edgeScan = { ...es, scan, files: [maskFile, outFile], checks };
        log(`${maskFile}  ${((Date.now() - t0) / 1000).toFixed(1)} s  ${es.species} ×${es.magnification} (stock ×${es.magnificationStock}, fov ${es.fovDeg}°)  sampled ${scan.sampled}/${scan.straightPx} straight of ${scan.boundaryPx} edge px, intermediate ${scan.intermediateSampled} / rect ${scan.intermediateInRect}  ${checks.length === 0 ? 'PASS' : checks.join('; ')}`);
        if (checks.length > 0) failures++;
      }
      const sidecar = {
        set, zone, shot: shot.id, n: shot.n, table: shot, layoutSeed: anchor.layoutSeed, anchor,
        resolution: { width, height, devicePixelRatio: 1 },
        machine: machine(), adapter: session.info['caps'], adapterInfo: session.info['adapterInfo'], chrome: session.browser.version,
        variants: records,
        ...(edgeScan !== null ? { edgeScan } : {}),
      };
      writeFileSync(join(outDir, `${stem}.json`), `${JSON.stringify(sidecar, null, 2)}\n`);
      index.push({
        shot: shot.id, n: shot.n, x: anchor.x, z: anchor.z, layoutSeed: anchor.layoutSeed, files: [...records.map((r) => r.file), ...(edgeScan?.files ?? [])], sidecar: `${stem}.json`,
        checks: [...records.flatMap((r) => r.checks.map((c) => `${r.variant}: ${c}`)), ...(edgeScan?.checks ?? []).map((c) => `edge scan: ${c}`)],
      });
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
