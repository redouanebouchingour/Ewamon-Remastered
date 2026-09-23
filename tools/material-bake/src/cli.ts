/**
 * material-bake CLI.
 *
 *   tsx src/cli.ts bake [--zone <id|biome>]... [--surface <id>]... [--tier field|hero] [--force] [--jobs N]
 *   tsx src/cli.ts report
 *   tsx src/cli.ts --preview <id> [--tier field|hero]     → qa/<id>.png
 *   tsx src/cli.ts sheet [--zone <id|biome>]... [--surface <id>]... [--out qa/slice-sheet.png]
 */
import { join, resolve } from 'node:path';
import { RECIPES, SURFACES, isSurfaceId } from '@ewa/render/surfaces';
import { bakeTier } from './bake';
import type { BakedTier, Tier } from './bake';
import { QA_DIR, TOOL_ROOT } from './paths';
import { writePreview, writeSheet } from './preview';
import { printReport } from './report';
import { assertRecipeTable, fmtBytes, runBake, selectIds } from './run';

interface Args { cmd: string; zones: string[]; surfaces: string[]; tier?: Tier; force: boolean; jobs?: number; preview?: string; out?: string }

function parse(argv: readonly string[]): Args {
  const a: Args = { cmd: '', zones: [], surfaces: [], force: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]!;
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${t} needs a value`);
      return v;
    };
    if (t === '--zone') a.zones.push(next());
    else if (t === '--surface') a.surfaces.push(next());
    else if (t === '--tier') {
      const v = next();
      if (v !== 'field' && v !== 'hero') throw new Error(`--tier must be field or hero, got ${v}`);
      a.tier = v;
    } else if (t === '--force') a.force = true;
    else if (t === '--jobs') a.jobs = Number(next());
    else if (t === '--preview') { a.preview = next(); a.cmd ||= 'preview'; }
    else if (t === '--out') a.out = next();
    else if (t === '--report') a.cmd = 'report';
    else if (!t.startsWith('--') && !a.cmd) a.cmd = t;
    else throw new Error(`unknown argument ${t}`);
  }
  return a;
}

async function main(): Promise<void> {
  const a = parse(process.argv.slice(2));
  switch (a.cmd) {
    case 'bake': {
      const t0 = performance.now();
      const r = await runBake({
        zones: a.zones, ids: a.surfaces, force: a.force,
        ...(a.tier ? { tier: a.tier } : {}), ...(a.jobs ? { jobs: a.jobs } : {}),
      });
      console.log(`done: ${r.inputs} tier sets, cacheHits ${r.cacheHits}, baked ${r.baked}; manifest ${Object.keys(r.manifest.surfaces).length} surfaces, total ${fmtBytes(r.manifest.totalBytes)} in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
      break;
    }
    case 'report': {
      const d = printReport();
      if (d.problems.length) process.exitCode = 1;
      break;
    }
    case 'preview': {
      const id = a.preview!;
      if (!isSurfaceId(id)) throw new Error(`unknown surface ${id}`);
      const r = RECIPES[id]!;
      const tier: Tier = a.tier ?? (r.hero ? 'hero' : 'field');
      const t = bakeTier(r, SURFACES[id], tier);
      const file = join(QA_DIR, `${id}.png`);
      await writePreview(t, file);
      console.log(`wrote ${file} (${tier} ${t.size}², clamped ${t.clampedPct.toFixed(2)} %, seam ${t.seam ? (Math.max(t.seam.albedo, t.seam.height) * 255).toFixed(2) : '-'}/255)`);
      break;
    }
    case 'sheet': {
      assertRecipeTable();
      const ids = a.zones.length || a.surfaces.length ? selectIds(a.zones, a.surfaces) : selectIds(['mirevale'], undefined);
      const order = a.zones.length || a.surfaces.length ? ids : (await import('@ewa/render/surfaces')).GROVE_IDS;
      const tiers: BakedTier[] = [];
      for (const id of order) {
        const r = RECIPES[id]!;
        tiers.push(bakeTier(r, SURFACES[id], a.tier ?? (r.hero ? 'hero' : 'field')));
      }
      const file = resolve(TOOL_ROOT, a.out ?? join('qa', 'slice-sheet.png'));
      await writeSheet(tiers, file);
      console.log(`wrote ${file} (${tiers.length} rows)`);
      break;
    }
    default:
      console.log('usage: cli.ts bake [--zone <id>]... [--surface <id>]... [--tier field|hero] [--force] [--jobs N] | report | --preview <id> | sheet');
      process.exitCode = a.cmd ? 1 : 0;
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
