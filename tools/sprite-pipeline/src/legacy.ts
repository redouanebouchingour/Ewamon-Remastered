/**
 * Loads the legacy game data the pipeline needs: species (sprite file names, sizeScale) from
 * `ewamon.js`, and the rosters the zone planner reads from `world.js` — gym teams (with
 * their town), Elite Four + Champion teams (solenne) and per-zone overworld trainer teams.
 *
 * `ewamon.js` is CommonJS under a `"type": "module"` root, so Node refuses to `require()`
 * it. It has no dependencies, so it is evaluated in a tiny CommonJS shim. `world.js` is real
 * ESM and is imported directly.
 *
 * Species added after the migration live in `.design/additions/species.js` (`EWAMON_SPECIES_ADDITIONS`,
 * the same row shape, a sibling of the legacy directory) and join the species set when that file exists. A row's
 * `battleForm` (a mid-battle form) ships as one more sprite entry under the key `<species>_<form>` (e.g.
 * `hollowmane_rage`) with the species' sizeScale: the sprite set is the species set plus those form keys. A row's
 * `battleForms` (ravatar's five relic forms) ship one such entry per form.
 * `.design/additions/patches.js` (`EWAMON_SPECIES_PATCHES`, field patches to legacy rows) can give a legacy species a
 * `battleForm` too (the Majin / Tenjin forms, e.g. `zenryu_majin`): those join the same way, with the legacy species'
 * sizeScale. The other patched fields (moves, learnable moves) do not concern the sprites.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export interface LegacySpecies {
  id: string;
  frontSprite: string;
  backSprite: string;
  sizeScale: number;
}

export interface LegacyTeam {
  id: string;
  /** Zone the battle happens in; null when the legacy data does not place it. */
  zoneId: string | null;
  species: string[];
}

export interface LegacyData {
  species: Map<string, LegacySpecies>;
  /** Gym leaders keyed to their town, Elite wardens and the Champion keyed to `solenne`. */
  league: LegacyTeam[];
  /** Overworld trainers per zone (`AREAS[zone].trainers`). */
  trainers: LegacyTeam[];
}

interface RawSpecies {
  frontSprite?: unknown;
  backSprite?: unknown;
  sizeScale?: unknown;
}

/** A row's `battleForm` (species.js additions or patches.js): only the fields the sprite set needs. */
interface RawBattleForm {
  id?: unknown;
  frontSprite?: unknown;
  backSprite?: unknown;
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

/** The species set: every key of `EWAMON_SPECIES` that carries a `frontSprite` (items do not). */
export function parseSpecies(raw: Record<string, unknown>): Map<string, LegacySpecies> {
  const out = new Map<string, LegacySpecies>();
  for (const id of Object.keys(raw).sort()) {
    const s = raw[id] as RawSpecies;
    if (typeof s.frontSprite !== 'string' || !s.frontSprite) continue;
    out.set(id, {
      id,
      frontSprite: s.frontSprite,
      backSprite: str(s.backSprite),
      sizeScale: typeof s.sizeScale === 'number' ? s.sizeScale : 1,
    });
  }
  return out;
}

type RawTeamMember = { species?: unknown } | [unknown, unknown];

function teamSpecies(team: unknown): string[] {
  if (!Array.isArray(team)) return [];
  const out: string[] = [];
  for (const m of team as RawTeamMember[]) {
    const sp = Array.isArray(m) ? m[0] : m?.species;
    if (typeof sp === 'string') out.push(sp);
  }
  return out;
}

export function loadLegacySpecies(legacyDir: string): Map<string, LegacySpecies> {
  const ewamon = loadCommonJs(path.join(legacyDir, 'ewamon.js'));
  const raw = { ...((ewamon.EWAMON_SPECIES ?? {}) as Record<string, unknown>) };
  const additionsFile = path.join(legacyDir, '..', 'additions', 'species.js');
  if (existsSync(additionsFile)) {
    const additions = (loadCommonJs(additionsFile).EWAMON_SPECIES_ADDITIONS ?? {}) as Record<string, unknown>;
    for (const id of Object.keys(additions)) {
      if (id in raw) throw new Error(`additions: species '${id}' already exists in ewamon.js`);
      raw[id] = additions[id];
    }
    for (const id of Object.keys(additions)) {
      const row = additions[id] as RawSpecies & { battleForm?: RawBattleForm; battleForms?: RawBattleForm[] };
      // one battleForm, or (ravatar's relic forms) a list of battleForms: one sprite entry per form
      const forms = row.battleForms ?? (row.battleForm === undefined ? [] : [row.battleForm]);
      for (const form of forms) {
        if (typeof form.id !== 'string') continue;
        const key = `${id}_${form.id}`;
        if (key in raw) throw new Error(`additions: form sprite key '${key}' collides with a species`);
        raw[key] = { frontSprite: form.frontSprite, backSprite: form.backSprite, sizeScale: row.sizeScale };
      }
    }
  }
  const patchesFile = path.join(legacyDir, '..', 'additions', 'patches.js');
  if (existsSync(patchesFile)) {
    const patches = (loadCommonJs(patchesFile).EWAMON_SPECIES_PATCHES ?? {}) as Record<string, unknown>;
    for (const id of Object.keys(patches)) {
      const form = (patches[id] as { battleForm?: RawBattleForm }).battleForm;
      if (form === undefined || typeof form.id !== 'string') continue;
      const base = raw[id] as RawSpecies | undefined;
      if (base === undefined) throw new Error(`patches: battleForm on unknown species '${id}'`);
      const key = `${id}_${form.id}`;
      if (key in raw) throw new Error(`patches: form sprite key '${key}' collides with a species or another form`);
      raw[key] = { frontSprite: form.frontSprite, backSprite: form.backSprite, sizeScale: base.sizeScale };
    }
  }
  return parseSpecies(raw);
}

export async function loadLegacyData(legacyDir: string): Promise<LegacyData> {
  const species = loadLegacySpecies(legacyDir);

  const world = (await import(pathToFileURL(path.join(legacyDir, 'world.js')).href)) as {
    AREAS?: Record<string, { trainers?: Array<{ name?: unknown; team?: unknown }> }>;
    GYMS?: Record<string, { area?: unknown; team?: unknown }>;
    ELITE?: Array<{ id?: unknown; team?: unknown }>;
    CHAMPION?: { id?: unknown; team?: unknown };
  };

  const league: LegacyTeam[] = [];
  for (const key of Object.keys(world.GYMS ?? {}).sort()) {
    const g = world.GYMS![key]!;
    league.push({ id: key, zoneId: typeof g.area === 'string' ? g.area : null, species: teamSpecies(g.team) });
  }
  for (const e of world.ELITE ?? []) league.push({ id: str(e.id, 'elite'), zoneId: 'solenne', species: teamSpecies(e.team) });
  if (world.CHAMPION) league.push({ id: str(world.CHAMPION.id, 'champion'), zoneId: 'solenne', species: teamSpecies(world.CHAMPION.team) });

  const trainers: LegacyTeam[] = [];
  for (const zoneId of Object.keys(world.AREAS ?? {}).sort()) {
    const list = world.AREAS![zoneId]!.trainers ?? [];
    list.forEach((t, i) => trainers.push({ id: `${zoneId}/${str(t.name, String(i))}`, zoneId, species: teamSpecies(t.team) }));
  }

  return { species, league, trainers };
}
