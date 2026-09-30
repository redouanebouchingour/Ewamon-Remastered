/**
 * CLI wrapper around the pure validate(): prints every error, writes dist/content-report.json
 * (counts, roster report + coverage paths, per-zone bind sets, heightfield digests, snapped points) and the 21
 * committed fields dist/heightfields/<zoneId>.json (§3.10), and exits non-zero on failure.
 * Run with `pnpm --filter @ewa/content run validate`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES, decodeHeightfield, encodeHeightfield, getHeightfield, validate } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../dist');

const started = Date.now();
const result = validate();
const ms = Date.now() - started;
const s = result.stats;

mkdirSync(DIST, { recursive: true });
const report = {
  ok: result.ok,
  generatedAt: new Date().toISOString(),
  counts: {
    species: s.species,
    moves: s.moves,
    abilities: s.abilities,
    items: s.items,
    orbs: s.orbs,
    consumables: s.consumables,
    types: s.types,
    zones: s.zones,
    encounterTables: s.encounterTables,
    encounterSlots: s.encounterSlots,
    statics: s.statics,
    league: s.league,
    quests: s.quests,
    storyBeats: s.storyBeats,
    seasonalEvents: s.seasonalEvents,
    dailySwarms: s.dailySwarms,
    raidHotspots: s.raidHotspots,
    battlePassLevels: s.battlePassLevels,
    bodies: s.bodies,
    flags: s.flags,
  },
  roster: s.roster,
  coverage: Object.keys(s.roster.paths)
    .sort()
    .map((id) => ({ id, path: s.roster.paths[id] })),
  perZone: s.roster.perZone,
  bindSets: s.bindSets,
  heightfields: s.heightfields,
  snapped: s.snapped,
  errors: result.errors,
};
writeFileSync(resolve(DIST, 'content-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

// §3.10: the full fields (plan footprints stamped) as dist/heightfields/<zoneId>.json — committed; the decoded file
// must reproduce the digest bit for bit
const FIELDS = resolve(DIST, 'heightfields');
if (Object.keys(s.heightfields).length > 0) {
  mkdirSync(FIELDS, { recursive: true });
  for (const zone of ZONES) {
    const json = encodeHeightfield(getHeightfield(zone.id));
    if (decodeHeightfield(json).digest !== json.digest) throw new Error(`${zone.id}: heightfield round-trip digest mismatch`);
    writeFileSync(resolve(FIELDS, `${zone.id}.json`), JSON.stringify(json) + '\n', 'utf8');
  }
}

console.log(
  `species ${s.species} · moves ${s.moves} · abilities ${s.abilities} · items ${s.items} · orbs ${s.orbs} · consumables ${s.consumables} · types ${s.types}`,
);
console.log(
  `zones ${s.zones} · tables ${s.encounterTables} (${s.encounterSlots} slots) · statics ${s.statics} · league ${s.league} · quests ${s.quests} · beats ${s.storyBeats}`,
);
console.log(
  `events ${s.seasonalEvents} · swarms ${s.dailySwarms} · raids ${s.raidHotspots} · battle pass ${s.battlePassLevels} · bodies ${s.bodies} · flags ${s.flags}`,
);
console.log(
  `roster: direct |E| ${s.roster.directlyPlaced} · obtainable ${s.roster.obtainable}/${s.roster.species} · families ${s.roster.families} · unobtainable ${s.roster.unobtainable.length}`,
);
const hf = Object.keys(s.heightfields).sort();
if (hf.length > 0) {
  const minWalk = Math.min(...hf.map((z) => s.heightfields[z as keyof typeof s.heightfields]!.walkable));
  console.log(`heightfields ${hf.length} · min walkable ${(minWalk * 100).toFixed(1)}% → dist/heightfields/`);
  for (const z of hf) {
    const f = s.heightfields[z as keyof typeof s.heightfields]!;
    console.log(
      `  ${z.padEnd(19)} walkable ${(f.terrainWalkable * 100).toFixed(2)}% → ${(f.walkable * 100).toFixed(2)}%  (${f.solids} footprints, ${f.footprintSamples} samples)  ${f.digest}`,
    );
  }
}
if (s.snapped.length > 0) {
  console.log(`snapped to the nearest walkable sample (rules 9 / 12): ${s.snapped.length}`);
  for (const p of s.snapped) {
    console.log(`  ${p.zoneId} ${p.what} (${p.x}, ${p.z}) → (${p.toX}, ${p.toZ}) ${Math.hypot(p.toX - p.x, p.toZ - p.z).toFixed(2)} m — ${p.cause}`);
  }
}
console.log(`validated in ${ms} ms → dist/content-report.json`);

if (!result.ok) {
  console.error(`\nFAIL (${result.errors.length})`);
  for (const e of result.errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log('OK — content validates');
