/**
 * Loads the legacy game data the pipeline needs: species (sprite file names, sizeScale,
 * evolutions), the per-route encounter tables and the league rosters.
 *
 * `ewamon.js` and `worldImported.js` are CommonJS but live under a `"type": "module"`
 * root, so Node refuses to `require()` them. They have no dependencies, so we evaluate
 * them in a tiny CommonJS shim instead. `world.js` is real ESM and is imported directly.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export interface LegacySpecies {
  id: string;
  frontSprite: string;
  backSprite: string;
  sizeScale: number;
  /** Direct forward evolutions (linear + split). */
  evolvesInto: string[];
}

export interface LegacyData {
  species: Map<string, LegacySpecies>;
  /** Route id -> species ids, in table order. */
  encounterTables: Array<{ route: string; species: string[] }>;
  /** Every species fielded by a gym leader, Elite warden or the Champion, in roster order. */
  leagueSpecies: string[];
}

interface RawSpecies {
  id?: unknown;
  frontSprite?: unknown;
  backSprite?: unknown;
  sizeScale?: unknown;
  evolvesInto?: unknown;
  splitEvolvesInto?: unknown;
}

function loadCommonJs(file: string): Record<string, unknown> {
  const src = readFileSync(file, 'utf8');
  const module = { exports: {} as Record<string, unknown> };
  const wrapper = vm.runInThisContext(`(function (module, exports, require) {${src}\n})`, {
    filename: file,
  }) as (m: typeof module, e: unknown, r: (id: string) => never) => void;
  wrapper(module, module.exports, (id: string) => {
    throw new Error(`legacy module ${path.basename(file)} tried to require('${id}')`);
  });
  return module.exports;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function parseSpecies(raw: Record<string, unknown>): Map<string, LegacySpecies> {
  const out = new Map<string, LegacySpecies>();
  for (const id of Object.keys(raw).sort()) {
    const s = raw[id] as RawSpecies;
    const evolvesInto: string[] = [];
    if (typeof s.evolvesInto === 'string') evolvesInto.push(s.evolvesInto);
    if (Array.isArray(s.splitEvolvesInto)) {
      for (const opt of s.splitEvolvesInto as Array<{ into?: unknown }>) {
        if (typeof opt?.into === 'string') evolvesInto.push(opt.into);
      }
    }
    out.set(id, {
      id,
      frontSprite: str(s.frontSprite),
      backSprite: str(s.backSprite),
      sizeScale: typeof s.sizeScale === 'number' ? s.sizeScale : 1,
      evolvesInto,
    });
  }
  return out;
}

type Team = Array<{ species?: unknown }>;

export async function loadLegacyData(legacyDir: string): Promise<LegacyData> {
  const ewamon = loadCommonJs(path.join(legacyDir, 'ewamon.js'));
  const species = parseSpecies((ewamon.EWAMON_SPECIES ?? {}) as Record<string, unknown>);

  const worldImported = loadCommonJs(path.join(legacyDir, 'worldImported.js'));
  const tables = (worldImported.ENCOUNTER_TABLES ?? {}) as Record<string, Array<{ speciesId?: unknown }>>;
  const encounterTables = Object.keys(tables).map((route) => ({
    route,
    species: dedupe((tables[route] ?? []).map((e) => str(e.speciesId)).filter(Boolean)),
  }));

  const world = (await import(pathToFileURL(path.join(legacyDir, 'world.js')).href)) as {
    GYMS?: Record<string, { team?: Team }>;
    ELITE?: Array<{ team?: Team }>;
    CHAMPION?: { team?: Team };
  };
  const league: string[] = [];
  const pushTeam = (team: Team | undefined): void => {
    for (const m of team ?? []) if (typeof m.species === 'string') league.push(m.species);
  };
  for (const key of Object.keys(world.GYMS ?? {})) pushTeam(world.GYMS?.[key]?.team);
  for (const e of world.ELITE ?? []) pushTeam(e.team);
  pushTeam(world.CHAMPION?.team);

  return { species, encounterTables, leagueSpecies: dedupe(league) };
}

/** Follows forward evolutions from `roots`, returning roots + every descendant (sorted). */
export function withEvolutions(roots: Iterable<string>, species: Map<string, LegacySpecies>): string[] {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of species.get(id)?.evolvesInto ?? []) stack.push(next);
  }
  return [...seen].sort();
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
