/**
 * CLI wrapper around the pure validate(): prints every error, writes dist/content-report.json
 * (counts, roster report + coverage paths, per-zone bind sets, heightfield digests) and exits non-zero on failure.
 * Run with `pnpm --filter @ewa/content run validate`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../src/index';

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
  errors: result.errors,
};
writeFileSync(resolve(DIST, 'content-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

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
  console.log(`heightfields ${hf.length} · min walkable ${(minWalk * 100).toFixed(1)}%`);
}
console.log(`validated in ${ms} ms → dist/content-report.json`);

if (!result.ok) {
  console.error(`\nFAIL (${result.errors.length})`);
  for (const e of result.errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log('OK — content validates');
